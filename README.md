# EnchantForge

Progressive AI interaction experiments organized as a pnpm workspace.

See `AGENTS.md` for project-level instructions for coding agents.

- [项目简介](./docs/project-brief.md)
- [产品与架构规格](./specs/README.md)

## Projects

- `packages/vue`: publishable Vue integration library (`@enchantforge/vue`)
- `examples/vue`: interactive Vue examples consuming the workspace library
- `examples/react-dashboard`: standalone React dashboard example
- `website`: project introduction portal
- `specs`: product and architecture specifications

## Commands

```bash
pnpm install
pnpm build
pnpm dev
pnpm dev:examples
pnpm dev:react-example
```

Run a single build with `pnpm build:lib`, `pnpm build:examples`, or `pnpm build:website`.
`pnpm dev` builds the library once, then starts the portal on port 5173 and the
Vue examples on port 5174. Set `VITE_EXAMPLES_URL` or `VITE_PORTAL_URL` to
override these links in a custom deployment.

Copy the relevant `.env.example` to `.env` under `examples/vue` or
`examples/react-dashboard`, then configure an OpenAI-compatible endpoint. Both
Vite dev servers proxy `/api/llm` using the server-only `LLM_BASE_URL`,
`LLM_API_KEY`, and `LLM_MODEL` values; the API key is not exposed to browser
code. Production deployments must provide the same `/api/llm` reverse proxy.
