# Dashboard Vue

这是一个独立的 Vue Dashboard 示例，当前实现航班运行与延误分析专题。它使用固定、确定性的演示 fixture，不代表实时机场数据；来源和限制见页面底部及 `src/data/aviation.ts`。

## Run

```bash
cp .env.example .env
pnpm --filter @enchantforge/dashboard-vue dev
```

LLM 配置使用 OpenAI-compatible Chat Completions endpoint：

```dotenv
LLM_BASE_URL=https://api.openai.com/v1/chat/completions
LLM_API_KEY=
LLM_MODEL=gpt-4o-mini
```

Vite dev server 会把 `/api/llm/*` 代理到 `LLM_BASE_URL` 的 origin/path；页面代码只使用 `Aura` 和已注册 capability，不直接处理代理细节。

## BTS data

示例默认使用 `src/data/aviation.ts` 中的固定 fixture。航班原始数据由统一的 `@enchantforge/data-sources` 工具管理：

```bash
pnpm --filter @enchantforge/data-sources data:plan -- --dataset aviation-ontime
pnpm --filter @enchantforge/data-sources data:download -- --dataset aviation-ontime
```

地址清单和计划 manifest 会写入 `examples/data-sources/data/aviation-ontime/`。原始数据接入和清洗仍是后续任务，当前页面不会把下载文件冒充为实时数据。

## Example requests

- `读取当前 JFK 晚高峰的延误数据，指出最严重的时间段`
- `把调查范围切换到 18 点到 21 点，并高亮趋势和延误原因 Panel`
- `添加一个航空公司平均延误排名 Panel，并保存当前视图`

如果没有可用 LLM，页面仍可使用筛选、Panel 联动、保存视图和 Debug trace；Aura 会显示配置或请求错误，不伪造分析结果。
