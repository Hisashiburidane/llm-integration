# 13. LLM Context 与 Tool Calling 边界

## 1. 目标

`EnchantSnapshot` 是 Core 的完整运行时对象，负责 registry、policy、并发校验、执行和 debug。它不应直接作为 LLM 请求体。

默认 agent 的请求由三部分组成：

```text
页面结构说明（由 metadata 生成）
        + wrapper / application instruction
        + OpenAI-compatible function tools
        + 用户命令
```

LLM 负责理解命令并选择工具；Core 负责工具白名单、输入校验、policy、确认和执行。

Snapshot version 表示 metadata/capability 合约版本，不表示业务数据版本。表格、图表和 store 数据刷新不应触发 capture 或改变 registry version；需要实时数据时，由 read capability 在执行阶段读取。

## 2. 请求分层

### 2.1 System prompt

System prompt 只包含：

- runtime protocol：只调用提供的 function tools，不猜测未授权操作；
- 安全和计划规则：最少调用、禁止未经授权的提交/审批/支付/删除；
- `<Enchant prompt>` 或 `spell` 归一化后的局部规则；
- 调用方传入的本次运行 instruction。

不得在 system prompt 中要求模型生成 snapshot version、registry 状态或其他 Core 内部字段。

### 2.2 页面结构说明

Context 只提供由 metadata 生成的页面组织结构：页面、Enchantment、region、field、chart、table 和 panel 的 id、label、kind 及 children。

结构说明用于把“CPU 面板”“收件地址字段”等自然语言目标解析为工具参数。它不是工具目录，也不能单独产生可执行动作。

不进入结构说明：

- field 当前 value；
- table visible rows；
- DOM selector；
- component state；
- lifecycle、exposure、source、capture version；
- policy 配置和执行回调。

### 2.3 Function tools

当前 snapshot 中经过 exposure 和 policy 过滤的 capability 转换为 OpenAI-compatible function tools。每个 function tool 包含：

- 稳定的请求内 function name；
- capability label、description、target 和 effect；
- capability inputSchema 作为 function parameters；
- 对应 Enchantment 的局部 instruction，作为工具描述中的调用规则。

LLM 返回 tool call 后，Core 使用请求内的 name-to-capability 映射恢复真实 `capabilityId`，解析 arguments，再按原有执行链校验。

`owner`、`provider`、真实 `execute()` 函数和 registry 对象不进入 function tool 定义。

### 2.4 用户命令

用户输入作为普通 user message 发送。它不改变工具白名单，也不能覆盖 policy 或 wrapper instruction。

## 3. OpenAI-compatible API

默认 client 使用 Chat Completions 的 `tools` 和 `tool_choice: "auto"` 字段。响应优先读取 `message.tool_calls`；如果服务端或模型不支持 tool calling，则保留 JSON plan fallback，以兼容旧 endpoint。

兼容 API 不代表所有模型都实现完全一致的 tool calling 行为。Core 必须同时处理：缺少 tool call、非法 function name、非法 arguments、普通 JSON 计划和错误响应。

## 4. 控制边界

完整 snapshot 仍然保留在 `EnchantAgentRequest` 和 Forge 内部，供以下流程使用：

- capture、retention 和 trace；
- snapshot/registry 版本检查；
- capability 是否属于本次 snapshot；
- policy 和确认决策；
- inputSchema 校验；
- executor 调用和结果归一化。

任何 LLM Context 字段都不能替代这些执行前检查。自定义 agent 可以直接读取 `EnchantAgentRequest.snapshot`，但默认 agent 和官方 provider 必须通过显式 Context/Tool exporter 构造请求。

## 5. 设计准则

1. 优先完善 tool 的 description、target 和 inputSchema；
2. 只有用户目标无法从 tool 契约解析时，才补充页面结构 metadata；
3. 业务状态、后端数据和持久化效果必须由 Application capability 提供；
4. 不把完整 snapshot、业务 store 或页面对象直接 JSON 序列化给模型。
