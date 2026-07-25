# Secondary example data sources

This package contains source plans for future Dashboard topics. It does not add domain models or claim that these topics are implemented.

Generate all plans and URL lists without making network requests:

```bash
pnpm --filter @enchantforge/data-sources data:plan
pnpm --filter @enchantforge/data-sources data:plan -- --dataset online-retail-ii
```

Download only the direct-file datasets:

```bash
pnpm --filter @enchantforge/data-sources data:download -- --dataset online-retail-ii
pnpm --filter @enchantforge/data-sources data:download -- --dataset beijing-air-quality
pnpm --filter @enchantforge/data-sources data:download -- --dataset nyc-taxi
```

Archives and Parquet files are written below `examples/data-sources/data/<dataset>/raw/`. SHA-256 manifests are written below the ignored `manifests/` directories. The generated plan for OpenTelemetry Demo describes a collection workflow rather than a static file; CIC-IDS2017 requires a manual download from its provider page; NASA currently marks C-MAPSS unavailable, so no mirror is substituted.

The shell downloader delegates networking to `curl`, so it honors `HTTPS_PROXY`, `HTTP_PROXY`, `ALL_PROXY`, their lowercase variants, and `NO_PROXY`. For example:

```bash
HTTPS_PROXY=http://127.0.0.1:7890 \
  pnpm --filter @enchantforge/data-sources data:download -- --dataset nyc-taxi
```

The source choices follow the planned topics: UCI Online Retail II for retail, UCI Beijing Multi-Site Air Quality for environment, and NYC TLC Yellow Taxi records for mobility. Each plan records its provider page, license note, transformations, and limitations.
