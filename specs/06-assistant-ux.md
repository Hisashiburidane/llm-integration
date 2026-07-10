# 06. Assistant UX

## Assistant Types

### GlobalAssistant

Persistent floating assistant registered under `LlmProvider`.

Use cases:

- receive ASR/AI pipeline events
- suggest actions globally
- coordinate global-visible scopes
- restore semantic snapshots
- run saved workflows

### LocalAssistant

Assistant inside or near an `LlmIntegration` scope.

Use cases:

- fill current form
- explain local validation errors
- summarize local component state
- execute local-only actions

## Visual Direction

The assistant should feel helpful but not like a generic chat window.

Recommended direction:

- floating bubble
- compact message panel
- draggable
- contextual prompt chips
- subtle animation
- optional modern cartoon/helper mascot for validation and onboarding examples

The classic office helper/reference can be used as an inspiration, not copied literally.

## Interaction Patterns

### Suggestion Bubble

Triggered by external or behavioral signal:

```text
我识别到用户正在描述维修问题。是否创建维修工单？
[是，创建草稿] [不用]
```

### Form Fill Panel

User pastes text. Assistant shows extracted mapping before or during fill:

```text
收件人 -> 张三
手机号 -> 12233322112
地址 -> 广东揭阳...
物品 -> 手机 / 数码产品
```

Uncertain fields should be highlighted.

### Validation Help

Triggered by validation failure:

```text
我发现 3 个字段导致提交失败：手机号格式不正确、地址缺少门牌号、物品类型未选择。
```

Actions:

- highlight fields
- focus first error
- suggest fix

### Visible Execution

For workflows and snapshots, execution should be visible step by step:

```text
1. 打开维修工单页面
2. 填写联系人
3. 填写地址
4. 高亮待确认字段
```

This creates the desired autonomous UI feeling without performing unsafe submission.

## Prompt Chips

Prompt chips should be generated from current scope and scenario, not static only.

Examples:

- 填写当前表单
- 解释提交失败原因
- 创建维修工单草稿
- 恢复分享视图
- 保存为快捷命令

## Confirmations

Default behavior:

- Fill draft: no confirmation needed, but visible.
- Save local workflow: confirmation needed.
- Export: confirmation needed.
- Submit/delete/payment/approval: disabled unless explicitly registered and policy allows.

## Assistant State

Assistant should show:

- current scope name
- whether it is using local or global context
- current execution step when running workflow
- uncertainty warnings
- action results

## Non-goal

The assistant should not be positioned as a generic Q&A chatbot. It should be a UI interaction layer.
