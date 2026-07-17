# 05. Progressive Scanning

## Purpose

Progressive scanning lowers adoption cost. A page should become partially AI-capable by wrapping existing UI, then become more reliable as developers add hints or explicit registrations.

## 扫描模式

`Enchant` 默认不读取 slot 内的 DOM。默认 capture 只聚合 wrapper props、子组件 contribution、UI adapter 和显式 capabilities。DOM 结构不稳定、浏览器 API 成本和组件库渲染差异不得成为 Core 默认行为的一部分。

~~~vue
<!-- 默认：不读取 DOM -->
<Enchant>
  <ControlledForm />
</Enchant>

<!-- 只扫描 v-enchant 标记的控件或区域 -->
<Enchant scan="marked">
  <LargePage />
</Enchant>

<!-- 明确接受 DOM fallback 时扫描整个局部边界 -->
<Enchant scan="auto">
  <LegacyForm />
</Enchant>
~~~

`scan="none"` 与不传 `scan` 等价。只有 `scan="marked"`、`scan="auto"` 或对应对象配置会启用 DOM Adapter。

Vue examples 中的快递表单保留两个独立实现：

- `快递填表：组件 API` 使用 `useEnchantForm()`，代表推荐路径；
- `快递填表：DOM 扫描` 使用 `scan="auto"`，代表最低改造成本的兼容路径。

两个示例共用相同的表单字段和用户任务，调试信息应能分别显示 `registered` 与 `dom` metadata source。

扫描还可以按 metadata 类型关闭：

~~~vue
<Enchant :scan="{ mode: 'marked', fields: true, text: false }">
  <LargeForm />
</Enchant>
~~~

`text: false` 用于只需要表单字段或显式 capability 的页面，避免遍历无关文本节点。

## 接入层级

### Level 1: Explicit Vue Contribution

```vue
<Enchant name="寄快递">
  <ControlledForm />
</Enchant>
```

`ControlledForm` 可以通过 `useEnchantForm()`、`useEnchantAction()` 或 UI adapter 向最近的边界提供 metadata 和 capability。默认路径不要求业务开发者理解 DOM selector、事件模拟或组件库内部渲染结构。

### Level 2: Marked Scan

```vue
<Enchant scan="marked">
  <a-input v-enchant v-model:value="form.phone" />
  <section v-enchant>
    <AddressFields />
  </section>
</Enchant>
```

`v-enchant` 可以标记单个原生控件，也可以标记一个待扫描区域。Forge 插件安装时会注册该 directive；也可以从 `@enchantforge/vue` 单独导入 `vEnchant`。

directive 会在 `mounted/unmounted` 时把元素句柄登记到最近的 `Enchant` 边界。`marked` capture 直接读取已登记集合，字段分析和文本遍历只发生在这些区域，成本与标记区域数量相关。

### Level 3: Adapter Integration

Ant Design Vue adapter should infer form metadata from common structure:

- `a-form`
- `a-form-item label name rules`
- `a-input`
- `a-select`
- `a-date-picker`
- validation status/help text

Adapter 只能依赖组件库公开且稳定的 API。DOM convention 不能伪装成组件 adapter。

### Level 4: Full DOM Fallback

```vue
<Enchant scan="auto" name="寄快递">
  <ExistingForm />
</Enchant>
```

该模式用于 POC、遗留页面和明确接受兼容性约束的低风险场景。当前 scanner 提取：

- labels
- placeholders
- input types
- textarea values
- select options
- disabled、readonly、required 和 visible 状态
- aria-label / aria-labelledby
- name / id
- 当前边界拥有的文本摘要

### Explicit Function Registration

```ts
useEnchantAction({
  name: 'form.reset',
  description: '清空当前表单',
  effect: 'draft',
  execute() {
    resetForm();
  }
});
```

表单模型可以使用更短的高层 API：

```ts
const model = defineModel<Record<string, unknown>>({ required: true });

useEnchantForm(model);
```

`useEnchantForm()` 必须在 `<Enchant>` 的后代组件中调用。它注册应用所有的 `field.fill` capability，并直接写入 Vue 响应式对象。存在该 capability 时，同名 DOM `field.fill` fallback 不再导出；DOM scanner 仍可用于生成字段 label、required、options 等 metadata。

显式 capability 的优先级高于同名 DOM capability：

```text
explicit application function
  > official component adapter
  > generic DOM fallback
```

框架不会读取 `defineExpose()` 并自动导出所有组件方法。方法名不能提供参数 schema、effect 和授权语义；可执行函数必须通过 `useEnchantAction()`、`useEnchantForm()` 或低层 `capabilities` prop 明确声明。

## Scanner Output

The scanner should produce normalized metadata, not raw DOM nodes.

```ts
type ScanResult = {
  fields: LlmFieldMeta[];
  actions: LlmActionMeta[];
  regions: LlmScopeMeta[];
  warnings: ScanWarning[];
};
```

## Selector Fallback

DOM-based fields should include selectors, but selector execution is fallback only.

Preferred write modes:

```ts
type WriteMode = 'registered' | 'adapter' | 'dom';
```

Priority:

1. registered setter/form API
2. UI library adapter API
3. DOM write with input/change/blur events

## DOM Write Caveat

Direct DOM write can bypass component state, validation, and business logic. It must be opt-in or clearly marked as fallback.

DOM executor should dispatch realistic events:

```ts
element.value = value;
element.dispatchEvent(new InputEvent('input', { bubbles: true }));
element.dispatchEvent(new Event('change', { bubbles: true }));
element.dispatchEvent(new Event('blur', { bubbles: true }));
```

## Refresh Strategy

启用 DOM scanner 后，默认策略仍是 invocation-time capture。以下变化不会立即扫描 DOM，而是在下一次 agent 调用或显式 capture 时反映：

- scope mounts/unmounts
- form fields appear/disappear
- validation state changes
- modal/drawer opens
- tab changes
- disabled state changes

主动观察只在 `snapshots.autoCapture` 或 Enchant debug 插件启用时开启。实现选项：

- Vue lifecycle hooks
- MutationObserver within scope root
- debounced refresh
- explicit `scope.refresh()`

父 Enchant 扫描时必须跳过嵌套的 `[data-enchant]` 边界。每个边界只拥有自己的 DOM，避免同一字段被页面、表单和字段级 wrapper 重复采集。

## Ignore Rules

Developers must be able to exclude regions:

```vue
<div v-enchant-ignore>
  sensitive content
</div>
```

Forge 插件安装时会全局注册 `v-enchant-ignore`。未安装 Forge 插件的局部用法可以直接使用 `data-enchant-ignore`，或单独导入 `vEnchantIgnore`。

## Confidence

Scanner must mark source and confidence:

- directive/registered: high
- adapter: medium/high
- DOM: medium/low

LLM prompts should tell the model to ask for confirmation or highlight uncertainty for low-confidence mappings.
