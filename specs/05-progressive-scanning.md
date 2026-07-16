# 05. Progressive Scanning

## Purpose

Progressive scanning lowers adoption cost. A page should become partially AI-capable by wrapping existing UI, then become more reliable as developers add hints or explicit registrations.

## Levels

### Level 1: Wrapper DOM Scan

```vue
<Enchant name="寄快递">
  <ExistingForm />
</Enchant>
```

Scanner extracts:

- labels
- placeholders
- input types
- textarea values
- select options
- button text
- disabled/required state
- validation text near fields
- aria-label / aria-describedby
- name / id

### Level 2: Directive Hints

```vue
<a-input v-enchant-field="{ type: 'phone', aliases: ['手机号', '电话'] }" />
```

Hints improve mapping accuracy without replacing existing form logic.

### Level 3: Adapter Integration

Ant Design Vue adapter should infer form metadata from common structure:

- `a-form`
- `a-form-item label name rules`
- `a-input`
- `a-select`
- `a-date-picker`
- validation status/help text

If runtime component internals are not accessible, adapter may still use DOM conventions.

### Level 4: Explicit Registration

```ts
registerField({
  id: 'receiverPhone',
  label: '手机号',
  value,
  setValue,
  validate,
});
```

Use for controlled components, critical forms, and production stability.

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

Metadata must update when:

- scope mounts/unmounts
- form fields appear/disappear
- validation state changes
- modal/drawer opens
- tab changes
- disabled state changes

Implementation options:

- Vue lifecycle hooks
- MutationObserver within scope root
- debounced refresh
- explicit `scope.refresh()`

## Ignore Rules

Developers must be able to exclude regions:

```vue
<div v-enchant-ignore>
  sensitive content
</div>
```

## Confidence

Scanner must mark source and confidence:

- directive/registered: high
- adapter: medium/high
- DOM: medium/low

LLM prompts should tell the model to ask for confirmation or highlight uncertainty for low-confidence mappings.
