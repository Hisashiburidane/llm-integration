# 09. Safety and Policy

## Default Safety Boundary

Default assistant behavior should stop before irreversible actions.

Allowed by default:

- read metadata
- fill draft fields
- highlight fields
- focus fields
- explain validation errors
- create temporary views
- save local workflow

Requires confirmation:

- export data
- send message
- save server-side data
- submit form

Disabled unless explicitly enabled:

- payment
- approval
- deletion
- permission changes
- destructive operations

## Risk Model

```ts
type Risk = 'read' | 'draft' | 'write' | 'submit' | 'destructive';
```

## Policy Config

```ts
type LlmPolicy = {
  defaultVisibility: 'local' | 'global' | 'private';
  allowDomWrite: boolean;
  requireConfirmationFor: Risk[];
  blockedActions?: string[];
  valuePolicy?: Record<string, 'expose' | 'mask' | 'omit'>;
};
```

## Sensitive Fields

Scanner should detect and omit/mask likely sensitive fields:

- password
- token
- secret
- ID card
- bank card
- payment credentials

## Confirmation UX

Confirmation should show:

- action label
- target scope
- extracted values if relevant
- risk level
- what will not be done automatically

Example:

```text
我可以帮你填写维修工单草稿，但不会自动提交。
```

## Audit Hooks

Provide hooks:

```ts
onBeforeExecute(step)
onAfterExecute(step, result)
onPolicyBlock(step, reason)
onLlmCall(request, response)
```

## DOM Fallback Warning

If an action uses DOM fallback, result should include a warning because it may bypass component state.

## POC Policy

POC should default to:

```ts
allowDomWrite: true
requireConfirmationFor: ['submit', 'destructive']
```

But UI copy must explain that production should prefer adapters/registered APIs.
