# 06. Aura 交互

## 1. 定义

Aura 是当前有效 Enchantment 聚合后形成的全局智能交互层。Enchantment 由页面中的 Enchant 组件生成。Aura 不是“帮助开发者附魔的助手”，也不是一个通用聊天窗口。

Aura 的可用上下文来自：

- 当前挂载且允许全局暴露的 Enchantment；
- Forge 提供的页面、路由和应用状态；
- policy 允许读取的 metadata 和 capability；
- 当前任务需要的 knowledge；
- 本次会话和 execution trace。

## 2. 展示形态

第一阶段默认使用 orb：

```vue
<Aura appearance="orb" />
```

接入自定义 agent 时，`agent` 是标准属性，`caster` 是等价别名：

```vue
<Aura :caster="agent" appearance="orb" />
```

两者同时存在时使用 agent。Aura 内部只保存一个归一化后的 agent 引用，caster 不改变 agent protocol。

### 2.1 组件 API

Aura 提供默认交互界面，但不能把应用锁定在鼠标点击路径中。应用可以受控展开面板，也可以通过组件实例接入 ASR、快捷命令和其他显式业务事件：

```vue
<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import Aura, { type AuraInstance } from '@enchantforge/vue/aura'

const open = ref(false)
const aura = useTemplateRef<AuraInstance>('aura')

function inspectCurrentPage() {
  aura.value?.open()
  void aura.value?.submit('分析当前页面中的异常指标')
}
</script>

<template>
  <Aura ref="aura" v-model:open="open" @complete="handleComplete" />
</template>
```

组件实例提供：

| 方法 | 作用 |
| --- | --- |
| `open()` / `close()` / `toggle()` | 控制展示状态 |
| `focus()` | 聚焦输入框 |
| `submit(message?)` | 提交输入框或外部文本，并返回本次运行结果 |
| `cancel()` | 取消当前运行，不清空已有消息 |
| `clear()` | 取消当前运行并清空当前会话 |
| `getMessages()` | 读取可持久化的成功会话消息副本 |

关键事件包括 `submit`、`complete`、`error`、`cancel` 和 `clear`。`initialMessages` 用于恢复已有会话，`historyLimit` 限制发送给 Agent 的最近消息数量。会话持久化介质由应用决定，Core 不默认读写本地存储或远端数据库。

`clearOnPageChange` 默认为 `true`，避免路由切换后旧页面对话被误用于新页面。需要跨页面保留交互记录时，应用可以显式关闭，并自行决定哪些历史消息仍适合进入 Agent 上下文。

### 2.2 消息渲染

Ant Design X Vue 的 Bubble 提供 `messageRender` 和消息插槽，但不内置 Markdown parser。Aura 默认通过自己的安全 renderer 展示助手 Markdown，支持段落、列表、强调、链接、引用、表格和代码块；用户输入仍作为纯文本展示。

原始 HTML、可执行链接和远程图片默认不渲染，避免把模型输出直接作为不受约束的 HTML 注入页面。应用可以传入 `:markdown="false"` 关闭默认 Markdown，或使用 Aura 的 `#message` 插槽完全替换消息展示。

orb 负责：

- 以悬浮入口常驻；
- 支持拖动和位置记忆；
- 显示未读、运行中和需要确认等状态；
- 展开输入和消息面板；
- 收起后不遮挡主要业务区域。

orb 是 Aura 的 presentation。未来增加 dock、drawer 或 inline 时，metadata、planner 和 executor 不发生变化。

默认 orb 是圆形水晶球入口，不显示横向产品名称。位置使用独立 anchor 持久化；聊天面板从 anchor 向左上方展开，关闭后 orb 必须回到原 anchor。用户可以通过 `orb` component 或 `#orb` slot 替换视觉实现，拖动、定位和点击行为仍由 Aura 管理。

## 3. 交互来源

Aura 可以由以下事件触发：

- 用户输入自然语言；
- ASR 或其他 AI pipeline 传入文本；
- 应用显式发送业务事件；
- 连续校验失败；
- 长时间反复滚动但未完成操作；
- capability 或页面状态发生需要提示的变化。

行为识别必须由应用或独立规则提供信号。Aura 不在第一阶段内置通用用户行为推断系统。

## 4. 核心交互

### 4.1 主动建议

```text
检测到当前通话正在描述漏水问题。
是否根据已识别信息创建维修工单草稿？

[创建草稿] [忽略]
```

### 4.2 文本填表

```text
收件人      张三
手机号      12233322112
省市区      广东省 / 揭阳市 / 榕城区
详细地址    XX街道23号楼902
物品        手机
```

字段映射和页面写入应直接可见；不确定字段需要高亮并等待确认。默认停止在草稿状态。

### 4.3 校验解释

```text
当前有 3 个字段未通过校验：
手机号格式不正确
详细地址缺少门牌号
物品类型未选择
```

可执行动作包括高亮全部错误、定位第一个错误和根据用户输入修正字段。

### 4.4 可视化执行

```text
1. 打开维修工单页面
2. 填写联系人和联系电话
3. 设置故障地址
4. 生成故障描述草稿
5. 等待用户确认
```

步骤展示来自统一 execution progress event，不能由示例页面维护另一套动画计划，也不伪造模型思维链。基础阶段为 capture、planning、authorizing、executing、completed/failed；capability 可以通过 execution context 上报真实子步骤。

进度文案由 runtime phase 映射，不由 LLM 临时生成。Aura 提供 `progressMessages` 配置和 `#progress` slot，允许应用替换为领域或主题文案。最终助手消息必须使用 executor 结果兜底，不能渲染空消息。

一个计划可以同时包含读取和界面操作。例如 Dashboard 应用可以要求分析问题同时调用 `dashboard.read_data` 和 `dashboard.highlight`，Forge 会按计划执行两项 capability，再基于真实读取结果生成回答。Core 只提供组合执行机制，不自行推断哪个业务 Panel 应成为证据；该语义由应用 prompt 和 capability description 声明。

如果后续操作的参数必须依赖前一个 capability 的返回值，则不能伪装成同一轮静态计划。此类场景需要独立的多阶段 Tool Loop 规格，包括调用上限、重复调用检测、每阶段 policy 和确认点；在该机制落地前，应用应只组合规划前即可确定参数的操作。

## 5. 快捷建议

快捷建议根据当前 snapshot 和 capability 动态生成，不维护覆盖全部页面的固定列表。

空会话中，建议作为主要起始入口展示；已有对话中，建议保留在输入区附近作为继续提问入口。Aura 不能要求用户先清空会话才能选择另一个建议。运行期间可以暂时隐藏或禁用建议，运行结束后应恢复。

示例：

- 填写当前表单；
- 解释提交失败原因；
- 高亮内存相关图表；
- 创建维修工单草稿；
- 恢复分享视图。

## 5.1 连续会话

Aura 会把限定数量的已完成用户消息和助手消息作为 `history` 传给 Agent，以支持“它的准点率呢”一类连续追问。历史消息与每次运行重新 capture 的页面结构共同进入模型请求，但边界不同：

- history 只帮助模型理解语言上下文；
- 当前 snapshot 仍是页面结构和 capability 的唯一运行时来源；
- history 不修改 registry version，不作为 capability 存在、权限或业务事实的证据；
- 失败消息不进入后续模型上下文；
- 清空会话会中止当前请求，迟到的进度和结果不得写入新会话。

`EnchantRunOptions.history` 和 `EnchantAgentRequest.history` 是低层扩展点。自定义交互界面可以复用同一契约，不必依赖 Aura 的消息组件。

## 6. 确认边界

| effect | 默认交互 |
| --- | --- |
| `read` | 可直接执行 |
| `visual` | 可直接执行并展示结果 |
| `draft` | 可执行，但必须形成可检查的中间状态 |
| `commit` | 默认禁用；启用后仍由 policy 决定是否确认 |

Prompt 中的“不要提交”用于约束模型计划，executor policy 才是实际权限边界。

## 7. 状态反馈

Aura 至少展示：

- 当前使用的页面和 Enchantment 范围；
- 是否仅使用局部上下文；
- 当前计划和执行步骤；
- 等待用户确认的参数；
- 不确定字段和失败原因；
- 最终 action result。

调试信息不在默认面板展开。metadata tree、tools、原始模型请求和完整 trace 进入独立 debug drawer。

## 8. 非目标

- 不把 Aura 设计成通用问答聊天窗口；
- 不暗示 Aura 可以读取未注册页面或绕过 policy；
- 不把 orb 形态扩展成独立的吉祥物系统；
- 不通过复杂动效掩盖不可审计的执行过程。
