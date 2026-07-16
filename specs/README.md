# EnchantForge 规格文档

本目录记录 EnchantForge 的产品定义和技术规格。Enchant 组件从现有 Vue UI 生成 Enchantment 数据模型；Forge 聚合实时 metadata 和 capability；Aura 基于这些数据提供全局智能交互，并默认以 orb 形态呈现。

EnchantForge 对模型能力采取保守假设：模型可以解释、规划和请求执行，但应用仍是事实、规则和授权的来源。Aura 只感知当前有效且允许暴露的 Enchantment，不代表全局知识或隐含权限。

当前示例用于验证核心假设。框架实现、示例和官网内容应以本目录中的规格为依据。

## 文档索引

0. [EnchantForge 定位、架构与开发规划](./00-enchant-positioning-and-plan.md)
1. [产品愿景](./01-product-vision.md)
2. [场景目录](./02-scenario-catalog.md)
3. [Vue 架构](./03-vue-architecture.md)
4. [Metadata 模型](./04-metadata-model.md)
5. [渐进式扫描](./05-progressive-scanning.md)
6. [Aura 交互](./06-assistant-ux.md)
7. [Executor 与 Tools](./07-executor-and-tools.md)
8. [Workflow 与语义快照](./08-workflow-and-snapshot.md)
9. [安全与 Policy](./09-safety-and-policy.md)
10. [微应用集成](./10-micro-app-integration.md)

## 非目标

- 不构建通用视觉 Agent；
- 不要求每个页面先手写 AI tools 才能获得基础能力；
- 不默认执行审批、支付、删除等高风险业务操作；
- 不让示例专用逻辑替代可复用 runtime 设计。

## 核心原则

1. wrapper 扫描已有组件和 DOM；
2. UI adapter 补充框架组件语义和可靠执行能力；
3. directive、composable 和显式注册处理复杂业务语义；
4. 局部 AI 功能、全局 Aura 和外部集成复用同一套 metadata、capability 与 executor。
