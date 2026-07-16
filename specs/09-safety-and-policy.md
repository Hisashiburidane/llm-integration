# 09. 安全、Policy 与模型边界

## 1. 基本立场

EnchantForge 允许模型参与执行，但不将模型视为事实来源、权限主体或业务规则引擎。模型生成的内容只有在被解析为已注册 capability、通过 policy 并由 executor 成功执行后，才会改变页面状态。

Prompt 约束用于提高规划质量，不能替代代码级权限控制。

## 2. 信任层级

```text
business state and rules
  > policy
  > capability schema and executor
  > metadata snapshot
  > agent plan
  > generated explanation
```

冲突时始终使用更高层级结果。例如模型认为按钮可用，但 snapshot 或应用状态显示 disabled，executor 必须拒绝调用。

## 3. Effect 模型

```ts
type CapabilityEffect =
  | 'read'
  | 'visual'
  | 'draft'
  | 'commit'
```

| effect | 示例 | 默认策略 |
| --- | --- | --- |
| `read` | 读取 metadata、解释校验错误 | 允许 |
| `visual` | 高亮、聚焦、打开只读视图 | 允许 |
| `draft` | 填表、设置筛选条件、生成工单草稿 | 允许，但结果必须可检查 |
| `commit` | 提交、发送、审批、支付、删除 | 禁用，除非显式注册和授权 |

`commit` 是统一语义分类。应用可以进一步拆分 export、submit、approve、payment 和 destructive policy。

## 4. Policy

```ts
interface EnchantPolicy {
  defaultExposure: 'aura' | 'local' | 'private'
  allowDomWrite: boolean
  allowedEffects: CapabilityEffect[]
  requireConfirmationFor: CapabilityEffect[]
  blockedCapabilities?: string[]
  valuePolicy?: Record<string, 'expose' | 'mask' | 'omit'>
}
```

policy 可以在 Forge、页面、Enchant 和 capability 四个层级定义。更局部的 policy 只能进一步收紧权限，不能绕过应用级禁止规则。

## 5. 执行前检查

每个 capability 调用至少检查：

1. Enchantment 仍然 alive、active 且 enabled；
2. target 仍属于当前 registry；
3. snapshot version 未失效，或目标能够被安全地重新解析；
4. capability 当前仍然可用；
5. 输入通过 schema 校验；
6. effect 被当前 policy 允许；
7. 需要确认时已经获得对应本次参数的确认；
8. executor 返回的实际结果与预期目标一致。

任何检查失败都必须停止该步骤并写入 trace。模型不能通过重新措辞自动重试被 policy 拒绝的同一操作。

## 6. spell 与 caster

`spell` 是 Enchant 的 `prompt` 别名，只提供局部 instruction。它不能：

- 注册 capability；
- 修改 effect；
- 提升 exposure；
- 绕过 policy；
- 直接执行脚本。

`caster` 是 Aura 的 `agent` 别名。无论使用哪个属性，agent 都只能读取传入的 snapshot 和调用导出的 capability。更换 caster 不改变应用授权边界。

## 7. 敏感数据

scanner 和 adapter 需要识别或允许应用声明以下敏感字段：

- password、token 和 secret；
- 身份证件和银行卡；
- 支付凭据；
- 个人联系电话和地址；
- 应用指定的业务敏感字段。

字段值使用 `expose`、`mask` 或 `omit` 策略。redaction 必须发生在 snapshot 和模型请求生成之前。

## 8. 确认

确认界面至少展示：

- action 和 capability 名称；
- 目标 Enchantment 和页面；
- 本次参数；
- effect 和持久化影响；
- 不会自动执行的后续步骤。

```text
将根据当前信息填写维修工单草稿。
本次操作不会提交工单或发送通知。
```

确认必须绑定 capability、target、参数摘要和 snapshot version。页面或参数变化后不能复用旧确认。

## 9. Trace 与审计

至少提供：

```ts
onBeforeExecute(step)
onAfterExecute(step, result)
onPolicyBlock(step, reason)
onAgentCall(request, response)
onSnapshot(snapshot)
```

trace 记录模型看到的 snapshot 版本、生成的计划、policy 决策、executor 结果和状态变化。敏感值按相同 value policy 脱敏。

## 10. DOM fallback

DOM executor 用于降低初始接入成本，但可靠性低于 adapter 和 domain executor。使用 DOM fallback 时：

- trace 标记 executor 类型；
- 写入后重新读取实际状态；
- 无法确认 Vue 状态同步时返回 warning；
- `commit` capability 不使用隐式 DOM fallback。

## 11. POC 默认值

```ts
const policy: EnchantPolicy = {
  defaultExposure: 'aura',
  allowDomWrite: true,
  allowedEffects: ['read', 'visual', 'draft'],
  requireConfirmationFor: [],
}
```

POC 可以允许 DOM 写入以验证低接入成本，但默认不生成 `commit` capability。生产系统应优先使用 UI adapter 或显式 domain capability。
