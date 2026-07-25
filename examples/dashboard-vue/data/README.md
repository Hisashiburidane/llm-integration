# Aviation data directory

The dashboard reads its panel configuration and query results from the Node data service backed by `examples/data-sources/data/dashboard.sqlite`.
`src/data/aviation.ts` is retained only as a typed migration fallback; it is not used as the page data source after the service starts.

这里有三种不同状态，不要混为一谈：

- `src/data/aviation.ts`：迁移期间的类型和默认值兜底，不作为页面数据源；
- `examples/data-sources/data/aviation-ontime/raw/*.zip`：通过下面命令下载的 BTS 原始压缩包；
- `examples/data-sources/data/dashboard.sqlite`：清洗后的 `aviation_flights` 及 Node 服务写入的 Dashboard 配置表；
- `scripts/query-server.mjs`：从 SQLite 读取配置、Panel、QuerySpec 和聚合结果。

## 可直接下载

航班 BTS 原始数据统一由 `@enchantforge/data-sources` 管理，使用以下两步：

```bash
pnpm --filter @enchantforge/data-sources data:plan -- --dataset aviation-ontime
pnpm --filter @enchantforge/data-sources data:download -- --dataset aviation-ontime
```

默认下载 2025 年 7 月数据。压缩包写入 `examples/data-sources/data/aviation-ontime/raw/`，校验文件写入同目录的 `checksums.sha256`。

Generate the official monthly URL list from the unified data-source package without making a network request:

```bash
pnpm --filter @enchantforge/data-sources data:plan -- --dataset aviation-ontime
```

The command writes:

- `examples/data-sources/data/aviation-ontime/download-urls.txt`: one BTS archive URL per line;
- `examples/data-sources/data/aviation-ontime/download-plan.json`: source metadata, target paths, planned transformations, and limitations.

## Script parameters

统一数据源脚本支持：

- `--dataset aviation-ontime`：只处理航班 BTS 数据；
- `--force`：覆盖已有压缩包；
- `--help`：打印用法。

The current unified aviation plan covers 2025-07. The plan generator currently exposes a fixed monthly aviation entry; changing the period requires updating the catalog entry in `examples/data-sources/scripts/generate-data-plans.mjs` before regenerating it.

```bash
pnpm --filter @enchantforge/data-sources data:plan -- --dataset aviation-ontime
```

To download the files directly, run:

```bash
pnpm --filter @enchantforge/data-sources data:download -- --dataset aviation-ontime
```

This reads the generated plan, stores archives under the unified `data-sources` directory, and writes a checksum file. Processing those archives into SQLite is a separate command:

```bash
pnpm --filter @enchantforge/data-sources data:process -- --dataset aviation-ontime
```

The dashboard does not claim to be a live operational feed; it reads the downloaded and cleaned snapshot selected by the local SQLite database.

The unified `data:download` supports:

- `--force`: replace an existing archive instead of skipping it;
- `--help`: print usage and exit.

The `--` after the pnpm script name separates pnpm arguments from script arguments. The downloader requires Bash, `curl`, and either `shasum` or `sha256sum`.

The shell downloader delegates networking to `curl`, so it honors `HTTPS_PROXY`, `HTTP_PROXY`, `ALL_PROXY`, their lowercase variants, and `NO_PROXY`.

If a previous download left a `.part` file and the server does not support byte-range resume, the unified script automatically removes the partial file and retries from the beginning.
