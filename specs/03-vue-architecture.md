# 03. Vue Architecture

## Product Direction

The first production-oriented SDK is Vue-only.

All examples and public API docs use Vue syntax.

## Package Layout

Recommended first-stage packages:

```text
@llm-ui/vue
  Public Vue SDK

@llm-ui/core
  Internal runtime primitives used by the Vue SDK

@llm-ui/adapter-antdv
  Optional Ant Design Vue adapter

@llm-ui/adapter-element-plus
  Optional future Element Plus adapter
```

`@llm-ui/core` exists for clean architecture, but it should not dominate product messaging.

## Main Concepts

### LlmProvider

Root provider for model config, registry, policy, logging, and global assistant coordination.

```vue
<LlmProvider :client="client" :policy="policy">
  <GlobalAssistant />
  <App />
</LlmProvider>
```

Responsibilities:

- create global registry
- provide LLM client
- provide policy config
- collect global scopes
- route global assistant actions
- expose audit hooks

### LlmIntegration

A scope boundary around a page section or component.

```vue
<LlmIntegration
  id="shipping-form"
  title="寄快递"
  visibility="local"
  prompt="根据用户输入填写当前表单，不要提交"
  :scan="{ fields: true, actions: true }"
>
  <ShippingForm />
  <LocalAssistant />
</LlmIntegration>
```

Responsibilities:

- create local scope
- scan DOM within scope
- accept field/action/chart/table hints
- register/unregister metadata on lifecycle
- expose local metadata/tools to local agent
- optionally publish sanitized metadata to global registry

### GlobalAssistant

A persistent floating assistant. It reads only global-visible scopes unless explicitly granted more access.

Responsibilities:

- handle app-level requests
- coordinate visible scopes
- suggest actions from ASR or external events
- invoke scoped executors
- show confirmation bubbles

### LocalAssistant

A component-local assistant. It reads only its nearest `LlmIntegration` scope.

Responsibilities:

- form fill
- field explanation
- validation explanation
- component-specific commands
- local workflow creation

### Directives

Directives provide progressive enhancement without rewriting components.

```vue
<a-input v-llm-field="{ type: 'phone', aliases: ['电话', '联系方式'] }" />
<a-button v-llm-action="{ label: '保存草稿', handler: saveDraft }" />
```

Required directives:

- `v-llm-field`
- `v-llm-action`
- `v-llm-region`
- `v-llm-ignore`

### Composables

Required composables:

```ts
useLlmScope()
useLocalAgent()
useGlobalRegistry()
useLlmClient()
useLlmExecutor()
```

## Visibility

```ts
type Visibility = 'global' | 'local' | 'private';
```

- `global`: scope metadata and allowed actions are visible to GlobalAssistant.
- `local`: only local components and LocalAssistant can access it.
- `private`: metadata may be collected for local logic but is not sent to LLM by default.

Default should be `local`.

## Lifecycle

Vue lifecycle mapping:

```text
onMounted    -> scan and register scope
onUpdated    -> refresh dynamic metadata
onUnmounted  -> unregister scope
```

Scanning should be debounced and observable via registry events.

## Adapter Strategy

Priority order for metadata quality:

1. Explicit registration via composables/directives.
2. Adapter extraction from known UI libraries.
3. DOM label/placeholder/name/aria scanning.
4. Selector fallback.

## First POC Components

- `LlmProvider`
- `LlmIntegration`
- `GlobalAssistant`
- `LocalAssistant`
- `v-llm-field`
- `v-llm-action`
- DOM scanner
- Ant Design Vue form scanner
- field fill executor
- action executor
