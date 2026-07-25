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
- 提供模型客户端、policy、adapter 和 exporter；
- 聚合当前挂载的 Enchant registration；
- 按需 capture Enchantment、metadata snapshot 和 capability index；
- 协调 Aura 请求和 executor；
- 发布 trace、snapshot 和审计事件。

Forge 是公共产品概念；底层实现仍可使用 runtime、registry、store 和 injection key 等技术术语。

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

`Aura` 是当前有效 Enchantment 聚合后形成的应用级智能交互层：

```vue
<template>
  <RouterView />
  <Aura appearance="orb" />
</template>
```

职责：

- 接收自然语言和外部 AI/ASR 事件；
- 常驻时只读取轻量 registry digest，执行前按需生成当前 snapshot；
- 根据 capability 生成结构化计划；
- 调用 policy 和 executor；
- 展示计划确认、执行进度和结果；
- 在路由和组件生命周期变化后，下次执行自动 capture 新 snapshot。

`appearance="orb"` 是第一阶段默认的可拖动悬浮入口。Aura 的语义能力不依赖 orb；后续可以增加 dock 或 inline 形态。

Aura 只感知已挂载、允许暴露且通过 policy 的 Enchantment，不应被描述为无边界的全局智能。

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

Policy 是应用级可变运行状态，切换后会递增 registry version，旧 snapshot 会被拒绝：

```ts
forge.configurePolicy({ mode: 'read-only' })
forge.configurePolicy({ mode: 'draft-only' })
forge.configurePolicy({ mode: 'disabled' })
```

`forge.exportCapabilities()` 默认返回当前 snapshot 的 Core tool model；应用可以注册自己的 exporter，将同一 snapshot 转换为内部 Agent 或其他协议：

```ts
forge.registerExporter({
  name: 'internal-agent',
  export(snapshot) {
    return convertTools(snapshot.tools)
  }
})
```

默认 agent 使用 OpenAI-compatible client。需要接入内部模型平台时，传入实现 `LlmClient` 的 `llmClient`，不需要重写 registry、policy 或 executor。

默认 agent 不直接把完整 `EnchantSnapshot` 发送给模型，而是使用页面结构说明和 OpenAI-compatible function tools；snapshot、policy 和执行状态保留在 Core。具体边界见 [LLM Context 与 Tool Calling 边界](./13-llm-context-boundary.md)。

Aura 可以通过标准属性 `agent` 接入应用自定义 agent，也可以使用主题化别名 `caster`：

```vue
<Aura :caster="agent" appearance="orb" />
```

解析顺序为 `agent ?? caster ?? forge.agent ?? builtInAgent`。caster 只改变 API 表达，不创建另一套 agent protocol。

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

默认不扫描或观察 DOM。配置 `scan="marked"` 或 `scan="auto"` 后，模型调用或显式 capture 才执行扫描；自动 snapshot 配置或 debug 插件可以进一步开启 DOM 观察。只有 metadata/capability 合约变化才产生 invalidate 信号；业务 state 和图表数据刷新不改变 snapshot version，实时数据应通过显式 read capability 在执行阶段读取。模型调用使用带版本号的临时 snapshot；执行前需要确认目标仍属于当前 registry。

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
