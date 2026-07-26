# Dashboard Vue

这是一个配置驱动的 Vue Dashboard 平台示例，包含航班运行与延误分析、北京空气质量、NYC Taxi 和 OpenTelemetry Demo 四个专题。前端只负责通用 Dashboard/Panel 渲染和运行时交互；专题数据集、筛选定义、Panel QuerySpec、Evidence Group 和 Assistant prompt 由 Node 配置服务返回。

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

首次准备数据库，或者需要将演示配置恢复到仓库初始状态时，运行：

```bash
pnpm --filter @enchantforge/dashboard-vue config:reset
```

该命令会清空并重新创建 Dashboard/Panel 配置，恢复 4 个初始 Dashboard、76 个 Panel 定义和 70 个 placement。它只操作 `dashboard_configs`、`panel_definitions`、`dashboard_panel_placements` 以及迁移时发现的旧 `dashboard_panels` 配置表，不修改原始数据、明细表、字典表、处理记录或 rollup 表。

命令支持：

```text
--database <path>  指定 SQLite 文件
-h, --help         查看帮助
```

未传入 `--database` 时依次读取 `DASHBOARD_DB` 和默认的 `examples/data-sources/data/dashboard.sqlite`。例如：

```bash
pnpm --filter @enchantforge/dashboard-vue config:reset -- --database ./examples/data-sources/data/dashboard.sqlite
```

默认服务地址为 `http://127.0.0.1:5176`，可用 `DASHBOARD_DB` 指向其他 SQLite 文件，使用 `DASHBOARD_DATA_PORT` 修改端口。查询服务启动时只确保配置表结构存在，不会自动创建或恢复 Dashboard/Panel。页面只通过 `/api/dashboard/config` 和 `/api/dashboard/query` 读取配置、QuerySpec 和查询结果，不把明细数据打包进浏览器。

`http://localhost:5175/dashboard/#dashboards` 是默认入口，打开 Dashboard Library；`http://localhost:5175/dashboard/#panels` 打开跨数据域的 Panel Library。具体 Dashboard 从 Library 中打开，不在平台导航中硬编码。

Panel Library 读取独立的 `panel_definitions`，支持跨数据域搜索、点击真实渲染单个 Panel，以及完整 CRUD。Panel 编辑不会自动改变 Dashboard placement；删除 Panel 时会同时移除所有 Dashboard 对它的 placement 引用。

Dashboard Library 中没有只读或不可删除的内置 Dashboard。所有 Dashboard 都支持查看、编辑、复制和删除，并可从兼容数据域的 Panel Library 快速加入 Panel、调整顺序、宽度和高度。仓库中的四套专题配置只是 `config:reset` 使用的初始配置来源。

Panel 和 Dashboard 编辑器都使用 `Enchant + useEnchantForm` 提供 Text-to-Form。自然语言只填写受约束的配置草稿，不直接生成 SQL/Vue，也不会自动保存；用户检查草稿并提交后，Node API 仍会校验数据源、指标维度和 Panel 引用。

从 Dashboard Library 打开 `otel-demo-observability` 可进入 OpenTelemetry Dashboard。它使用真实采集后生成的服务、依赖、Metric 和日志分钟聚合表，并默认选择最新采集批次。首次准备数据：

```bash
pnpm --filter @enchantforge/data-sources data:collect:otel -- --duration 300 --scenario baseline
pnpm --filter @enchantforge/data-sources data:process -- --dataset otel-demo
```

服务拓扑是通用 `graph` Panel：节点和边完全来自 QuerySpec 返回的 source/target 维度，不在 Vue 前端维护固定服务列表。OpenTelemetry 页面提供 24 个真实数据 Panel，覆盖延迟、错误、流量、服务依赖、日志和 Metric 采集。

`evidenceGroups` 将常见分析问题映射为 2-4 个互补 Panel。它属于 Dashboard 应用元数据，不是 Core spell；Aura 仍通过通用 `dashboard.read_data` 和 `dashboard.highlight` capability 完成多证据读取、高亮和回答。

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
