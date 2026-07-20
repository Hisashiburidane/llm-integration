# CopilotKit Vue Validation

一个与 EnchantForge runtime 完全隔离的 CopilotKit Vue 验证项目，用于观察
CopilotKit 在 Text to Form 和 Focus View 场景中的实际接入方式。

## 目录中的两个示例

- **Text to Form**：`useAgentContext` 显式提供表单字段和当前值，
  `useFrontendTool` 注册填写与清空操作。
- **Focus View**：`useAgentContext` 显式提供面板目录和交互规则，分别注册高亮、
  单面板详情、组合视图和清除高亮四个 Tool。

切换示例会卸载当前 Vue 页面。CopilotKit composable 随组件生命周期自动注销该页面的
Context 和 Tools。

## 配置

复制 `.env.example` 为 `.env` 并填写 OpenAI-compatible 接口。为了便于在当前仓库中
验证，如果项目目录没有 `.env`，Runtime 也会读取上一级仓库已有的 `.env`。

```dotenv
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=replace-me
LLM_MODEL=gpt-4.1-mini
```

## 运行

```bash
cd copilotkit-validation
pnpm install
pnpm dev
```

- Vue: <http://127.0.0.1:5190>
- Copilot Runtime info: <http://127.0.0.1:8200/api/copilotkit/info>

## 关键接入代码

应用根部：

```vue
<CopilotKitProvider runtime-url="/api/copilotkit">
  <CurrentPage />
  <CopilotChat />
</CopilotKitProvider>
```

页面 Context：

```ts
useAgentContext({
  description: '当前页面的结构和状态',
  value: () => pageState
});
```

页面 Tool：

```ts
useFrontendTool({
  name: 'fillShippingForm',
  description: '填写当前快递表单，但不要提交',
  parameters: z.object({ receiverName: z.string() }),
  handler: async ({ receiverName }) => {
    form.receiverName = receiverName;
    return '表单已填写。';
  }
});
```

该项目不使用 Enchant、Enchantment、registry、snapshot、scanner 或 executor，便于直接
观察 CopilotKit 原生抽象需要业务页面显式承担哪些工作。

## 用于比较的观察点

1. **页面信息需要显式组织**：`useAgentContext` 不读取 Vue 组件或 DOM，页面负责提供
   严格 JSON 可序列化的 Context。
2. **操作需要逐个注册**：每个动作都需要 Tool 名称、描述、Zod schema 和 handler。
3. **语义存在重复**：表单字段既出现在 Context 中，也出现在 Tool schema 中；Focus
   View 的触发边界同时写在 Context 规则和 Tool 描述中。
4. **生命周期由框架管理**：页面卸载时，对应 Context 和 Tools 会自动注销，这是
   CopilotKit 已经提供的能力。
5. **Agent 基础设施完整**：Runtime、SSE、Chat、Tool Call、Threads 和 Inspector 已经
   由 CopilotKit 提供，无需在 UI metadata 框架中重复实现。
6. **没有现有 UI 适配层**：本项目仍需手写 Ant Design Vue 表单状态和 ECharts 面板
   语义；CopilotKit 负责调用，不负责发现这些结构。

这些观察用于比较抽象边界，不是对 CopilotKit 能力优劣的结论。
