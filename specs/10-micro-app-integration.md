# 10. 微应用集成

## 1. 目标

为 qiankun 等微应用架构保留集成路径，但不纳入第一阶段实现。

## 2. 原则

executor 在组件实例所属应用中运行。主应用可以通过 Aura 协调任务，但不直接持有子应用组件实例，也不默认操作子应用 DOM。

## 3. 架构

```text
Main App
  EnchantForge
  Aura
  Global scope summary
  Bridge client

Sub App
  Isolated EnchantForge
  Enchant components
  Enchantment models
  Local registry
  Local executor
  Bridge server
```

子应用通常不创建独立 Aura，只向主应用发布经过过滤的摘要。需要完全隔离时，子应用可以运行自己的 Aura，并禁止主应用聚合。

## 4. 消息流

### 4.1 发布摘要

```text
sub app -> main app
{
  type: 'enchantforge:metadata:update',
  appId,
  version,
  enchantments: exposedSummaries
}
```

### 4.2 调用能力

```text
main app -> sub app
{
  type: 'enchantforge:capability:invoke',
  appId,
  scopeId,
  capabilityId,
  input,
  snapshotVersion,
  requestId
}
```

### 4.3 返回结果

```text
sub app -> main app
{
  type: 'enchantforge:capability:result',
  requestId,
  ok,
  result,
  warnings,
  trace
}
```

## 5. 权限边界

- 子应用中的 Enchant 决定其 Enchantment 是否可以发布；
- local/private metadata 不离开子应用；
- 敏感字段在跨边界前删除或脱敏；
- 子应用收到调用后重新执行本地 policy；
- 主应用的计划不能覆盖子应用 policy；
- snapshot version 不一致时拒绝执行或要求重新规划。

## 6. 为什么由子应用执行

子应用拥有 Vue 组件实例、表单 API、本地状态、权限、校验和路由细节。将执行保留在子应用中，可以维持版本隔离并避免主应用依赖内部 DOM。

## 7. 第一阶段边界

第一阶段只保留 bridge 接口和消息模型，不实现完整通信层。网站可以展示架构方向，但不能把微应用支持列为当前已交付能力。
