# Dashboard Vue

这是一个独立的 Vue Dashboard 示例，当前实现航班运行与延误分析专题。开发服务从 `examples/data-sources/data/dashboard.sqlite` 查询已清洗的 BTS 航班数据；来源和限制由 Node 配置服务返回。

## Run

```bash
cp .env.example .env
pnpm --filter @enchantforge/dashboard-vue dev
```

`dev` 会同时启动 Vite 和 Node 数据查询服务。先准备 SQLite：

```bash
pnpm --filter @enchantforge/data-sources data:process -- --dataset aviation-ontime
```

也可以单独启动查询服务：

```bash
pnpm --filter @enchantforge/dashboard-vue data:serve
```

默认服务地址为 `http://127.0.0.1:5176`，可用 `DASHBOARD_DB` 指向其他 SQLite 文件，使用 `DASHBOARD_DATA_PORT` 修改端口。页面只通过 `/api/dashboard/config` 和 `/api/dashboard/query` 读取配置、QuerySpec 和查询结果，不把航班明细打包进浏览器。常用指标查询优先使用 `aviation_dashboard_rollup`，航班明细和 P95 查询才读取 `aviation_flights`。

LLM 配置使用 OpenAI-compatible Chat Completions endpoint：

```dotenv
LLM_BASE_URL=https://api.openai.com/v1/chat/completions
LLM_API_KEY=
LLM_MODEL=gpt-4o-mini
```

Vite dev server 会把 `/api/llm/*` 代理到 `LLM_BASE_URL` 的 origin/path；页面代码只使用 `Aura` 和已注册 capability，不直接处理代理细节。

## BTS data

航班原始数据由统一的 `@enchantforge/data-sources` 工具管理：

```bash
pnpm --filter @enchantforge/data-sources data:plan -- --dataset aviation-ontime
pnpm --filter @enchantforge/data-sources data:download -- --dataset aviation-ontime
```

地址清单、下载文件和清洗后的 SQLite 会写入 `examples/data-sources/data/`。如果数据库不存在，Node 服务会返回明确错误，不会回退到伪造的分析结果。

## Example requests

- `读取当前 JFK 晚高峰的延误数据，指出最严重的时间段`
- `把调查范围切换到 18 点到 21 点，并高亮趋势和延误原因 Panel`
- `添加一个航空公司平均延误排名 Panel，并保存当前视图`

`Flight Ops Assistant` 的提示中还内置了机场 P95、航空公司比较、延误原因构成、出港/到港比较等可直接尝试的问题。助手会先读取相关 Panel 数据，再使用已注册的筛选、高亮、添加模板 Panel 和保存视图能力；它不会对当前数据没有覆盖的原因做推断。

如果没有可用 LLM，页面仍可使用筛选、Panel 联动、保存视图和 Debug trace；Aura 会显示配置或请求错误，不伪造分析结果。
