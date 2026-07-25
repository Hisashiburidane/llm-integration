# Aviation data directory

The dashboard currently runs with the deterministic fixture in `src/data/aviation.ts`.
This directory is reserved for the public BTS data workflow.

Generate the official monthly URL list without making a network request:

```bash
pnpm --filter @enchantforge/dashboard-vue data:plan
```

The command writes:

- `download-urls.txt`: one BTS archive URL per line;
- `download-plan.json`: source metadata, target paths, planned transformations, and limitations.

If you want the workspace to download the files directly, run:

```bash
pnpm --filter @enchantforge/dashboard-vue data:download
```

This reads the generated plan, stores archives under `data/raw/`, and writes checksums to the ignored `data/manifests/download-manifest.json`. You can also download the URLs manually. Processing those archives into the dashboard fixture is a separate task; until then, the example does not claim to use live or downloaded data.

The shell downloader delegates networking to `curl`, so it honors `HTTPS_PROXY`, `HTTP_PROXY`, `ALL_PROXY`, their lowercase variants, and `NO_PROXY`.
