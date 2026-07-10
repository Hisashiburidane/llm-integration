# 02. Scenario Catalog

This spec defines candidate scenarios for demos and product examples.

## Priority 1: Natural Language Form Fill

### Example: Express Delivery Form

User input:

```text
张三
12233322112
广东揭阳 xx 街道 23 号楼 902
帮我预约寄一个手机到上述地址
```

Expected behavior:

1. Assistant opens or focuses the delivery form if needed.
2. Wrapper scans active form fields.
3. LLM maps user text to available fields.
4. Executor fills fields visibly.
5. Uncertain fields are highlighted.
6. User confirms manually.

Key point: The page does not need to pre-register delivery-specific business tools. The active form metadata is enough for a useful first pass.

## Priority 1: Chat Transcript to Form

### Example: Support Request From Chat

Input may come from copied chat text, email, or an external AI pipeline.

Expected behavior:

1. User provides unstructured text.
2. Assistant detects the likely target form.
3. It opens the form.
4. It fills extracted values.
5. It highlights uncertain values.

This demonstrates natural-language-to-UI-state conversion.

## Priority 1: Hotline ASR Assistant

### Example: Utility Hotline

ASR transcript streams into the page:

```text
我家水管漏水，地址是... 联系电话是...
```

Assistant suggests:

- Create repair ticket
- Query payment status
- Query water bill

Expected behavior:

1. LLM consumes transcript segments.
2. It recognizes an eligible low-risk action.
3. Global assistant shows a confirmation bubble.
4. User clicks yes.
5. The relevant form opens and is filled.

This demonstrates integration with other AI pipelines, not just chat.

## Priority 1: Validation Error Assistant

### Example: Form Submit Failed

Trigger:

- User submits form and validation fails.

Expected behavior:

1. Assistant detects repeated validation failure or receives validation event.
2. It reads field metadata and validation errors.
3. It explains errors in plain language.
4. It highlights fields.
5. It suggests how to fix them.

The UI may use a small modern animated assistant inspired by classic office helper patterns.

## Priority 2: Semantic Workflow Save

### Example: Save as Quick Command

User asks assistant to complete a sequence, then saves it:

```text
保存为：创建维修工单草稿
```

Stored in localStorage for demo:

```json
[
  { "type": "navigate", "target": "repair-ticket" },
  { "type": "fill", "scope": "repair-form", "values": { "phone": "138..." } },
  { "type": "highlight", "ids": ["address", "priority"] }
]
```

Expected behavior:

- Clicking saved command replays steps visibly.
- No backend required for POC.

## Priority 2: Semantic Snapshot Restore

### Example: Shared View Code

User receives a base64 semantic snapshot. Assistant parses it and asks whether to restore.

Expected behavior:

1. Parse snapshot.
2. Show execution plan.
3. User confirms.
4. Page visibly executes steps: navigate, set filters, open panels, highlight fields.

Important: The AI feeling comes from visible step-by-step execution, not from silently applying URL params.

## Priority 2: Chart and Focus View

Use charts only as a safe read-oriented example:

- highlight relevant charts
- dim unrelated charts
- create focus view
- save focus configuration

Do not make domain-specific monitoring diagnosis the main story.

## Priority 3: Data Export Assistant

This is a basic but useful scenario:

1. Fill filter form from natural language.
2. Preview export fields.
3. Call export action with confirmation.

It is not a flagship scenario, but it helps people understand that common UI tasks are covered.

## Roadmap: Micro App Isolation

Show architecture only in first website version.

- Main app owns global assistant.
- Sub app owns local registry and executor.
- Main app can request sanitized metadata.
- Actual action execution happens inside sub app.

## Deferred

- Generic table automation requiring deep table API integration.
- Full TTS or voice assistant.
- Playwright test generation.
- High-risk business process automation.
