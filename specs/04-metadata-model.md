# 04. Metadata Model

## Goals

Metadata should describe what the UI is, what state it is in, and what can be safely done with it.

Metadata is context, not tool explosion. Tools should stay generic, while fields/actions/components are passed as structured context.

## Scope Metadata

```ts
type LlmScopeMeta = {
  id: string;
  title: string;
  description?: string;
  visibility: 'global' | 'local' | 'private';
  kind: 'page' | 'form' | 'table' | 'chart' | 'panel' | 'modal' | 'drawer' | 'custom';
  alive: boolean;
  active: boolean;
  visible: boolean;
  route?: string;
  tags?: string[];
  prompt?: string;
  children: LlmNodeMeta[];
};
```

## Field Metadata

```ts
type LlmFieldMeta = {
  id: string;
  scopeId: string;
  kind: 'field';
  label: string;
  description?: string;
  semanticType?: 'text' | 'personName' | 'phone' | 'address' | 'date' | 'money' | 'email' | 'enum' | 'textarea' | 'unknown';
  aliases?: string[];
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  value?: unknown;
  placeholder?: string;
  options?: Array<{ label: string; value: unknown }>;
  validationErrors?: string[];
  confidence?: number;
  selector?: string;
  source: 'registered' | 'directive' | 'adapter' | 'dom';
};
```

## Action Metadata

```ts
type LlmActionMeta = {
  id: string;
  scopeId: string;
  kind: 'action';
  label: string;
  description?: string;
  aliases?: string[];
  enabled: boolean;
  disabledReason?: string;
  risk: 'read' | 'draft' | 'write' | 'submit' | 'destructive';
  requiresConfirmation?: boolean;
  source: 'registered' | 'directive' | 'adapter' | 'dom';
};
```

## Table Metadata

```ts
type LlmTableMeta = {
  id: string;
  scopeId: string;
  kind: 'table';
  title?: string;
  entity?: string;
  columns: Array<{ key: string; label: string; type?: string }>;
  visibleRows?: Array<Record<string, unknown>>;
  filters?: LlmFieldMeta[];
  actions?: LlmActionMeta[];
  source: 'registered' | 'adapter' | 'dom';
};
```

Complex table operations usually require adapter or explicit registration.

## Chart Metadata

```ts
type LlmChartMeta = {
  id: string;
  scopeId: string;
  kind: 'chart';
  title: string;
  metric?: string;
  dimensions?: string[];
  summary?: string;
  tags?: string[];
  priority?: 'normal' | 'warning' | 'critical';
  actions?: LlmActionMeta[];
};
```

## Value Exposure Policy

Metadata must support value redaction.

```ts
type ValuePolicy = 'expose' | 'mask' | 'omit';
```

Examples:

- Phone field may expose partially masked value.
- Password field should omit value.
- Payment amount may require policy.

## Metadata Quality

Each node should include source and optional confidence so the assistant can behave differently:

- registered: high confidence
- directive: high confidence
- adapter: medium/high confidence
- dom: medium/low confidence

## Local Tree vs Global Registry

Each `LlmIntegration` owns a local metadata tree. Only global-visible scopes publish sanitized metadata to global registry.

Global registry should not automatically include private/local scopes.
