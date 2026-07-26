# Dashboard Vue

这是一个配置驱动的 Vue Dashboard 平台示例，包含航班运行与延误分析、北京空气质量、NYC Taxi 和 OpenTelemetry Demo 四个专题。前端只负责通用 Dashboard/Panel 渲染和运行时交互；专题数据集、筛选定义、Panel QuerySpec 和 Assistant prompt 由 Node 配置服务返回。

## Run

```bash
cp .env.example .env
pnpm --filter @enchantforge/dashboard-vue dev
```

`dev` 会同时启动 Vite 和 Node 数据查询服务。先准备 SQLite：

```bash
pnpm --filter @enchantforge/data-sources data:process -- --dataset aviation-ontime
pnpm --filter @enchantforge/data-sources data:process -- --dataset beijing-air-quality
pnpm --filter @enchantforge/data-sources data:process -- --dataset nyc-taxi
pnpm --filter @enchantforge/data-sources data:process -- --dataset otel-demo
```

也可以单独启动查询服务：

```bash
pnpm --filter @enchantforge/dashboard-vue data:serve
```

默认服务地址为 `http://127.0.0.1:5176`，可用 `DASHBOARD_DB` 指向其他 SQLite 文件，使用 `DASHBOARD_DATA_PORT` 修改端口。页面只通过 `/api/dashboard/config` 和 `/api/dashboard/query` 读取配置、QuerySpec 和查询结果，不把航班明细打包进浏览器。常用指标查询优先使用 `aviation_dashboard_rollup`，航班明细和 P95 查询才读取 `aviation_flights`。

打开 `http://localhost:5175/dashboard/#air-quality` 可进入 Beijing Air Quality Dashboard。空气质量 Panel 使用 `air_quality_dashboard_rollup`，支持日期范围、监测站筛选和 Air Quality Assistant 分析。

打开 `http://localhost:5175/dashboard/#taxi` 可进入 NYC Taxi Dashboard。出租车 Panel 使用 `nyc_taxi_dashboard_rollup`，支持日期范围、行政区和上车区域筛选。`http://localhost:5175/dashboard/#panels` 是跨专题的统一 Panel Library。

打开 `http://localhost:5175/dashboard/#otel` 可进入 OpenTelemetry Dashboard。它使用真实采集后生成的服务、依赖、Metric 和日志分钟聚合表，并默认选择最新采集批次。首次准备数据：

```bash
pnpm --filter @enchantforge/data-sources data:collect:otel -- --duration 300 --scenario baseline
pnpm --filter @enchantforge/data-sources data:process -- --dataset otel-demo
```

服务拓扑是通用 `graph` Panel：节点和边完全来自 QuerySpec 返回的 source/target 维度，不在 Vue 前端维护固定服务列表。

NYC Taxi 的处理流程会读取 `yellow_tripdata_2025-01.parquet` 和 `taxi_zone_lookup.csv`，将行程时长、区域名称、车费、总收入等字段清洗后写入 `nyc_taxi_trips`、`nyc_taxi_zones` 和 `nyc_taxi_dashboard_rollup`。缺少原始文件或 `pyarrow` 时，页面只显示数据服务错误，不会使用模拟数据。

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
pnpm --filter @enchantforge/data-sources data:plan -- --dataset nyc-taxi
pnpm --filter @enchantforge/data-sources data:download -- --dataset nyc-taxi
```

地址清单、下载文件和清洗后的 SQLite 会写入 `examples/data-sources/data/`。如果数据库不存在，Node 服务会返回明确错误，不会回退到伪造的分析结果。

## Example requests

- `读取当前 JFK 晚高峰的延误数据，指出最严重的时间段`
- `把调查范围切换到 18 点到 21 点，并高亮趋势和延误原因 Panel`
- `添加一个航空公司平均延误排名 Panel，并保存当前视图`

`Flight Ops Assistant` 的提示中还内置了机场 P95、航空公司比较、延误原因构成、出港/到港比较等可直接尝试的问题。助手会先读取相关 Panel 数据，再使用已注册的筛选、高亮、添加模板 Panel 和保存视图能力；它不会对当前数据没有覆盖的原因做推断。机场显示使用中文名称并保留 IATA 代码，NAS 表示国家空域系统/空管流量限制。

如果没有可用 LLM，页面仍可使用筛选、Panel 联动、保存视图和 Debug trace；Aura 会显示配置或请求错误，不伪造分析结果。
