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

第一阶段 adapter 可以保留在 `@enchantforge/vue` 内部；只有在接口稳定且需要独立版本管理时才拆包。不得为了抽象纯度让入门用户安装多个内部包。

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
  <ShippingForm />
</Enchant>
```

职责：

- 建立局部扫描边界；
- 自动识别字段、动作、区域和状态；
- 接收 prompt/spell、metadata 和 knowledge 补充；
- 随 Vue 生命周期注册、刷新和注销；
- 注册惰性 capture source，默认不持续扫描 DOM 或维护完整 Enchantment 副本；
- 根据 exposure 和 policy 决定是否加入 Aura。

`Enchantment` 是一次 capture 生成的数据模型，不是 Vue 组件，也不是 registry 中持续维护的 store。registry 保存 registration、生命周期状态和 capture 函数；agent 调用时才解析当前 DOM、响应式 state 和 capability。

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

自动扫描不足时提供显式扩展：

```vue
<a-input
  v-enchant-field="{ type: 'phone', aliases: ['电话', '联系方式'] }"
/>

<a-button
  v-enchant-action="{ name: 'saveDraft', effect: 'draft', execute: saveDraft }"
>
  保存草稿
</a-button>
```

首批 directive：

- `v-enchant-field`
- `v-enchant-action`
- `v-enchant-region`
- `v-enchant-ignore`

高级 composable：

```ts
useEnchant()
useEnchantPage()
useEnchantRegistry()
useEnchantCapability()
useEnchantState()
```

除 `useEnchant()` 外，其余 composable 不进入首个示例。

## 8. 生命周期

```text
onMounted      -> register capture source
onActivated    -> mark active
onDeactivated  -> mark inactive
onUnmounted    -> unregister
```

默认不在 `onUpdated` 中扫描 DOM。模型调用、显式 capture、自动 snapshot 配置或 debug 插件才触发扫描。自动观察开启时，DOM 和 state 变化只产生 invalidate 信号，并经过 debounce 后 capture。模型调用使用带版本号的临时 snapshot；执行前需要确认目标仍属于当前 registry。

## 9. Metadata 提取顺序

1. DOM scanner 生成零配置基线；
2. 已知 UI adapter 补充组件实例、状态和可靠 executor；
3. Enchant props 和 directive 覆盖自动推断；
4. domain capability 提供稳定业务动作。

该顺序同时满足低接入成本和生产级 escape hatch。显式配置可以覆盖自动结果，但不应成为普通页面获得基础能力的前置条件。

## 10. 第一阶段组件

- `createEnchantForge()`
- `Enchant`
- `Enchantment` 数据模型
- `Aura`，默认 orb 形态
- DOM scanner
- Ant Design Vue form adapter
- field fill executor
- DOM visual adapter（聚焦、滚动、高亮）
- application capability executor
- debug hooks
