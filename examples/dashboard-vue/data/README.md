# Aviation data directory

The dashboard currently runs with the deterministic fixture in `src/data/aviation.ts`.
This directory is reserved for the public BTS data workflow.

这里有三种不同状态，不要混为一谈：

- `src/data/aviation.ts`：页面当前实际使用的固定演示 fixture；
- `examples/data-sources/data/aviation-ontime/raw/*.zip`：通过下面命令下载的 BTS 原始压缩包；
- 原始压缩包接入查询引擎：尚未完成，当前页面不会自动读取原始压缩包。

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

This reads the generated plan, stores archives under the unified `data-sources` directory, and writes a checksum file. Processing those archives into the dashboard fixture is a separate task; until then, the example does not claim to use live or downloaded data.

The unified `data:download` supports:

- `--force`: replace an existing archive instead of skipping it;
- `--help`: print usage and exit.

The `--` after the pnpm script name separates pnpm arguments from script arguments. The downloader requires Bash, `curl`, and either `shasum` or `sha256sum`.

The shell downloader delegates networking to `curl`, so it honors `HTTPS_PROXY`, `HTTP_PROXY`, `ALL_PROXY`, their lowercase variants, and `NO_PROXY`.

If a previous download left a `.part` file and the server does not support byte-range resume, the unified script automatically removes the partial file and retries from the beginning.
