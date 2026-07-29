# 00. EnchantForge 定位、架构与开发规划

## 1. 文档状态

本文档定义 EnchantForge 当前阶段的产品定位、技术架构、公共 API、实施顺序和投入判定标准。后续详细规格应与本文档保持一致；如需改变核心方向，应先更新本文档中的架构决策。

本文档取代早期使用 `llm-ui`、`LlmIntegration`、`LlmAssistantBubble` 等工作名称形成的定位和命名讨论。

## 2. 项目定义

### 2.1 名称

- 项目名：`EnchantForge`
- Vue 包名：`@enchantforge/vue`
- 官网标题：`EnchantForge`
- 副标题：`A progressive runtime for metadata-aware UI integration`
- Slogan：`Wrap existing Vue UI. Make it agent-ready.`

### 2.2 公共概念

EnchantForge 的公共概念限定为以下五项：

| 概念 | 含义 |
| --- | --- |
| Forge | 应用级 EnchantForge 实例，管理 metadata、tools、policy 和安全执行机制 |
| Enchant | 包裹现有 Vue UI 的组件，建立边界、聚合 contribution 并管理生命周期 |
| Enchantment | Enchant 生成并注册的数据模型，保存 metadata、capability、状态和来源 |
| Aura | 消费 EnchantForge context/tools 的默认智能交互组件 |
| orb | Aura 的默认悬浮展示形态，不是独立的运行时概念 |

核心运行关系是：

```text
<Enchant> --produce--> Enchantment --register--> EnchantForge --export--> Agent Client
    Vue UI            metadata/capability         context / tools      app-owned protocol
    lifecycle         state/source                policy / executor         |
                                                                        Aura (optional)
```

Enchant、Enchantment 和 Aura 是公共产品语言。runtime、scope、registry、executor、capability 仍作为内部架构和高级扩展术语使用，不继续替换成魔法隐喻。

### 2.3 一句话定义

EnchantForge 是面向现有 Vue 应用的渐进式集成框架：它从组件和页面中提取实时元数据，将可执行能力约束为结构化操作，并向局部 AI 功能或全局 Aura 提供统一的读取、规划和执行接口。

### 2.4 边界

EnchantForge 解决的是“应用已经具备结构和业务能力，但这些结构不能被模型稳定读取和调用”的问题。它不负责替代现有应用，也不以通用视觉自动化为主要路径。

EnchantForge 是：

- Vue UI 与模型之间的语义和执行层；
- 随组件生命周期变化的 runtime metadata registry；
- 面向 UI 操作的受约束 executor；
- 可导出为 tools、skills、MCP capability 或应用内部命令的能力模型；
- 支持局部 AI 功能和全局 Aura 的公共基础设施。

EnchantForge 不是：

- 聊天组件 SDK；
- 依赖截图识别的通用 GUI Agent；
- 默认接管审批、支付、删除等高风险操作的自动化平台；
- 要求业务页面为模型重新编写一套 API 的工作流引擎；
- 以一个 Prompt 自动解决全部业务为目标的黑盒系统。

### 2.5 对 AI 能力的基本立场

EnchantForge 使用魔法语义建立品牌辨识度，但不以“魔法”掩盖模型边界。项目默认模型可以理解、规划和请求执行，但不具备事实权威、业务授权或未声明的页面能力。

信任顺序必须保持为：

```text
application state and business rules
  > policy and registered capabilities
  > adapter and metadata evidence
  > model execution plan
  > model natural-language explanation
```

由此产生以下设计约束：

- 应用是业务事实和最终状态的来源，模型输出不是 source of truth；
- 模型是受限的解释器和规划器，不是拥有隐含权限的自治主体；
- Enchantment 是带来源、状态、版本和暴露范围的有限模型，不代表整个应用；
- Aura 只聚合当前有效且 policy 允许的 Enchantment，不读取未注册页面，不被描述为全知；
- spell 是 instruction 的别名，不是可以绕过 schema、policy 或 executor 的命令；
- caster 是 agent 的别名，替换 agent 不会获得额外 capability；
- 所有执行都必须落到可枚举 capability，并经过目标、版本、参数和 policy 校验；
- 不确定性、失败和信息缺失必须保留为运行时状态，不能由文案包装成确定结论。

选择 Aura 而不是 Oracle、Prophet 或 CollectiveMind 之类名称，也是这一立场的体现：Aura 有明确来源、覆盖范围和生命周期；它会随着 Enchantment 的挂载、禁用和注销而变化。

## 3. 为什么值得投入

### 3.1 现有 UI 已包含可复用语义

Vue 业务系统中已经存在表单字段、标签、校验规则、按钮、菜单、弹窗、图表、表格、路由状态、权限状态和领域对象。它们目前主要服务于人工操作和页面内部代码。EnchantForge 的核心价值不是重新生成这些信息，而是把它们规范化为模型可读取、应用可审计、执行器可约束的运行时能力。

### 3.2 逐页手写 tools 不具备规模效应

为每个页面独立编写模型工具会导致：

- 接入成本随页面数量线性增长；
- 同类组件被重复建模，参数和行为不一致；
- Prompt、工具定义、执行逻辑与页面实现耦合；
- 模型和协议升级时需要逐页修改。

EnchantForge 应优先复用组件主动提供的 metadata、通用 composable 和 UI adapter，避免每个页面重复编写模型协议。DOM 自动提取只作为应用明确启用的兼容路径。

### 3.3 结构化接入比视觉自动化更适合内部系统

视觉 Agent 具有跨应用通用性，但在已有前端结构的系统中会额外引入定位不稳定、上下文开销、实例歧义、审计困难和组件内部状态不可见等问题。EnchantForge 优先使用 Vue contribution、UI adapter 和应用状态已经提供的结构；DOM scanner 与视觉能力都属于缺少稳定结构化信息时的显式 fallback。

### 3.4 产品价值的验证指标

- 现有页面完成首次接入所需的代码行数和人工配置量；
- 自动提取字段、动作和页面区域的覆盖率；
- metadata 被局部 AI 功能、全局 Aura 和调试工具复用的比例；
- 执行步骤中确定性步骤的占比；
- 失败能否定位到明确的 scope、capability、target 和参数；
- 页面切换、组件卸载和权限变化后 registry 是否准确；
- 引入 UI adapter 后业务页面是否不再重复编写集成代码。

## 4. 设计原则

### 4.1 Progressive 是首要约束

| 层级 | 使用方式 | 适用场景 | 需要理解的概念 |
| --- | --- | --- | --- |
| 基础接入 | wrapper + 组件 contribution | 文本填表、页面说明、区域高亮 | `Enchant`、`prompt`、高层 composable |
| 应用接入 | Forge + Aura | 多路由系统、统一模型配置、全局交互 | `createEnchantForge()`、policy、Aura |
| 深度扩展 | adapter、显式 capability、领域 executor | 复杂组件和关键流程 | metadata schema、executor、exporter |

最短接入路径必须保持为一个 import 和一个 wrapper：

```vue
<script setup lang="ts">
import { Enchant } from '@enchantforge/vue'
</script>

<template>
  <Enchant prompt="把用户提供的信息填入表单，不要提交">
    <EnchantExpressForm />
  </Enchant>
</template>
```

该示例不能要求使用者预先理解 registry、scope tree、execution plan 或 tool schema。

### 4.2 Metadata 是核心模型，tools 是导出格式

EnchantForge 内部不能直接使用某一家模型厂商的 tool calling schema 作为数据模型。核心模型应描述页面对象、实时状态、允许操作、executor、policy 和 trace。OpenAI-compatible tools、Prompt 命令目录、MCP capability 和应用内部 command 均由该模型转换得到。

### 4.3 Metadata 必须反映实时页面

registry 不能只在进入路由时生成静态快照。组件 mount/unmount、动态表单、弹窗、字段状态、路由、标签页、权限、策略和微应用状态变化都必须更新 metadata 或 capability。模型规划时使用某一版本的 snapshot；执行前必须重新确认目标仍存在、允许调用且 capability 合约未改变。

### 4.4 稳定结构优先，DOM 扫描显式启用

元数据来源按以下顺序合并，后者可以补充或覆盖前者：

1. wrapper props、composable 和应用显式 contribution；
2. UI 框架 adapter；
3. 标记区域的 DOM scanner；
4. 明确启用的全局部 DOM fallback。

### 4.5 规划与执行分离

模型负责将自然语言转换为结构化计划；executor 负责校验并执行操作。模型不能获得任意 DOM 脚本执行权限。每个步骤至少记录 capability id、scope、实例标识、参数、规划 snapshot provenance、policy 结果和执行结果。

## 5. 总体架构

```text
Vue component / DOM / application store
                  |
                  v
        Scanner and UI adapters
                  |
                  v
        Metadata normalization
                  |
                  v
      App-owned reactive registry <------ route / permission / policy
          |             |     |
          |             |     +--------> debug / snapshot / telemetry
          |             +--------------> capability exporters
          |                                  | tools / skills / MCP
          v
     context builder
          |
          v
   LLM client / planner
          |
          v
 structured execution plan
          |
          v
 policy check -> executor router -> DOM / adapter / domain action
```

建议包边界：

```text
@enchantforge/vue
  createEnchantForge
  Enchant wrapper
  Enchantment data model
  registry and lifecycle
  metadata scanner
  executor runtime
  Aura and interaction primitives
  debugging hooks

@enchantforge/adapter-ant-design-vue      # 独立子项目，未来按需提供
  form / input / select / modal / table adapters

examples/vue
  canonical examples and debug UI

website
  documentation and example entry
```

Core 不暂存 Ant Design Vue 等业务组件 adapter。即使首批只支持少量组件，也通过独立子项目管理版本和依赖边界。

## 6. 公共 API

### 6.1 命名

| 能力 | 公共名称 | 说明 |
| --- | --- | --- |
| 应用工厂 | `createEnchantForge()` | 创建可安装到 Vue app 的 Forge 实例 |
| wrapper | `Enchant` | 建立局部边界，聚合 contribution，并生成 Enchantment |
| 数据模型 | `Enchantment` | 描述一次局部 UI 增强的实时 metadata 和 capability |
| 全局智能层 | `Aura` | 聚合有效 Enchantment，并提供默认交互界面 |
| 局部 runtime | `useEnchant()` | 在当前 `Enchant` 边界内读取 context 并执行能力 |
| 应用 runtime | `useEnchantForge()` | 获取当前 Vue app 安装的 Forge |
| page | `useEnchantPage()` | 获取当前页面 snapshot 和能力 |
| registry | `useEnchantRegistry()` | 扩展和调试 API，不进入首个示例 |

`Aura` 描述 Enchantment 聚合后形成的全局能力，不描述具体 UI。orb、dock 和 inline 是 Aura 的展示形态；第一阶段默认实现 orb。

### 6.2 应用级注册

```ts
import { createApp } from 'vue'
import { createEnchantForge } from '@enchantforge/vue'
import App from './App.vue'

const forge = createEnchantForge({
  llm: {
    endpoint: import.meta.env.VITE_LLM_API_BASE,
    apiKey: import.meta.env.VITE_LLM_API_KEY,
    model: import.meta.env.VITE_LLM_MODEL
  }
})

createApp(App)
  .use(forge)
  .mount('#app')
```

plugin 负责：

- 为每个 Vue app 创建独立 registry，避免测试、SSR 和多应用串扰；
- 提供 LLM client、policy、adapter 和 telemetry 配置；
- 管理 Enchantment 注册、路由状态和 Aura 会话；
- 提供 injection key 和 composable 上下文。

未通过 `app.use()` 安装 Forge 时，`Enchant` 可以创建局部 fallback runtime，以支持最小示例和组件内部集成。fallback runtime 不跨应用共享，其 Enchantment 也不自动加入应用级 Aura。

### 6.3 Enchant API

```vue
<Enchant
  name="shipping-form"
  prompt="把用户提供的信息填入表单，不要提交"
  exposure="aura"
>
  <ExpressForm />
</Enchant>
```

| 属性 | 作用 | 默认值 |
| --- | --- | --- |
| `name` | 开发者可读名称，不承担全局唯一性 | 自动生成 |
| `prompt` | 局部语义或任务约束的标准属性 | 空 |
| `spell` | `prompt` 的主题化别名 | 空 |
| `scan` | `none`、`marked`、`auto` 或细粒度扫描配置 | `none` |
| `exposure` | `aura`、`local` 或 `private` 暴露范围 | Forge policy 默认值 |
| `registerGlobal` | 兼容开关；设为 `false` 时强制限制为 `local` | 未设置 |
| `agentId` | 当前边界默认使用的 Agent Client 标识 | 继承父边界 |
| `state` | capture 时读取的响应式状态或 getter | 空 |
| `metadata` | 显式补充自动 metadata | 空 |
| `capabilities` | 由当前边界明确提供的能力 | 空 |

复杂 executor、exporter 和 adapter 配置通过 plugin、composable 或扩展 API 提供，不持续增加 wrapper props。

`prompt` 和 `spell` 进入 runtime 前统一归一化为 Enchantment instruction。两者同时提供时使用 `prompt`，开发模式下对不同值给出警告；不得拼接两者。

### 6.4 Aura API

```vue
<template>
  <RouterView />
  <Aura appearance="orb" />
</template>
```

Aura 默认使用 orb 形态呈现可拖动的悬浮入口，并在展开后承载输入、计划确认、执行进度和结果。展示形态不参与 metadata 和 capability 建模。

| 属性 | 作用 | 默认值 |
| --- | --- | --- |
| `appearance` | `orb`、`dock` 或 `inline` 展示形态 | `orb` |
| `agent` | 覆盖 Forge 默认 agent | Forge agent |
| `caster` | `agent` 的主题化别名 | 空 |
| `agentId` | 由应用 resolver 映射到指定 Agent Client | 空 |
| `open` / `defaultOpen` | 受控或非受控的展开状态 | `false` |
| `initialMessages` | 恢复应用持久化的会话消息 | 空 |
| `historyLimit` | 发送给 Agent 的最近会话消息数量 | `20` |
| `clearOnPageChange` | 页面标识变化时取消运行并清空会话 | `true` |
| `markdown` | 使用 Aura 的安全 Markdown renderer 展示助手消息 | `true` |

显式 `agent` 或 `caster` 优先于 `agentId`；没有显式 client 时由 Forge 解析 `agentId`，未设置 ID 才使用默认 Agent Client。无法解析显式 ID 时直接报错。caster 不定义新的 agent 类型、生命周期或协议。

Aura 的默认系统 Prompt 只描述稳定协议：如何读取 snapshot、选择 capability、输出计划和停止执行。具体页面能力由当前 registry 动态提供，不能将数百个页面的说明预先拼入固定 Prompt。

应用可覆盖 LLM client、system instructions、context builder、tool exporter、plan parser、approval handler 和 Aura UI，也可以绕过 Aura/内置 runner，直接消费 `captureContext()` 并调用 `executeTool()`。

Aura 组件实例提供 `open()`、`close()`、`toggle()`、`focus()`、`submit()`、`cancel()`、`clear()` 和 `getMessages()`，支持应用显式接入 ASR、快捷命令和会话持久化。组件事件只报告交互生命周期；任何页面 effect 仍必须通过 Forge capability 和 policy 执行。

## 7. Metadata 与 Capability

### 7.1 Metadata node

```ts
interface EnchantMetadataNode {
  id: string
  kind: 'page' | 'region' | 'form' | 'field' | 'action' | 'table' | 'chart' | 'dialog'
  name?: string
  label?: string
  description?: string
  value?: unknown
  state: {
    visible: boolean
    enabled: boolean
    active?: boolean
    validation?: 'valid' | 'invalid' | 'pending'
  }
  source: {
    scopeId: string
    adapter?: string
    component?: string
  }
  capabilities: string[]
  children?: EnchantMetadataNode[]
}
```

第一阶段不必实现全部字段，但必须保证节点具有唯一实例标识、来源、状态和 capability 引用。同一组件可能重复渲染，执行目标不能只依赖组件名或字段名，而应组合 runtime id、page id、scope id、node id 和 capability contract。

### 7.2 Capability

```ts
interface EnchantCapability<TInput = unknown, TResult = unknown> {
  id: string
  name: string
  description: string
  target: string
  inputSchema: JsonSchema
  effect: 'read' | 'visual' | 'draft' | 'commit'
  execute(input: TInput, context: ExecutionContext): Promise<TResult>
}
```

`effect` 用于 policy 和审批判断：

- `read`：读取 metadata 或页面数据；
- `visual`：高亮、聚焦、打开只读视图；
- `draft`：填表、设置筛选条件、生成待提交内容；
- `commit`：提交、删除、审批、支付等产生持久影响的操作。

第一阶段实现 `read`、`visual` 和 `draft`，但模型中保留 `commit`，避免后续使用零散布尔值扩展安全边界。

## 8. Metadata 提取

### 8.1 DOM scanner（显式启用）

`scan="marked"` 只读取 directive 登记的节点或区域；`scan="auto"` 扫描当前 Enchant 拥有的整个局部 DOM 边界。两者默认均不启用。基础 scanner 只依赖浏览器公开 API，并将结果标记为低于显式 contribution 和稳定 adapter 的置信来源。

仅修改 DOM property 或派发原生事件不一定能更新 Vue 组件状态，因此“发现元素”和“可靠执行”必须分开建模。

### 8.2 Ant Design Vue adapter

adapter 是从 POC 走向可用产品的关键投入。首批支持：

- `a-form` / `a-form-item`；
- `a-input` / `a-input-number` / `a-textarea`；
- `a-select` / `a-cascader` / `a-date-picker`；
- `a-button`；
- `a-modal` / `a-drawer`；
- `a-table`；
- ECharts 容器和实例。

adapter 提供标准 metadata 和 capability，业务页面不应针对同一种组件重复注册。

### 8.3 显式扩展

```vue
<a-button
  v-enchant-action="{
    name: 'saveDraft',
    effect: 'draft',
    description: '保存当前工单草稿'
  }"
>
  保存草稿
</a-button>
```

```ts
useEnchantCapability({
  name: 'prepareRepairTicket',
  effect: 'draft',
  inputSchema,
  execute: prepareRepairTicket
})
```

显式扩展是稳定性出口，不是所有页面的前置要求。

## 9. Registry 与状态管理

正式实现使用 app-owned registry，不以模块级全局单例作为唯一状态源。这样才能隔离多个 Vue app、SSR 请求、单元测试和微应用。

registry 至少维护：

- 当前 app、page 和 route；
- 已挂载 scope 及父子关系；
- metadata tree 和扁平 node index；
- capability index；
- 当前 policy 和 metadata version；
- Aura session 和 execution trace；
- adapter 和 exporter 注册表。

树结构表达页面语义，扁平索引用于按 id 定位和导出 tools，两者同时维护。

模型调用前由 registry 生成不可变 snapshot。snapshot version 只标识本次规划上下文；执行时 runtime 重新定位 capability，目标移除或合约改变才拒绝该步骤。

应用可显式注入 Pinia 或领域状态，但不能默认序列化整个 store：

```ts
useEnchantState('ticket-context', () => ({
  selectedTicketId: ticketStore.selectedId,
  operatorRole: authStore.role,
  workflowState: ticketStore.workflowState
}))
```

## 10. Executor

| 类型 | 目标 | 优点 | 局限 |
| --- | --- | --- | --- |
| DOM executor | 原生元素和简单组件 | 零配置、覆盖快 | 组件语义弱，可靠性有限 |
| Adapter executor | Ant Design Vue、ECharts 等 | 正确处理 `v-model`、弹层和内部状态 | 需要维护版本兼容性 |
| Domain executor | 应用显式业务函数 | 语义稳定、可测试、适合关键流程 | 存在接入成本 |

executor router 根据 capability 来源选择实现。应用可以覆盖 executor，但 capability id、输入 schema 和 trace 格式保持一致。

表单写入需要逐步覆盖类型转换、Vue `v-model`、change/blur 联动、字段校验和写入后确认。默认不触发表单提交。复杂性应由 runtime 或 adapter 吸收，不能转嫁到每个示例页面。

effect 只描述影响级别，不决定功能归属。DOM 高亮、聚焦和滚动可以由通用 Adapter 实现；打开 panel 和组合 dashboard 修改应用拥有的视图状态，必须由 Focus View 注册应用级 capability。两者复用统一 capability 协议、policy 和 trace，不复用业务 executor。

## 11. Tool、Skill 与 MCP 导出

tool calling 只是 capability 的一种序列化方式：

```ts
interface CapabilityExporter<T> {
  export(snapshot: EnchantSnapshot, options?: ExportOptions): T
}
```

首批 exporter：

- `OpenAICompatibleToolExporter`：输出 function tools；
- `PromptCatalogExporter`：供不支持 tool calling 的模型使用；
- `DebugExporter`：输出完整 metadata 和 capability。

MCP 或 skill descriptor 在内部模型稳定后增加，不在第一阶段绑定协议细节。

数百个页面不能一次性全部导出。上下文构建分两步：先导出当前页面、激活 scope 和全局导航能力；打开目标页面后 registry 更新，再导出新页面的局部能力。后续可加入 capability 摘要、按 kind 过滤、语义检索和延迟展开。

## 12. LLM 集成

第一阶段原生支持 OpenAI-compatible API，包括 endpoint、model、apiKey、自定义 headers、普通 content、JSON 结果、tool calling、timeout、abort 和错误标准化，同时允许应用替换 transport 或完整 client。

简单场景只传 `prompt` 或其别名 `spell`，再提供用户输入；模型配置、metadata context 和 tool schema 由 runtime 组装。

Prompt 分为：

- runtime protocol：库维护的输出协议和执行约束；
- Enchantment instruction：wrapper 的 `prompt` 或 `spell` 归一化结果；
- user input：用户自然语言输入。

metadata snapshot、capability catalog 和 knowledge context 作为结构化上下文加入，不要求业务开发者手写拼接。

LLM client、planner、parser 和 exporter 通过接口隔离，使应用可以接入内部 Agent 平台而继续复用 registry 和 executor。

## 13. Knowledge

metadata 描述页面对象和实时状态；knowledge 描述业务含义、规则和处理方法。两者不能合并为不可追踪的长文本。

knowledge 可以来自 wrapper 短说明、字段和 action 的领域描述、用户手册、应用检索函数或当前业务对象的知识片段。provider 应返回带来源标识的片段并写入 trace。第一阶段定义扩展接口，不内置完整 RAG 系统。

## 14. Policy

即使 POC 暂不实现完整风险控制，架构中也必须保留统一 policy 层，否则后续会在每个组件中出现不一致的权限判断。

policy 输入至少包括 capability effect、scope、页面策略、用户权限、业务状态、Aura 交互模式和确认状态。常见策略包括：

- 允许解释，禁止执行；
- 允许读取和高亮，禁止修改；
- 允许填写草稿，禁止提交；
- 允许局部 AI 功能读取，禁止 Aura 聚合；
- 某个业务状态下临时禁用 action。

policy 决策必须发生在 executor 调用前并写入 trace。Prompt 中的“不要提交”是模型约束，不是权限控制。

## 15. 调试、重放与可观测性

任何自动操作都应能回答：模型看到了什么、选择了什么、runtime 执行了什么、页面最终变成什么状态。

第一阶段调试能力：

- 当前 metadata tree；
- capability/tool list；
- 实际发送给模型的 context；
- 解析后的 execution plan；
- 每个步骤的输入、结果、耗时和错误；
- 执行前后关键 metadata diff。

当前已经通过独立入口 `@enchantforge/vue/otel` 提供 OpenTelemetry Adapter。后续增加语义 snapshot、确定性步骤重放、确认点恢复、Vue Devtools 和自定义 audit sink。trace 默认不得记录密码、token 和完整个人敏感信息，metadata schema 需要字段级 redact 配置。

## 16. 微前端

qiankun 等环境中不建议主应用直接访问子应用 DOM 或共享 registry：

- 子应用维护本地 metadata、capability 和 executor；
- 子应用向主应用发布经过过滤的 scope 摘要；
- 主应用助手发送结构化请求；
- 子应用重新执行本地 policy 并调用 executor；
- 执行结果和 trace 摘要返回主应用。

第一阶段只定义 runtime bridge 协议，不实现完整微前端支持。

## 17. 示例策略

示例用于证明公共 API，不用于展示全部内部实现：

- 页面展示代码与真实运行逻辑一致；
- 首个代码片段是最短可信接入路径；
- 业务组件代码可单独查看，证明原组件没有隐藏集成逻辑；
- registry、metadata、tools 和 trace 放入默认关闭的调试抽屉；
- 复杂兼容和容错逻辑下沉到 `@enchantforge/vue`；
- 不为演示动画引入示例专用执行框架。

首批 canonical examples：

1. Text to Form：从非结构化收件信息填充快递表单，不提交；
2. Focus View：高亮、聚焦、打开或组合监控 panel；
3. Menu Navigation：打开页面后读取新页面动态注册的 capability；
4. Validation Explanation：聚合校验错误并定位字段；
5. Assisted Ticket Creation：从 ASR 文本提取信息并生成待确认工单。

## 18. 实施路线

### Phase 1：核心闭环

目标：证明 wrapper-first 边界、组件 contribution 和可选 DOM fallback 可以共用同一运行时。

交付：`@enchantforge/vue`、`Enchant`、`Enchantment` 数据模型、原生表单扫描、app-owned registry、基础 DOM executor、OpenAI-compatible client、`Aura` 的 orb 形态、Text to Form、Focus View 和调试抽屉。

验收：普通 Vue 表单通过高层 composable 或 UI adapter 提供能力；懒惰接入示例可以显式使用 `scan="auto"`；mount/unmount 后 registry 无残留；示例不包含独立模型协议和计划解析；默认 capability 不能提交表单。

### Phase 2：应用级运行时

目标：支持多路由真实应用。

交付：`createEnchantForge()`、injection-based runtime、路由和标签状态同步、policy store、snapshot version、原子 Context Bundle、capability exporter、Agent Client resolver、execution trace 和自定义 LLM client。

验收：多个 app 和测试实例 registry 隔离；页面切换后只导出当前能力和导航能力；旧 snapshot 目标失效时拒绝执行；应用可切换 read-only、draft-only 和 disabled。

### Phase 3：组件适配与显式能力

目标：提高复杂 UI 的提取率和执行可靠性。

交付：Ant Design Vue adapter、ECharts adapter、directive/composable 注册、select、cascader、date picker、modal、drawer、table、knowledge provider 和 domain executor。

验收：常用表单组件无需逐字段注册；adapter 写入与 `v-model` 一致；动态字段和弹层正确进入、退出 registry；显式 capability 可以覆盖自动执行且保留统一 trace。

### Phase 4：工程化集成

目标：形成可在多个业务系统复用的基础设施。

已交付：OpenTelemetry Adapter。规划交付：Vue Devtools、execution replay、semantic snapshot、workflow persistence、micro-app bridge 和 MCP/skill exporter。

## 19. 主要风险

| 风险 | 结果 | 处理策略 |
| --- | --- | --- |
| 自动扫描覆盖不足 | 仍需大量手写 metadata | 优先建设 UI adapter；保留 directive/composable |
| DOM 执行不可靠 | 页面显示与 Vue 状态不一致 | scanner 与 executor 分离；复杂组件走 adapter |
| 重复实例定位冲突 | 操作错误组件 | runtime + scope + node + snapshot version |
| tools 随页面膨胀 | token 和选择错误增加 | 当前页面导出、延迟发现、语义过滤 |
| POC 逻辑污染 API | 后续无法兼容 | 先抽象 capability 和 executor，再提升示例逻辑 |
| 绑定单一模型协议 | 更换模型成本高 | 内部 capability model + exporter |
| 全局单例串扰 | SSR、测试、微应用异常 | plugin/provider 拥有 runtime |
| Prompt 被当作权限 | 高风险操作越界 | 独立 policy、effect 和 executor 检查 |
| trace 泄露数据 | 无法满足审计要求 | 字段级 redact 和可配置 audit sink |
| 范围持续扩张 | 核心无法稳定 | Phase 1 只验证 metadata、capability、executor、Aura |

## 20. 可行性论证

EnchantForge 第一阶段不解决通用 GUI 理解，而是将问题限制为：运行环境是 Vue；页面结构优先由 component contribution 和 adapter 提供，必要时由应用显式启用 DOM scanner；操作对象是当前挂载且由 policy 暴露的 capability；模型输出结构化计划；executor 只执行已注册能力；首批场景限于 `read`、`visual` 和 `draft`。

Vue 生命周期、依赖注入、响应式 store、JSON Schema、OpenAI-compatible API、UI adapter 和 OpenTelemetry 均有成熟工程基础。主要不确定性是自动 metadata 质量、adapter 覆盖率和模型规划稳定性，而不是底层技术可实现性。

POC 需要验证三个假设：

1. 常见 Vue 组件能否通过高层 composable 或 UI adapter 以很小改动提供足够可用的 metadata；
2. 通用 capability 能否覆盖填表、高亮、打开和导航等高频交互；
3. 复杂性能否下沉到 runtime，使业务接入代码长期保持短小。

如果必须为每个页面手写大量工具和计划解析代码，说明 wrapper-first 尚未成立，应修正 runtime，而不是继续增加示例。

## 21. 投入判定

建议按可验收阶段开始投入，不一次性建设完整 Agent 平台。继续投入的前提是公司现有系统以 Vue 为主、目标是降低多个应用的 AI 接入成本、接受结构化 UI 集成优先于纯视觉通用性，并将安全、审计和可观测性作为 runtime 能力建设。

需要停止或调整方向的信号：

- wrapper 无法低侵入提取基础字段和 action；
- 常用 UI 组件必须逐实例手写 executor；
- 模型必须依赖页面专用长 Prompt 才能稳定运行；
- registry 无法准确反映动态页面生命周期；
- 示例代码持续增长，可复用 runtime 没有同步收敛。

## 22. 下一步

1. 将公共 API 和示例迁移到 `createEnchantForge()`、`Enchant`、`Enchantment`、`Aura`；
2. 定义 app-owned runtime、registry、snapshot 和 capability 的最小 TypeScript 接口；
3. 将模块级 registry 改为 plugin/provider 创建并通过 injection 获取；
4. 保留无 plugin 时的局部 fallback runtime；
5. 将 Text to Form 和 Focus View 的通用规划、导出和执行逻辑收敛到 `@enchantforge/vue`；
6. 以 Ant Design Vue 表单组件为第一批 adapter，测量自动提取和可靠写入覆盖率；
7. 为 metadata、tool export、execution plan 和 executor 增加统一 trace；
8. Phase 1 验收前不扩展高风险 `commit` 操作和完整微前端实现。
