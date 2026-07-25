# Aviation data directory

The dashboard currently runs with the deterministic fixture in `src/data/aviation.ts`.
This directory is reserved for the public BTS data workflow.

这里有三种不同状态，不要混为一谈：

- `src/data/aviation.ts`：页面当前实际使用的固定演示 fixture；
- `data/raw/*.zip`：通过下面命令下载的 BTS 原始压缩包；
- 原始压缩包接入查询引擎：尚未完成，当前页面不会自动读取 `data/raw`。

## 可直接下载

航班 BTS 数据使用以下两步：

```bash
pnpm --filter @enchantforge/dashboard-vue data:plan
pnpm --filter @enchantforge/dashboard-vue data:download
```

默认下载 2025 年 7 月数据。压缩包写入 `data/raw/`，校验文件写入 `data/checksums.sha256`。要下载其他月份，先用 `data:plan -- --from YYYY-MM --to YYYY-MM` 重新生成计划。

Generate the official monthly URL list without making a network request:

```bash
pnpm --filter @enchantforge/dashboard-vue data:plan
```

The command writes:

- `download-urls.txt`: one BTS archive URL per line;
- `download-plan.json`: source metadata, target paths, planned transformations, and limitations.

## Script parameters

`data:plan` supports:

- `--from YYYY-MM`: inclusive first month; default `2025-07`;
- `--to YYYY-MM`: inclusive last month; default `2025-07`;
- `--help`: print usage.

For example, generate one quarter:

```bash
pnpm --filter @enchantforge/dashboard-vue data:plan -- --from 2025-07 --to 2025-09
```

If you want the workspace to download the files directly, run:

```bash
pnpm --filter @enchantforge/dashboard-vue data:download
```

This reads the generated plan, stores archives under `data/raw/`, and writes checksums to the ignored `data/manifests/download-manifest.json`. You can also download the URLs manually. Processing those archives into the dashboard fixture is a separate task; until then, the example does not claim to use live or downloaded data.

`data:download` supports:

- `--force`: replace an existing archive instead of skipping it;
- `--help`: print usage and exit.

The `--` after the pnpm script name separates pnpm arguments from script arguments; it is required when passing options through pnpm. The downloader requires Bash, `curl`, and either `shasum` or `sha256sum`.

The shell downloader delegates networking to `curl`, so it honors `HTTPS_PROXY`, `HTTP_PROXY`, `ALL_PROXY`, their lowercase variants, and `NO_PROXY`.

If a previous download left a `.part` file and the server does not support byte-range resume, the script automatically removes the partial file and retries from the beginning.
