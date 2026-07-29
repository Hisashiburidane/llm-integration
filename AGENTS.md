# AGENTS.md

This file defines project-level instructions for coding agents working in this repository.

## 1. Primary Goal

Build a progressive Vue-first LLM integration framework.

Key properties:
- minimal integration cost for simple scenarios
- incremental escape hatches for complex scenarios
- wrapper-first design
- metadata-driven runtime
- clear separation between library, examples, and website

The project is not a generic AI playground. Every change should strengthen the framework story.

## 2. Repository Priorities

Priority order:
1. `packages/vue`: framework and reusable runtime
2. `examples/vue`: canonical examples of framework usage
3. `website`: presentation of concept, philosophy, and examples
4. `specs`: source of product and architecture intent
5. `examples/react-dashboard` and `poc`: legacy or secondary material

If a change improves examples but weakens the framework abstraction, the change is wrong.

## 3. Technology Direction

- Primary framework: Vue
- Primary example stack: Vue + Ant Design Vue + ECharts
- React is not the narrative center of this project
- Architecture may preserve future React support, but current design and documentation should speak in Vue terms

Do not describe the project as React-first or cross-framework-first.

## 4. API Design Rules

Always prefer layered APIs.

### 4.1 Progressive layers

The framework should expose at least three conceptual layers:

1. zero or near-zero configuration wrapper usage
2. low-configuration high-level runtime API
3. lower-level extension points for complex systems

Simple scenarios must stay simple. Complex scenarios may expose more control, but must not pollute the first layer.

### 4.2 Example of desired direction

Good direction:

```vue
<Enchant prompt="帮我把这段文本填进表单，但不要提交">
  <EnchantExpressForm />
</Enchant>
```

Also acceptable:

```ts
const form = defineModel<Record<string, unknown>>({ required: true });
useEnchantForm(form);
```

The DOM compatibility example must opt in explicitly with `scan="auto"`; do not present it as the default behavior.

Bad direction:
- forcing example users to understand scopes, registries, execution plans, or metadata trees before they can run a basic demo
- exposing too many internal runtime concepts in the first example

## 5. Example Design Rules

Examples are product proof, not internal implementation dumps.

Requirements:
- visible demo names must be natural and concise
- do not expose artificial level names such as `L1/L2/L3`
- do not expose internal implementation variants unless they are the point of the page
- example code shown to users must be short and readable
- example code must stay logically consistent with real implementation
- if implementation requires multiple files, prefer one short visible integration snippet and separate internal files only when necessary

The shortest visible code is the most important code.

## 6. UI and UX Rules

- style should be clean, technical, and product-oriented
- avoid marketing fluff, cute mascots, or generic consumer-AI aesthetics unless explicitly requested for a demo
- avoid noisy gradients, decorative excess, and vague empty copy
- use Ant Design Vue and Ant Design X Vue components where they reduce wheel reinvention
- examples should feel like credible internal tooling, not slideware

## 7. Language and Writing Rules

Project copy should be precise, technical, and low-drama.

Avoid:
- low-information hype
- vague motivational copy
- Xiaohongshu-style phrases
- exaggerated marketing language
- slang that weakens precision

Do not use expressions like:
- `一把梭`
- `黑科技`
- `丝滑`
- similar low-precision internet phrasing

Prefer concrete wording such as:
- progressive API
- layered abstraction
- high-level API
- low-level extension point
- runtime metadata scan
- constrained execution

Documentation language policy:
- user-facing docs and examples may use Chinese
- code identifiers remain English
- comments should be minimal and useful

Detailed writing modes are defined in `docs/writing-standards.md`.

- portal headlines and product sections default to the product-copy standard
- submissions, demos, and launch materials default to the promotional standard
- README, API reference, specs, errors, and implementation notes default to the
  technical-documentation standard
- all modes share the same product facts and must not overstate implemented behavior
- style never overrides natural sentence order or technical logic; do not force
  rhyme, parallel phrasing, or punctuation-driven pauses
- abstract nouns such as capability, control, boundary, and value must name concrete
  objects and mechanisms; do not combine them into empty enterprise slogans

## 8. Architecture Rules

Maintain clear boundaries:
- library code belongs in `packages/vue`
- example-only visualization belongs in `examples/vue`
- website code should consume examples or documented concepts, not re-implement framework runtime

Do not let example-only workbench code leak into the public framework API without review.

Do not keep important runtime logic trapped in example files if it is broadly reusable.

## 9. Metadata and Runtime Principles

The framework should prefer explicit Vue contributions and stable adapters. DOM scanning is an opt-in compatibility path, not the default discovery mechanism.

Desired direction:
- wrapper aggregates explicitly contributed metadata and capabilities without reading DOM by default
- applications can opt into marked or full local DOM scanning when the compatibility tradeoff is acceptable
- page-level or app-level assistant can aggregate active scopes when needed
- internal page components may opt out of global registration
- framework should support both local use and global assistant use

The runtime should build a bridge between unstructured input and structured UI state.

### 9.1 Feature ownership

All capability and executor changes must follow
specs/11-feature-ownership-and-boundaries.md.

- Core owns mechanisms.
- Adapters own integration with stable technical contracts.
- Applications own business meaning, state, and effects.
- Examples do not define framework contracts.
- Metadata may be inferred; executable effects require an explicit owner and provider.

Do not move an example action into packages/vue only to make the example require
less code. If a feature cannot identify its owner, it must not be added to Core.

## 10. Safety and Execution Principles

This repository explores automation, but examples should default to safe boundaries.

Rules:
- prefer read, highlight, explain, prepare, and draft actions
- stop before irreversible actions unless the example explicitly demonstrates approval flow
- form fill examples should default to `do not submit`
- important business operations should be modeled with constrained execution and review points

## 11. Validation and Tooling Expectations

Do not waste time on heavyweight validation by default.

Preferred validation strategy:
- run targeted type checks when changing TypeScript or Vue files
- run narrow verification for touched packages
- do not run full builds or packaging loops unless requested or clearly necessary

Use `pnpm` for workspace commands.

## 12. Editing Rules for Agents

- read existing code before introducing abstractions
- preserve repository direction; do not drift into unrelated refactors
- prefer improving the framework API over expanding demo-only glue code
- when a visible example becomes too long, move complexity downward into reusable runtime APIs
- when naming anything user-visible, choose direct and unsurprising names

### Windows patch path

- In this managed Windows workspace, `apply_patch` may fail before parsing because the sandbox cannot create split writable roots.
- After that specific sandbox error, do not retry `apply_patch`.
- Use a UTF-8 unified diff piped to `git apply --whitespace=nowarn -` from the repository root; request escalation immediately when the sandbox requires it.
- Verify the result with `git diff --check` and a scoped diff.
- Do not fall back to PowerShell string replacement or `Set-Content` for source edits.

## 13. What to Optimize For

When in doubt, optimize for this order:
1. shortest credible integration path
2. architectural correctness
3. progressive extensibility
4. demo clarity
5. visual polish

If a change makes the first example harder to understand, it is probably the wrong change.
