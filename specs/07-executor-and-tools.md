# 07. Executor and Tools

## Principle

Fields and components are not tools. They are context. Core defines a stable tool protocol, but executable tools only come from an active Core、Adapter or Application capability provider.

Possible capability set:

```ts
get_active_ui_context()
fill_fields(scopeId, values)
highlight_fields(scopeId, fieldIds)
focus_field(scopeId, fieldId)
invoke_action(scopeId, actionId, args)
navigate(target)
run_executor_steps(steps)
```

The list is not a mandatory Core tool catalog. `navigate` requires a router Adapter; business actions require an Application provider. Metadata alone must not generate any item in this list.

## Executor Step Model

```ts
type ExecutorStep =
  | { type: 'navigate'; target: string }
  | { type: 'fill'; scopeId: string; values: Record<string, unknown> }
  | { type: 'highlight'; scopeId: string; ids: string[] }
  | { type: 'focus'; scopeId: string; id: string }
  | { type: 'click'; scopeId: string; actionId: string; args?: Record<string, unknown> }
  | { type: 'waitForScope'; scopeId: string; timeoutMs?: number }
  | { type: 'openAssistantMessage'; content: string };
```

## Visible Execution

Executor should optionally run step-by-step with UI feedback.

This is important for the product feeling:

- user sees page navigate
- fields fill one by one
- uncertain fields highlight
- assistant explains progress

## Tool Loop

工具调用分为初始计划和可选的继续规划：

1. Agent 根据当前 snapshot 和用户输入生成初始 capability 调用。
2. Forge 执行调用，并收集结构化 execution results。
3. 如果产生成功的 read 结果且 Agent 实现 `planNext`，Forge 将已完成 plans 和 results 交回 Agent。
4. Agent 可以返回新的 capability 调用，或返回最终 assistant content 结束循环。

`maxPlanRounds` 默认是 `3`，`maxPlanCalls` 约束整个 run 的累计调用数。Core 跳过 capabilityId 和 input 完全相同的重复调用。每一轮只复用本次 run 的 snapshot 作为 capability 合约来源，但每次执行仍读取当前 registration status 并重新经过 policy。

多个 tools 能否由模型在同一响应中并行返回属于 provider 能力，不能成为框架正确性的前提。读取结果驱动的后续操作必须通过 Tool Loop 表达，不能要求模型在看到结果之前生成依赖结果的参数。

## Fill Fields

Fill fields should support write modes:

```ts
type WriteMode = 'registered' | 'adapter' | 'dom';
```

Execution priority:

1. registered setter
2. adapter-specific form API
3. DOM event simulation

Vue 组件可以在最近的 `<Enchant>` 边界内直接注册函数：

```ts
useEnchantAction({
  name: 'panel.refresh',
  description: '刷新当前面板数据',
  effect: 'read',
  execute: refresh
});
```

表单模型使用统一的 `field.fill` 契约：

```ts
useEnchantForm(form);
```

`useEnchantForm` 的 capability owner 是 `application`，因为响应式表单状态属于应用。框架只提供注册、schema 生成和调用机制，不拥有字段业务语义。

## LLM Output Shape

For form filling, LLM should output structured mapping:

```json
{
  "values": {
    "receiverName": "张三",
    "receiverPhone": "12233322112",
    "receiverAddress": "广东揭阳 xx 街道 23 号楼 902"
  },
  "uncertainFields": ["goodsType"],
  "notes": ["物品被描述为手机，映射到数码产品"]
}
```

## Action Invocation

Actions should be explicit or adapter-provided for production reliability.

DOM button click is fallback only.

## Error Handling

Executor must return structured results:

```ts
type ExecutorResult = {
  ok: boolean;
  completed: ExecutorStep[];
  failed?: { step: ExecutorStep; reason: string };
  warnings?: string[];
};
```

## Policy Checks

Before executing a step, executor must check:

- scope visibility
- action risk
- user confirmation requirement
- value exposure policy
- whether DOM fallback is allowed

## Demo Requirements

First demo should include:

- fill form from text
- highlight uncertain fields
- explain validation errors
- save executor steps to localStorage
- replay saved steps visibly
