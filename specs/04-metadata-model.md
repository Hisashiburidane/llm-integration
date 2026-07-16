# 04. Metadata 与 Enchantment 模型

## 1. 目标

metadata 描述页面当前存在什么、处于什么状态以及允许执行什么。Enchantment 是一个 Enchant 组件实例生成的完整局部增强模型，负责组织 metadata tree 和 capability 引用。

metadata 是上下文，不应直接膨胀为大量页面专用 tools。tool exporter 从 Enchantment 和 capability index 生成适合模型协议的调用描述。

## 2. Enchantment

```ts
interface Enchantment {
  id: string
  name?: string
  kind: 'page' | 'form' | 'table' | 'chart' | 'panel' | 'dialog' | 'custom'
  exposure: 'aura' | 'local' | 'private'
  instruction?: string
  state: {
    alive: boolean
    active: boolean
    visible: boolean
    enabled: boolean
  }
  route?: string
  tags?: string[]
  metadata: EnchantMetadataNode[]
  capabilities: string[]
  source: {
    scopeId: string
    parentEnchantmentId?: string
    component?: string
  }
  version: number
}
```

`Enchantment` 是数据模型，不是 Vue 组件。Vue 组件名为 `Enchant`：

```vue
<Enchant spell="根据用户输入填写表单，不要提交">
  <ExistingForm />
</Enchant>
```

`prompt` 和 `spell` 在组件 props 层归一化为 `instruction`。Enchantment 不同时保存 prompt 和 spell，避免下游出现优先级分歧。

## 3. Metadata node

```ts
type EnchantMetadataNode =
  | EnchantFieldMetadata
  | EnchantActionMetadata
  | EnchantTableMetadata
  | EnchantChartMetadata
  | EnchantRegionMetadata
```

所有节点共享：

```ts
interface EnchantMetadataBase {
  id: string
  scopeId: string
  kind: string
  label?: string
  description?: string
  visible: boolean
  enabled: boolean
  source: 'registered' | 'directive' | 'adapter' | 'dom'
  confidence?: number
}
```

## 4. 字段

```ts
interface EnchantFieldMetadata extends EnchantMetadataBase {
  kind: 'field'
  label: string
  semanticType?:
    | 'text'
    | 'personName'
    | 'phone'
    | 'address'
    | 'date'
    | 'money'
    | 'email'
    | 'enum'
    | 'textarea'
    | 'unknown'
  aliases?: string[]
  required?: boolean
  readonly?: boolean
  value?: unknown
  placeholder?: string
  options?: Array<{ label: string; value: unknown }>
  validationErrors?: string[]
  selector?: string
}
```

## 5. 动作

```ts
interface EnchantActionMetadata extends EnchantMetadataBase {
  kind: 'action'
  label: string
  aliases?: string[]
  effect: 'read' | 'visual' | 'draft' | 'commit'
  capabilityId: string
  disabledReason?: string
  requiresConfirmation?: boolean
}
```

action metadata 只描述动作。实际执行函数存放在 capability index，不能序列化进模型上下文。

## 6. 表格

```ts
interface EnchantTableMetadata extends EnchantMetadataBase {
  kind: 'table'
  title?: string
  entity?: string
  columns: Array<{ key: string; label: string; type?: string }>
  visibleRows?: Array<Record<string, unknown>>
  filters?: EnchantFieldMetadata[]
  actions?: EnchantActionMetadata[]
}
```

复杂筛选、排序和导出通常需要 adapter 或显式 capability。

## 7. 图表

```ts
interface EnchantChartMetadata extends EnchantMetadataBase {
  kind: 'chart'
  title: string
  metric?: string
  dimensions?: string[]
  summary?: string
  tags?: string[]
  priority?: 'normal' | 'warning' | 'critical'
  actions?: EnchantActionMetadata[]
}
```

图表数据默认只暴露摘要和当前可见范围。完整序列应由 adapter、读取 capability 或应用数据源按需提供。

## 8. 区域

```ts
interface EnchantRegionMetadata extends EnchantMetadataBase {
  kind: 'region' | 'panel' | 'dialog'
  children: EnchantMetadataNode[]
}
```

metadata tree 保留 DOM 和组件层级语义；registry 同时维护扁平索引以支持按 id 定位和 tool export。

## 9. 值暴露策略

```ts
type ValuePolicy = 'expose' | 'mask' | 'omit'
```

- 普通文本字段可以使用 `expose`；
- 电话、证件号等字段通常使用 `mask`；
- 密码、token 和密钥必须使用 `omit`；
- 金额、审批意见等字段可以由应用 policy 动态决定。

redaction 在 snapshot 和 exporter 之前执行，不能只依赖 Prompt 要求模型忽略敏感值。

## 10. Metadata 质量

每个节点记录 source 和可选 confidence：

| source | 默认可信度 | 说明 |
| --- | --- | --- |
| `registered` | 高 | 应用显式提供 |
| `directive` | 高 | 开发者在模板中补充 |
| `adapter` | 中到高 | 已知组件结构提取 |
| `dom` | 中到低 | label、placeholder、ARIA 和邻近文本推断 |

低可信字段可以用于高亮和建议，但写入前应由模型或用户确认目标。

## 11. 局部模型与应用 registry

每个 Enchant 实例拥有一个 Enchantment。只有 exposure 为 `aura` 且通过 policy 的 Enchantment 才发布到应用 registry。

registry 维护：

- Enchantment 父子关系；
- metadata tree；
- metadata node 扁平索引；
- capability index；
- snapshot version；
- lifecycle 和 policy 状态。

Aura 使用经过过滤的 snapshot，不直接遍历 DOM。local/private Enchantment 不会因 Aura 挂载而自动提升暴露范围。
