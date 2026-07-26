# Example data sources

This package contains source plans and deterministic SQLite processing for the Dashboard examples.

航班 Dashboard 也已纳入本统一数据源工具。所有原始下载包统一写入本目录的 `data/<dataset>/raw/`，清洗后的航班明细和分析结果统一写入 SQLite。

## 可直接下载

当前有四个数据集提供稳定直链：

| 数据集 | 命令 | 本地目录 |
| --- | --- | --- |
| 航班 BTS On-Time | `pnpm --filter @enchantforge/data-sources data:download -- --dataset aviation-ontime` | `data/aviation-ontime/raw/` |
| Online Retail II | `pnpm --filter @enchantforge/data-sources data:download -- --dataset online-retail-ii` | `data/online-retail-ii/raw/` |
| 北京多站点空气质量 | `pnpm --filter @enchantforge/data-sources data:download -- --dataset beijing-air-quality` | `data/beijing-air-quality/raw/` |
| NYC Yellow Taxi | `pnpm --filter @enchantforge/data-sources data:download -- --dataset nyc-taxi` | `data/nyc-taxi/raw/` |

下载全部四个有直链的数据集：

```bash
pnpm --filter @enchantforge/data-sources data:plan
pnpm --filter @enchantforge/data-sources data:download
```

Generate all plans and URL lists without making network requests:

```bash
pnpm --filter @enchantforge/data-sources data:plan
pnpm --filter @enchantforge/data-sources data:plan -- --dataset online-retail-ii
```

`data:plan` supports:

- `--dataset <id>`: generate only one plan; omit it to generate all plans;
- `--help`: list supported dataset IDs and print usage.

`--dataset` 只能填写下面这些完整 ID，不支持使用 `retail`、`air-quality` 等缩写，也不接受年份作为 dataset 参数：

| `--dataset` 值 | 专题 | 状态 | 计划中的文件 | 执行结果 |
| --- | --- | --- | --- | --- |
| `aviation-ontime` | 航班运行 | `ready` | BTS 2025-07 月度 ZIP | 直接下载到 `data/aviation-ontime/raw/` |
| `online-retail-ii` | 电商交易 | `ready` | UCI Online Retail II ZIP | 直接下载到 `data/online-retail-ii/raw/` |
| `beijing-air-quality` | 空气质量 | `ready` | 北京多站点空气质量 ZIP | 直接下载到 `data/beijing-air-quality/raw/` |
| `nyc-taxi` | 城市出行 | `ready` | NYC Yellow Taxi Parquet、Taxi Zone CSV | 直接下载到 `data/nyc-taxi/raw/` |
| `otel-demo` | 云原生可观测性 | `collect` | OTLP traces、metrics、logs | 启动官方 Demo 后采集到 `data/otel-demo/raw/<capture-id>/` |

例如，以下命令只处理 NYC Taxi：

```bash
pnpm --filter @enchantforge/data-sources data:plan -- --dataset nyc-taxi
pnpm --filter @enchantforge/data-sources data:download -- --dataset nyc-taxi
```

每个 dataset 目录下的 `download-plan.json` 都包含这些字段：

- `datasetId`：命令行使用的 ID；
- `name`、`topic`：数据集名称和专题分类；
- `status`：`ready`、`collect`、`manual` 或 `unavailable`；
- `provider`、`sourcePage`、`license`：来源和许可信息；
- `files`：可下载文件的 `name`、`url`、`downloadTo` 和 checksum 状态；
- `commands`：没有静态文件时的采集或手动下载步骤；
- `transformations`：后续清洗时允许的确定性衍生字段；
- `limitations`：数据时间范围、缺失值和使用限制。

Download only the direct-file datasets:

```bash
pnpm --filter @enchantforge/data-sources data:download -- --dataset online-retail-ii
pnpm --filter @enchantforge/data-sources data:download -- --dataset beijing-air-quality
pnpm --filter @enchantforge/data-sources data:download -- --dataset nyc-taxi
```

`data:download` supports:

- `--dataset <id>`: download only one plan; omit it to process all plans with direct URLs;
- `--force`: replace existing files instead of skipping them;
- `--help`: print usage and exit.

The `--` after the pnpm script name separates pnpm arguments from script arguments. The downloader requires Bash, `curl`, and either `shasum` or `sha256sum`.

Archives and Parquet files are written below `examples/data-sources/data/<dataset>/raw/`. SHA-256 files are written beside each dataset's `raw/` directory.

The shell downloader delegates networking to `curl`, so it honors `HTTPS_PROXY`, `HTTP_PROXY`, `ALL_PROXY`, their lowercase variants, and `NO_PROXY`. For example:

```bash
HTTPS_PROXY=http://127.0.0.1:7890 \
  pnpm --filter @enchantforge/data-sources data:download -- --dataset nyc-taxi
```

If a previous download left a `.part` file and the server does not support byte-range resume, the script automatically removes the partial file and retries from the beginning.

## 生成 OpenTelemetry Demo 数据

`otel-demo` 没有静态下载地址。它使用官方 OpenTelemetry Demo、内置负载生成器和 Collector `file` exporter 生成可复现的 OTLP JSON：

```bash
pnpm --filter @enchantforge/data-sources data:plan -- --dataset otel-demo
pnpm --filter @enchantforge/data-sources data:collect:otel -- --duration 300 --scenario baseline
```

采集脚本支持：

- `--duration <seconds>`：预热结束后的采集时长，默认 300 秒；
- `--warmup <seconds>`：正式采集前的预热时长，默认 60 秒；
- `--ref <git-ref>`：OpenTelemetry Demo 的 branch、tag 或 commit，默认 `main`；manifest 会记录最终 commit；
- `--scenario <label>`：写入 manifest 的场景标签，例如 `baseline` 或 `payment-failure`；
- `--stack <minimal|full>`：默认 `minimal`，启动核心服务、负载生成器和 Collector；`full` 额外启动 Kafka、Jaeger、Prometheus、OpenSearch、Grafana 等后端；
- `--demo-dir <path>`：复用指定的干净 OpenTelemetry Demo checkout；
- `--help`：显示参数和运行说明。

脚本要求 Docker、Docker Compose、Git 和 Node.js。默认 minimal 模式约需 3 GB 内存；完整模式按官方说明约需 6 GB 内存和 14 GB 磁盘。脚本预热后重新启动 Collector 并采集 `traces.jsonl`、`metrics.jsonl`、`logs.jsonl`，完成后关闭整个 Compose stack。需要故障样本时，在采集期间打开 `http://localhost:8080/feature` 启用官方 feature flag，并使用对应的 `--scenario` 标签记录操作意图。

The source choices follow the planned topics: BTS On-Time Performance for aviation, UCI Online Retail II for retail, UCI Beijing Multi-Site Air Quality for environment, and NYC TLC Yellow Taxi records for mobility. Each plan records its provider page, license note, transformations, and limitations.

航空数据目录中的 `data/aviation-ontime/airport-reference.csv` 是从 OpenFlights/OurAirports 公开机场名称数据整理出的 IATA 代码、官方英文名和城市参考。清洗时人工中文字典优先；其余机场使用官方英文名和城市，不再退化为只有 `机场（CODE）` 的标签。机场参考源：`https://github.com/jpatokal/openflights/blob/master/data/airports.dat`。

## 写入 SQLite

安装 XLSX 和 Parquet 读取依赖：

```bash
uv sync
```

处理所有已下载的数据集：

```bash
pnpm --filter @enchantforge/data-sources data:process -- --dataset all
```

SQLite 默认写入 `data/dashboard.sqlite`。也可以只处理一个数据集或指定数据库路径：

```bash
pnpm --filter @enchantforge/data-sources data:process -- --dataset aviation-ontime
pnpm --filter @enchantforge/data-sources data:process -- --dataset nyc-taxi --db data/nyc.sqlite
pnpm --filter @enchantforge/data-sources data:process -- --dataset otel-demo
```

`data:process` 由 Typer 提供 CLI。运行 `pnpm --filter @enchantforge/data-sources data:process -- --help` 可查看完整帮助；它支持 `--dataset all|aviation-ontime|online-retail-ii|beijing-air-quality|nyc-taxi|otel-demo`、`--db PATH` 和 `--strict`。默认缺少原始文件或 Python 依赖时跳过并报告；`--strict` 会将这类情况视为失败。脚本只读取原始文件并重建对应表，不生成模拟记录。

也可以绕过 pnpm 直接使用 Typer CLI：

```bash
uv run python scripts/process-data.py --help
```

生成的业务表包括 `aviation_flights`、`retail_transactions`、`air_quality_observations`、`nyc_taxi_trips` 和对应字典、rollup。OpenTelemetry 采集生成：

| 表 | 用途 |
| --- | --- |
| `otel_capture_runs` | 采集窗口、场景标签和上游 commit |
| `otel_services` | 从 Resource attributes 提取的服务目录 |
| `otel_spans` | Trace/Span、服务、操作、耗时、状态和属性 |
| `otel_metric_points` | Gauge、Sum、Histogram 等 OTLP 指标点 |
| `otel_logs` | 日志正文、严重级别及 Trace/Span 关联 |
| `otel_service_minute_rollup` | 每分钟服务 Span 数、错误数、平均/P95/最大耗时 |
| `otel_service_edge_rollup` | 跨服务调用次数、错误数、平均/P95 耗时 |
| `otel_metric_minute_rollup` | 每分钟服务指标聚合 |

这些表只保存实际采集到的 OTLP 信号。服务关系由父子 Span 确定，错误由 Span status 确定；场景标签不会被当作根因证据。
