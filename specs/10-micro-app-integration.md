# 10. Micro App Integration

## Goal

Support future integration with micro app systems such as qiankun without requiring first-stage implementation.

## Principle

Execution should happen where the component instance lives.

Main app may coordinate, but sub app should own its local registry and executor.

## Architecture

```text
Main App
  LlmProvider
  GlobalAssistant
  GlobalRegistry
  BridgeClient

Sub App
  LlmProvider isolated
  LocalRegistry
  LlmIntegration scopes
  LocalExecutor
  BridgeServer
```

## Message Flow

### Expose Metadata

```text
sub app -> main app
{
  type: 'llm:metadata:update',
  appId,
  scopes: sanitizedGlobalScopes
}
```

### Invoke Action

```text
main app -> sub app
{
  type: 'llm:action:invoke',
  appId,
  scopeId,
  actionId,
  args,
  requestId
}
```

### Action Result

```text
sub app -> main app
{
  type: 'llm:action:result',
  requestId,
  ok,
  result,
  warnings
}
```

## Visibility

Sub app controls what it exposes:

- global scopes may be published to main app
- local/private scopes stay inside sub app
- sensitive values should be omitted or masked before crossing boundary

## Why Sub App Executes

The sub app owns:

- Vue component instances
- form APIs
- local state
- permissions
- validation
- routing internals

Therefore main app should not directly manipulate sub app DOM except as a last-resort fallback.

## POC Status

First implementation should not include full micro app bridge.

Website can include architecture diagram and explain future support.
