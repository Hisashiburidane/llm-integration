# 03. Vue 架构

## 1. 技术方向

EnchantForge 第一阶段只提供 Vue SDK。公共 API、文档和 canonical examples 均使用 Vue，不在当前产品叙事中引入跨框架抽象。

## 2. 包结构

```text
@enchantforge/vue
  Vue plugin、Enchant、Enchantment、Aura、metadata、executor 和扩展接口

@enchantforge/adapter-ant-design-vue
  Ant Design Vue metadata 与 executor adapter

@enchantforge/adapter-element-plus
  后续可选的 Element Plus adapter
```

`@enchantforge/vue` 不直接封装 Ant Design Vue。未来若提供 Ant Design Vue metadata/executor adapter，必须在独立的 `@enchantforge/adapter-ant-design-vue` 子项目中实现，避免业务组件依赖进入 Core。Aura 可以保留 `ant-design-x-vue` 作为交互层依赖，但这不代表 Core 提供 Ant Design Vue 组件适配 API。

包提供 ES module 子入口以保持 tree shaking：

```ts
import { createEnchantForge } from '@enchantforge/vue/core'
import Enchant from '@enchantforge/vue/enchant'
import Aura from '@enchantforge/vue/aura'
import { createEnchantDebug } from '@enchantforge/vue/debug'
```

根入口仍保留完整 API 兼容性；`core` 不引入 Aura、Debug overlay 或 Ant Design X，组件和调试能力只有从对应入口使用时才进入应用构建。`aura` 入口才引入 `ant-design-x-vue`。

## 3. 应用级 Forge

`createEnchantForge()` 创建当前 Vue app 使用的 EnchantForge 实例：

```ts
import { createEnchantForge } from '@enchantforge/vue'

const forge = createEnchantForge({
  llm: {
    endpoint,
    apiKey,
    model
  }
})

app.use(forge)
```

Forge 负责：

- 创建与 Vue app 绑定的 registry；
- 提供 policy、adapter、exporter 和可选的默认 Agent Client；
- 聚合当前挂载的 Enchant registration；
- 按需 capture Enchantment、metadata snapshot 和 capability index；
- 导出协议无关的页面 context 和 tools；
- 校验并执行 Agent Client 返回的 tool call；
- 发布 trace、snapshot 和审计事件。

Forge 是公共产品概念；底层实现仍可使用 runtime、registry、store 和 injection key 等技术术语。`forge.run()` 是内置 Agent Client 和有界 Tool Loop 的便利入口，不代表 Forge 垄断 LLM 调用。业务组件可以只消费 context/tools，并自行连接其他前端或后端 Agent 协议。

## 4. Enchant 与 Enchantment

`Enchant` 是包裹现有 Vue UI 的增强组件：

```vue
<Enchant prompt="根据用户输入填写当前表单，不要提交">
  <EnchantShippingForm />
</Enchant>
```

职责：

- 建立局部 contribution 和可选扫描边界；
- 聚合字段、动作、区域和状态；
- 接收 prompt/spell、metadata 和 knowledge 补充；
- 随 Vue 生命周期注册、刷新和注销；
- 注册惰性 capture source，默认不访问 DOM，也不维护完整 Enchantment 副本；
- 根据 exposure 和 policy 决定是否加入 Aura。

`Enchantment` 是一次 capture 生成的数据模型，不是 Vue 组件，也不是 registry 中持续维护的 store。registry 保存 registration、生命周期状态和 capture 函数；agent 调用时解析当前 contribution、响应式 state 和 capability。只有 `scan` 被明确启用时才读取 DOM。

`prompt` 是标准属性，`spell` 是等价别名。两者同时存在时使用 prompt；runtime 只保存归一化后的 instruction，不在 Enchantment 中保留两份配置。

### 4.1 暴露范围

```ts
type Exposure = 'aura' | 'local' | 'private'
```

- `aura`：允许应用级 Aura 读取经过 policy 过滤的 metadata 和 capability；
- `local`：仅当前 Enchant 边界内的 AI 功能可访问；
- `private`：可以参与本地确定性逻辑，默认不发送给模型。

基础示例默认使用 `aura`，使全局交互开箱可用。敏感组件应显式切换为 `local` 或 `private`。

## 5. Aura

`Aura` 是消费 EnchantForge context/tools 的默认应用级交互组件：

```vue
<template>
  <RouterView />
  <Aura appearance="orb" />
</template>
```

职责：

- 接收用户输入，或由应用通过组件 API 提交外部文本；
- 常驻时只读取轻量 registry digest，执行前按需生成当前 snapshot；
- 调用指定的 Agent Client 或 Forge 默认便利 runner；
- 展示计划确认、执行进度和结果；
- 在路由和组件生命周期变化后，下次执行自动 capture 新 snapshot。

`appearance="orb"` 是第一阶段默认的可拖动悬浮入口。Aura 的语义能力不依赖 orb；后续可以增加 dock 或 inline 形态。

Aura 不拥有 metadata、Agent 或执行流程。它可以被替换，也不应成为 ASR、业务事件和后台 Agent Client 调用 Core 的必经入口。

### 5.1 应用状态同步

Forge 不依赖 Vue Router，但为路由、标签页和微应用提供统一的当前上下文入口。应用在路由或标签页变化时同步状态，下一次 capture 会使用新的页面过滤条件和 snapshot version：

```ts
forge.syncNavigation({
  page: route.name?.toString(),
  route: route.fullPath,
  tab: activeTab,
  tags: ['operations']
})
```

也可以用 `forge.bindNavigation(refOrGetter)` 绑定应用自己的响应式路由状态。Forge 不执行导航，也不把业务路由器放进 Core；应用拥有的导航 capability 可以和当前页面的 capability 一起通过普通 `Enchant` 注册。

### 5.2 Policy、Exporter 与自定义 Client

Policy 是应用级可变运行状态，切换后会递增 registry version。snapshot version 用于 provenance 和 debug；执行时按 capability 合约、当前生命周期和 policy 重新校验，不按全局版本号拒绝：

```ts
forge.configurePolicy({ mode: 'read-only' })
forge.configurePolicy({ mode: 'draft-only' })
forge.configurePolicy({ mode: 'disabled' })
```

低层调用先用 `captureContext()` 原子获取模型结构、tools 和执行所需 snapshot：

```ts
const bundle = forge.captureContext({ scope: 'page' })
const calls = await internalAgent.plan({
  context: bundle.context,
  tools: bundle.tools,
  input
})

for (const call of calls) {
  await forge.executeTool(call, { snapshot: bundle.snapshot })
}
```

`context` 不包含 snapshot version、registry、`agentId`、字段当前值或业务数据。实时数据由 read capability 返回。`snapshot` 只留给控制和执行链，不应默认序列化给模型。

`forge.exportCapabilities()` 保留为“capture 后直接导出”的便利 API；`forge.exportSnapshot()` 可以把已有 snapshot 转换为内部 Agent 或其他协议，避免 context 与 tools 来自不同 capture：

```ts
forge.registerExporter({
  name: 'internal-agent',
  export(snapshot) {
    return convertTools(snapshot.tools)
  }
})

const tools = forge.exportSnapshot(bundle.snapshot, 'internal-agent')
```

默认 Agent Client 使用 OpenAI-compatible API。需要接入内部模型平台时，可以传入实现 `LlmClient` 的 `llmClient`；完全不同的协议可以直接消费 `captureContext()`，不需要重写 registry、policy 或 executor。

默认 agent 不直接把完整 `EnchantSnapshot` 发送给模型，而是使用页面结构说明和 OpenAI-compatible function tools；snapshot、policy 和执行状态保留在 Core。具体边界见 [LLM Context 与 Tool Calling 边界](./13-llm-context-boundary.md)。

Aura 可以通过标准属性 `agent` 接入应用自定义 agent，也可以使用主题化别名 `caster`：

```vue
<Aura :caster="agent" appearance="orb" />
```

需要按组件或业务域选择不同后端时，应用提供 `resolveAgent`，组件只声明控制元数据 `agentId`：

```ts
const forge = createEnchantForge({
  resolveAgent: (agentId) => agentClients[agentId]
})
```

```vue
<Enchant agent-id="call-center">
  <CallWorkbench />
</Enchant>

<Aura agent-id="operations" />
```

`useEnchant().run()` 继承最近 Enchant 的 `agentId`；调用方传入的 `agent` 仍拥有最高优先级。显式 `agentId` 无法解析时必须报错，不能静默切换默认后端。`agentId` 是控制元数据，不进入模型 context。

## 6. 局部 AI 集成

局部场景不要求额外提供独立的助手组件。Enchant 内部组件可以通过高层 API 直接运行局部任务：

```ts
const enchant = useEnchant()

await enchant.run({
  input,
  prompt: '解释当前表单的校验错误'
})
```

`useEnchant()` 默认解析最近的 Enchant 边界及其 Enchantment；在 Forge 上下文中也可以显式指定目标。具体 registry、context builder 和 executor 不进入基础调用代码。

业务组件也可以绕过内置 runner，自行控制采集时机、Agent Client 协议和 Tool Loop：

```ts
const enchant = useEnchant()
const bundle = enchant.captureContext()
const calls = await callCenterAgent.plan(bundle.context, bundle.tools, transcript)

for (const call of calls) {
  await enchant.executeTool(call, { snapshot: bundle.snapshot })
}
```

这条低层路径适用于持续 ASR、online/offline 转写、规则触发和后端定制 Agent。Aura 可以只负责展示消息，也可以完全不参与。

## 7. Directive 与 Composable

组件通过 directive 或 composable 显式提供信息：

```vue
<Enchant scan="marked">
  <a-input v-enchant v-model:value="form.phone" />
</Enchant>
```

当前 directive：

- `v-enchant`
- `v-enchant-ignore`

高级 composable：

```ts
useEnchant()
useEnchantAction()
useEnchantForm()
useEnchantPage()
useEnchantRegistry()
```

除 `useEnchant()` 外，其余 composable 不进入首个示例。

## 8. 生命周期

```text
onMounted      -> register capture source
onActivated    -> mark active
onDeactivated  -> mark inactive
onUnmounted    -> unregister
```

默认不扫描或观察 DOM。配置 `scan="marked"` 或 `scan="auto"` 后，模型调用或显式 capture 才执行扫描；自动 snapshot 配置或 debug 插件可以进一步开启 DOM 观察。只有 metadata/capability 合约变化才产生 invalidate 信号；业务 state 和图表数据刷新不改变 snapshot version，实时数据应通过显式 read capability 在执行阶段读取。模型调用使用带版本号的临时 snapshot；执行前按 capability 重新定位当前 registration，并确认目标仍暴露且合约未改变。无关弹框或动态子树的挂载不应单独使整份计划失效。

## 9. Metadata 提取顺序

1. Enchant props、composable 和 domain capability 提供显式语义；
2. 已知 UI adapter 提供组件状态和可靠 executor；
3. marked scanner 读取明确标记的 DOM 区域；
4. full DOM scanner 作为明确启用的低置信 fallback。

该顺序使默认行为不依赖 DOM 结构。高层 composable 和 adapter 应吸收 schema 与生命周期样板代码，不能把“显式”退化成逐字段手写 tools。

## 10. 第一阶段组件

- `createEnchantForge()`
- `Enchant`
- `Enchantment` 数据模型
- `Aura`，默认 orb 形态
- DOM scanner
- 外部 UI adapter（不属于 `@enchantforge/vue`）
- field fill executor
- DOM visual adapter（聚焦、滚动、高亮）
- application capability executor
- debug hooks
