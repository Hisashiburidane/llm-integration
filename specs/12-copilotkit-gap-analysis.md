# 12. CopilotKit 功能重合与差异分析

## 1. 文档目的

本文对照 EnchantForge 已设计的功能与 CopilotKit 当前公开能力，明确：

1. CopilotKit 已经原生提供的能力；
2. CopilotKit 可以承载、但需要应用自行实现的能力；
3. EnchantForge 当前相对独立的功能设计；
4. CopilotKit 对 EnchantForge 产品边界和技术路线的影响。

本文依据 2026 年 7 月可见的 CopilotKit 官方仓库、官方文档和
`@copilotkit/vue` 主分支。“不支持”表示没有发现文档化的一等框架能力，
不表示使用 CopilotKit 无法通过应用代码实现。

主要参考：

- [CopilotKit repository](https://github.com/CopilotKit/CopilotKit)
- [CopilotKit architecture](https://docs.copilotkit.ai/concepts/architecture)
- [Frontend Tools](https://docs.copilotkit.ai/frontend-tools)
- [Agent Context](https://docs.copilotkit.ai/agent-app-context)
- [Shared State](https://docs.copilotkit.ai/shared-state)
- [Inspector](https://docs.copilotkit.ai/inspector)
- [`@copilotkit/vue`](https://github.com/CopilotKit/CopilotKit/tree/main/packages/vue)

## 2. 总体结论

CopilotKit 已经提供完整的 Agent 前端基础设施，包括 Provider、Agent Runtime、
Chat、前端 Tool、动态 Context、共享状态、Human-in-the-loop、Generative UI、
MCP、AG-UI、Inspector 和 Threads。

因此，下列描述不足以区分 EnchantForge：

> 为 Vue 应用增加一个能够读取 Context、调用 Tools 并操作界面的聊天助手。

EnchantForge 相对独立的设计集中在另一层：

> 将既有 Vue UI 转换为带有层级、来源、可信度、生命周期、暴露范围和执行约束的
> 实时语义模型，并将该模型导出给不同 Agent Runtime。

CopilotKit 解决 Agent 与前端之间的通信和交互循环；EnchantForge 计划解决已有
Vue 业务界面如何低成本、结构化、可约束地进入该循环。

## 3. CopilotKit 已原生覆盖的能力

### 3.1 前端 Tool

CopilotKit 的 `useFrontendTool` 已支持：

- 在组件作用域注册浏览器端 Tool；
- 定义参数 schema 和 handler；
- 读取或修改组件状态；
- 调用浏览器 API 和第三方前端库；
- 触发 UI 更新与动画；
- 随组件 mount/unmount 注册和注销；
- 按状态启用或禁用 Tool；
- 展示 Tool 的执行状态和结果。

这覆盖了 EnchantForge `useEnchantAction()` 的主要底层能力。组件生命周期内动态
注册可执行函数不是 EnchantForge 的独有功能。

### 3.2 Agent Context 与共享状态

`useAgentContext` 支持多个组件分别提供 Context，并在数据变化时更新 Agent 所见内容。
Shared State 支持 Agent 与前端双向读写状态，并通过 AG-UI state snapshot 和 delta
事件同步。

这覆盖 Enchantment metadata contribution 的基本信息传递能力，以及 Agent 驱动
表单、筛选条件和视图状态变化的底层能力。

### 3.3 交互与调试

CopilotKit 已提供：

- Chat、Popup 和 Sidebar；
- reasoning 和流式消息展示；
- Human-in-the-loop 和 Interrupt；
- Tool Call 自定义渲染；
- Inspector 中的事件、Tool、Context、Agent State 和消息检查；
- Threads 和持久化相关能力。

Aura 的聊天界面、执行进度和基础调试功能不应成为 EnchantForge 重复建设的重点。

## 4. CopilotKit 没有直接提供的 EnchantForge 设计

### 4.1 Wrapper 级 UI 语义发现

EnchantForge 使用 `<Enchant>` 建立局部边界，并聚合边界内的字段、动作、表格、
图表、Panel、Dialog、组件状态和局部 instruction。

CopilotKit 要求开发者通过 `useAgentContext` 明确提供 Context。当前没有发现一个
CopilotKit wrapper 可以读取已有组件并生成统一 UI metadata。

### 4.2 统一 Metadata 模型

EnchantForge 定义标准化的 `Enchantment` 和 metadata node：

```text
Enchantment
├── status
├── metadata
│   ├── field
│   ├── action
│   ├── table
│   ├── chart
│   └── region
└── capabilities
```

节点包含 `source`、`confidence`、`visible`、`enabled`、语义类型、校验错误和
可选值等信息。CopilotKit Context 可以承载这些数据，但不定义对应 schema，也不
负责把任意 Context 归一化为 UI metadata tree。

### 4.3 Metadata 到 Tool 的转换

CopilotKit 的 Context 和 Frontend Tool 是两套显式输入：

```text
useAgentContext(value)
useFrontendTool(handler)
```

EnchantForge 计划根据当前 Enchantment、capability provider 和 policy 自动产生
适合模型协议的 Tool 清单：

```text
metadata
  + capability provider
  + executor
  + policy decision
  = executable tool
```

该转换避免把每个字段和组件都手写成独立 Tool，同时禁止只有 metadata、没有
执行所有者的对象被错误导出为可执行操作。CopilotKit 当前没有对应的一等模型。

### 4.4 渐进式扫描

EnchantForge 设计了显式 Vue contribution、组件 Adapter、marked scan 和 full DOM
fallback：

```vue
<Enchant>
  <ControlledForm />
</Enchant>

<Enchant scan="marked">
  <a-input v-enchant />
</Enchant>

<Enchant scan="auto">
  <LegacyForm />
</Enchant>
```

同时提供 `v-enchant-ignore`、嵌套边界隔离、扫描类型开关和 DOM 写入降级策略。
CopilotKit 当前没有 DOM scanner、扫描 directive、扫描边界或归一化扫描结果。

### 4.5 UI Framework Adapter

EnchantForge 计划为稳定技术契约提供 Adapter：

- Ant Design Vue 表单 metadata、校验状态和字段读写；
- ECharts option、legend、tooltip 和 dataZoom；
- Vue Router 当前路由与受约束导航；
- Pinia 明确暴露的 state 和 action；
- DOM 聚焦、滚动和高亮。

CopilotKit 可以调用这些库，但没有发现面向这些 Vue 技术的语义 Adapter。开发者需要
为每个应用显式编写 Context 和 Tool。

### 4.6 Invocation-time Capture

EnchantForge 默认只维护轻量 registration 和 lifecycle status，在模型调用或显式
请求时才捕获 metadata：

```text
registry digest
  -> invocation-time capture
  -> temporary snapshot
  -> filtered tool list
```

完整 snapshot 默认不持久保存，自动 capture 只在用户明确开启或 debug 插件存在时
启用。CopilotKit 的 Agent Context 默认跟随数据动态更新，但没有发现针对当前 UI
语义的惰性 capture、registry digest 和 snapshot retention 策略。

### 4.7 Snapshot 与执行边界

EnchantForge 在一次运行中使用 snapshot 生成规划上下文和 debug 记录，执行前按 capability 即时验证：

- capability 是否出现在本次规划工具集合；
- 对应 registration 是否仍然存活；
- 当前 exposure 和 policy 是否仍允许执行；
- 当前 capability 合约是否仍与规划时一致。

这用于处理路由切换、KeepAlive、Modal、Drawer、动态表单和异步 Tool Call；无关 UI 挂载只改变 registry version 时，不会自动使整份计划失效。
CopilotKit 会在 Tool 所属组件卸载时注销 Tool，也支持 Tool availability；EnchantForge
在此基础上把 snapshot 限定为规划和 debug 上下文，并在执行时重新校验 capability 合约。

### 4.8 UI 生命周期与暴露范围

EnchantForge 的 Enchantment 状态包括 `alive`、`active`、`visible` 和 `enabled`，
并定义 `aura`、`local`、`private` 三种暴露范围。

它可以区分局部 Agent、应用级 Aura、不得发送给模型的私有信息，以及 Vue KeepAlive
`deactivated` 状态。EnchantForge 的 `agentId` 是可继承的控制元数据，由应用 resolver
映射到不同 Agent Client，不进入模型 Context。CopilotKit 支持 mount/unmount、`available`
和 `agentId`，但没有
发现与嵌套 UI 边界对应的暴露模型以及统一的 active/visible 状态模型。

### 4.9 Effect、值策略和能力所有权

EnchantForge 为 capability 定义：

```ts
type Effect = 'read' | 'visual' | 'draft' | 'commit';
type ValuePolicy = 'expose' | 'mask' | 'omit';
type CapabilityOwner = 'core' | 'adapter' | 'application';
```

这些字段用于统一判断 effect、要求确认、在导出前脱敏、明确执行所有者，并禁止
没有 provider 的 metadata 生成可执行 Tool。

CopilotKit 支持 Tool availability、参数校验和 Human-in-the-loop，也可以接入外部
治理系统，但没有发现上述 UI capability policy 和 owner 模型作为 CopilotKit Core
的一等能力。

### 4.10 语义 Workflow 和 UI Snapshot 恢复

EnchantForge 规格包含：

- 保存模型生成且已经执行过的语义调用链；
- 将重复操作保存为快捷命令；
- 将当前视图保存为语义 snapshot；
- 恢复时通过 UI capability 逐步驱动页面，而不是只恢复 URL 参数或 Agent State。

CopilotKit 提供 Threads、消息历史和 Agent State 持久化，但没有发现通用的既有 UI
操作链录制、参数化和语义恢复机制。

### 4.11 微应用 Registry

EnchantForge 规划了主应用和微应用之间的 registry 隔离：子应用拥有本地 metadata
和 executor，主应用只获得经过过滤的摘要，effect 仍在拥有状态的子应用中执行。

CopilotKit 支持多 Agent 和 Runtime 通信，但没有针对 qiankun 等微前端的 UI metadata
所有权、净化和跨应用执行路由模型。

## 5. 可以用 CopilotKit 实现，但不是其内置能力

以下业务效果可以通过 CopilotKit Frontend Tool 实现，因此不能表述为 CopilotKit
做不到：

- 自然语言填写表单；
- 页面导航；
- 图表筛选、高亮和 tooltip；
- 打开 Modal 或 Drawer；
- 组合 Dashboard；
- 解释表单校验错误；
- 从 ASR 文本创建工单草稿；
- 根据用户行为触发帮助建议；
- metadata 与知识库联合检索；
- 数据筛选和导出；
- 保存应用自定义视图。

这些功能的语义和 effect 仍属于应用。EnchantForge 的价值不是内置这些业务操作，
而是减少它们接入 Agent 时重复编写 metadata、生命周期、Tool schema、policy 和
调试代码的成本。

## 6. 不应继续作为差异点的功能

以下能力 CopilotKit 已经提供，EnchantForge 不应将其作为核心竞争叙事：

- 聊天气泡、Chat、Popup 和 Sidebar；
- LLM 消息流式展示和 reasoning；
- 前端 Tool Call 和 Tool 生命周期注册；
- 动态 Agent Context 和共享状态；
- Human-in-the-loop 和 Tool 参数校验；
- Inspector 和 Threads；
- MCP、AG-UI 和 Generative UI。

EnchantForge 可以保留 Aura 作为开箱即用的参考客户端，但不应继续投入大量资源维护
独立聊天协议、消息系统、线程系统和通用 Agent Runtime。

## 7. 推荐的产品边界

建议将 EnchantForge 定义为：

> 面向既有 Vue 应用的 UI semantic integration layer。

推荐架构：

```text
Existing Vue Application
        |
        v
Enchant wrapper / composable / UI adapter
        |
        v
Enchantment metadata + capability registry
        |
        v
snapshot / policy / tool exporter
        |
        +--> CopilotKit / AG-UI
        +--> OpenAI-compatible tool use
        +--> MCP or other agent runtimes
```

在该架构中：

- Enchantment、registry、capture 和 policy 是核心；
- Vue 和组件库 Adapter 是主要工程投入；
- Aura 是可替换的消费端；
- CopilotKit 可以作为 Agent Runtime、Chat UI 和 AG-UI 集成层；
- EnchantForge 不绑定单一模型协议或聊天组件。

## 8. 后续验证

在继续扩大 EnchantForge Core 前，应完成一个最小 CopilotKit Adapter 实验：

```text
EnchantCapability -> CopilotKit Frontend Tool
EnchantSnapshot   -> CopilotKit Agent Context
CopilotKit events -> Enchant trace adapter
```

实验需要回答：

1. EnchantForge Adapter 是否显著减少现有 Vue 页面接入代码；
2. metadata tree 是否比自由 Context 更容易被小模型稳定理解；
3. snapshot 绑定执行是否能避免动态页面中的陈旧 Tool Call；
4. effect、exposure 和 value policy 是否能形成可复用约束；
5. CopilotKit Vue API 是否足够稳定，可作为可选下游而非 Core 依赖；
6. 去掉 Aura 自有聊天实现后，EnchantForge 的核心价值是否仍然成立。

如果 EnchantForge 只是在 `useAgentContext` 和 `useFrontendTool` 外增加少量语法糖，
项目不具备独立框架价值。如果 UI Adapter、动态 registry、结构化 metadata 和执行
约束可以持续减少跨页面改造成本，则 EnchantForge 具备作为 Vue AI integration
infrastructure 的独立价值。

## 9. 决策摘要

```text
CopilotKit owns the agent-to-UI interaction loop.
EnchantForge should own the existing-Vue-UI-to-semantic-capability bridge.
```

两者存在明显重合，但重合主要位于 Agent UI、Context、Tool 和 Runtime 层。EnchantForge
应停止重复建设这些成熟能力，把研发重心收缩到 CopilotKit 当前没有直接提供的
UI metadata、Adapter、capture、snapshot、policy 和 capability ownership。
