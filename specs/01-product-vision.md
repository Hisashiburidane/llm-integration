# 01. Product Vision

## Name

Working name:

**Progressive AI Interaction Framework for Vue Apps**

Chinese positioning:

**面向 Vue 应用的渐进式 AI 交互框架**

## One-line Pitch

Let existing Vue interfaces progressively gain AI-readable, AI-actionable, and AI-composable interaction capabilities.

## Why This Exists

LLMs are highly productive in coding because code is structured, textual, callable, and verifiable. Ordinary web applications do not expose the same affordances:

- UI state is distributed across component instances.
- Business meaning is hidden behind labels, handlers, and local state.
- DOM and screenshots are visually available but semantically weak.
- Hand-written AI tools for every page are expensive to build and maintain.

This framework turns Vue UI into structured interaction context.

## Product Thesis

The framework should not be sold as another chatbot. It should be an interaction layer that lets Vue applications expose their own UI structure, state, fields, and actions to AI in a progressive way.

The product value is not simply summarization. The value is enabling users to convert natural language and semi-structured information into safe, visible, editable UI state.

## Design Philosophy

### Vue Product Direction

All product docs, examples, and first-stage implementation target Vue.

### Progressive Enhancement

Adoption must be incremental:

1. Add a wrapper and get basic DOM scanning.
2. Add directives and hints to improve semantic quality.
3. Register fields/actions for robust execution.
4. Save repeated interactions as workflows or semantic snapshots.

### Local-first, Global-capable

- Local component agents should work inside one wrapper without exposing metadata globally.
- A global assistant can coordinate visible global scopes.
- Components can opt out of global exposure.

### Metadata over Vision

Visual agents are useful as a universal fallback, but too slow, costly, and unreliable for many enterprise web apps. This framework uses metadata and runtime state as the primary source of truth.

### Safe by Default

The first product focus is low-risk assistance:

- fill form drafts
- highlight fields
- explain validation errors
- prepare tickets
- create focus views
- restore semantic views

High-risk operations such as payment, approval, deletion, and irreversible submission must require explicit policy and confirmation.

## What Should Feel Amazing

The user should not feel that they are chatting with a separate bot. They should feel that the page itself understands their intent and moves with them.

Examples:

- Paste messy text and watch a form fill itself correctly.
- A hotline transcript triggers a suggested action at the right time.
- A validation failure is explained by a small assistant next to the form.
- A saved workflow visibly replays page operations step by step.
- A semantic snapshot restores a view by driving the UI, not by silently loading URL params.

## Success Criteria

A demo is successful if a viewer understands:

- why metadata is more reliable than screenshot guessing;
- why wrapper-first adoption is cheaper than hand-writing tools for every page;
- why local and global agents can coexist;
- why the framework improves interaction without requiring full business automation;
- how a Vue team could add it to existing pages gradually.
