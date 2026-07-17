# EnchantForge 项目简介

## 一句话说明

EnchantForge 是一个面向 Vue 应用的 AI 交互运行时。它把当前界面中允许被理解和操作的信息整理成结构化描述，让大语言模型可以把自然语言转换为受约束的界面操作。

它不是聊天组件，也不是可以任意控制浏览器的通用 Agent。

## 为什么要做

大语言模型能够理解“把这段地址填进快递表单”这样的自然语言，但普通业务页面只认识字段、状态和函数。每个页面单独编写 Prompt、tools 和执行代码，会带来大量重复开发，而且难以统一调试和约束。

EnchantForge 在两者之间增加一层稳定协议：

```text
用户自然语言
    ↓
模型生成操作计划
    ↓
EnchantForge 检查当前页面允许使用的能力
    ↓
Vue 组件提供的函数修改界面状态
```

如果用图形系统类比：Vue 页面类似正在运行的 scene graph；metadata 类似节点描述；capability 类似经过注册的 command；Forge 类似负责收集、调度和检查 command 的 runtime。模型只能选择已经公开的 command，不能获得任意脚本执行权限。

## 项目价值

- 组件接入一次后，局部 AI 功能、全局助手和外部流程可以复用同一套能力；
- 结构化 metadata 和 tools 减少模型猜测，较小模型也能完成明确任务；
- 页面生命周期、权限、执行记录和调试入口统一管理，避免形成难以维护的页面脚本集合。

## 能做什么

### 1. 自然语言填写表单

用户粘贴一段非结构化收件信息，模型将姓名、电话和地址映射到表单字段。EnchantForge 调用组件提供的填写函数，只生成草稿，不自动提交。

### 2. 阅读和组织复杂界面

在监控 Dashboard 中，用户可以要求高亮相关图表、打开详情或组合多个面板。图表含义由 metadata 描述，具体高亮和组合逻辑仍由 Dashboard 自己实现。

### 3. 辅助现有业务流程

在客服、IoT 告警或工单系统中，模型可以从对话或异常信息中提取参数，调用页面明确提供的查询、填表或创建草稿能力，并把结果留给用户确认。

同一套机制还可以用于表单错误解释、界面说明、知识库辅助和可复用操作流程。

## 如何接入

推荐方式是让组件直接提供响应式状态和受限函数：

```ts
const form = defineModel<Record<string, unknown>>({ required: true });

useEnchantForm(form);
```

外层使用 `Enchant` 建立生命周期和能力边界：

```vue
<Enchant prompt="填写当前表单，但不要提交">
  <EnchantExpressForm />
</Enchant>
```

对于不希望修改原组件的 POC 或遗留页面，可以明确启用 DOM 兼容模式：

```vue
<Enchant scan="auto">
  <LegacyForm />
</Enchant>
```

DOM 扫描默认关闭。原因是组件库升级或很小的模板改动都可能改变 DOM 结构，浏览器事件模拟也不等价于调用组件正式 API。生产路径优先使用 Vue composable、显式 capability 和稳定的组件 adapter。

## 核心边界

- metadata 只描述当前页面实际存在的信息；
- 可执行操作必须由组件、adapter 或应用明确提供；
- 模型负责理解和规划，应用仍负责事实、权限、校验和业务效果；
- 提交、审批、支付、删除等不可逆操作不应默认自动执行；
- snapshot、tool call、执行进度和结果可以记录和调试。

这套设计承认模型会犯错。EnchantForge 的目标不是让模型“全知全能”，而是缩小模型可以犯错的范围，并降低普通 Vue 页面接入自然语言交互的工程成本。

## 当前状态

项目目前处于 POC 和架构验证阶段，已经具备：

- Vue 应用级 Forge 和动态 registry；
- `Enchant` 生命周期边界；
- `useEnchantForm()` 和 `useEnchantAction()`；
- metadata、capability、snapshot、policy 和 trace；
- 全局 Aura 助手；
- 推荐 API 与 DOM fallback 两种表单示例；
- Dashboard 高亮、详情和组合视图示例。

下一阶段重点不是增加更多演示动作，而是验证组件 adapter、Vue Devtools/debug、权限策略和真实业务系统中的接入成本。
