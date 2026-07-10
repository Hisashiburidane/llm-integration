# Progressive AI Interaction Framework for Vue Apps - Specs

This directory defines the product and implementation specs for a Vue-only progressive AI interaction framework.

The current demo is exploratory. These specs describe the intended production direction and should drive future implementation.

## Spec Index

1. [Product Vision](./01-product-vision.md)
2. [Scenario Catalog](./02-scenario-catalog.md)
3. [Vue Architecture](./03-vue-architecture.md)
4. [Metadata Model](./04-metadata-model.md)
5. [Progressive Scanning](./05-progressive-scanning.md)
6. [Assistant UX](./06-assistant-ux.md)
7. [Executor and Tools](./07-executor-and-tools.md)
8. [Workflow and Semantic Snapshot](./08-workflow-and-snapshot.md)
9. [Safety and Policy](./09-safety-and-policy.md)
10. [Micro App Integration](./10-micro-app-integration.md)

## Non-goals

- Do not build a generic visual agent.
- Do not require every page to hand-write AI tools before it becomes useful.
- Do not make high-risk business operations automatic by default.

## Core Principle

AI interaction should grow from Vue UI structure progressively:

1. Wrapper scans what already exists.
2. Directives add semantic hints where needed.
3. Explicit registration provides production-grade stability.
4. Assistants and workflows reuse the same metadata and executor layer.