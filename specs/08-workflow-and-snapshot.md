# 08. Workflow and Semantic Snapshot

## Workflow

A workflow is a saved executor step list created from an AI interaction or user-confirmed plan.

POC storage: localStorage.

```ts
type SavedWorkflow = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  steps: ExecutorStep[];
};
```

## Why Workflow Matters

It turns one-time AI interaction into reusable UI capability.

Benefits:

- saves token cost
- improves stability
- supports personal shortcuts
- demonstrates AI-generated operations becoming product features

## Demo Flow

1. User asks assistant to create repair ticket draft.
2. Assistant produces executor steps.
3. User clicks save as quick command.
4. Workflow is stored in localStorage.
5. User runs it later.
6. Page visibly replays steps.

## Semantic Snapshot

A snapshot captures UI semantic state, not just URL.

```ts
type SemanticSnapshot = {
  version: 1;
  title?: string;
  route?: string;
  steps: ExecutorStep[];
  note?: string;
};
```

## Share/Restore UX

The share string may be base64 JSON in POC.

Restore flow:

1. User pastes snapshot string into assistant.
2. Assistant recognizes it.
3. Assistant shows execution plan.
4. User confirms.
5. Executor visibly restores state.

## Important UX Note

Do not silently apply snapshots. The visible step-by-step restore is part of the AI interaction feeling.

## Backend

No backend required for POC.

Future backend may support:

- team-shared workflows
- permission-controlled snapshots
- audit history
- versioned workflow templates
