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

Download the archives yourself and place them under `data/raw/`, then record the SHA-256 checksum in the manifest. Processing those archives into the dashboard fixture is a separate task; until then, the example does not claim to use live or downloaded data.
