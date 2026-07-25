# Secondary example data sources

This package contains source plans for future Dashboard topics. It does not add domain models or claim that these topics are implemented.

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
| `online-retail-ii` | 电商交易 | `ready` | UCI Online Retail II ZIP | 直接下载到 `data/online-retail-ii/raw/` |
| `beijing-air-quality` | 空气质量 | `ready` | 北京多站点空气质量 ZIP | 直接下载到 `data/beijing-air-quality/raw/` |
| `nyc-taxi` | 城市出行 | `ready` | NYC Yellow Taxi Parquet、Taxi Zone CSV | 直接下载到 `data/nyc-taxi/raw/` |
| `otel-demo` | 云原生可观测性 | `collect` | 无静态文件 | 只输出 OpenTelemetry Demo 采集步骤 |
| `cicids2017` | 网络安全 | `manual` | 无稳定直链 | 打开官方页面后手动下载 |
| `cmapps` | 预测性维护 | `unavailable` | 无 | NASA 当前标记为不可下载，不执行下载 |

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

Plans with status `collect`, `manual`, or `unavailable` do not have direct URLs and are reported without a download attempt. The `--` after the pnpm script name separates pnpm arguments from script arguments. The downloader requires Bash, `curl`, and either `shasum` or `sha256sum`.

Archives and Parquet files are written below `examples/data-sources/data/<dataset>/raw/`. SHA-256 manifests are written below the ignored `manifests/` directories. The generated plan for OpenTelemetry Demo describes a collection workflow rather than a static file; CIC-IDS2017 requires a manual download from its provider page; NASA currently marks C-MAPSS unavailable, so no mirror is substituted.

The shell downloader delegates networking to `curl`, so it honors `HTTPS_PROXY`, `HTTP_PROXY`, `ALL_PROXY`, their lowercase variants, and `NO_PROXY`. For example:

```bash
HTTPS_PROXY=http://127.0.0.1:7890 \
  pnpm --filter @enchantforge/data-sources data:download -- --dataset nyc-taxi
```

The source choices follow the planned topics: UCI Online Retail II for retail, UCI Beijing Multi-Site Air Quality for environment, and NYC TLC Yellow Taxi records for mobility. Each plan records its provider page, license note, transformations, and limitations.
