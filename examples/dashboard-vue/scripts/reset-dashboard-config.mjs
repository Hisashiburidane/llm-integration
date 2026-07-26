import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resetDashboardConfiguration } from './dashboard-config-store.mjs';
import { loadSchemaRegistry } from './schema-registry.mjs';
import { createSqliteRunner, resolveDatabasePath } from './sqlite-cli.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultDatabase = path.resolve(here, '../../data-sources/data/dashboard.sqlite');
const defaultSchemaDirectory = path.resolve(here, '../../data-sources/schemas');

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Usage: node scripts/reset-dashboard-config.mjs [options]

Reset only Dashboard and Panel configuration to the repository defaults.
Extracted datasets, dictionaries, detail tables and rollup tables are untouched.

Options:
  --database <path>  SQLite file (default: DASHBOARD_DB or examples/data-sources/data/dashboard.sqlite)
  --schemas <path>   Schema directory (default: DASHBOARD_SCHEMA_DIR or examples/data-sources/schemas)
  -h, --help         Show this help`);
  process.exit(0);
}

const database = resolveDatabasePath(option('--database') || process.env.DASHBOARD_DB, defaultDatabase);
const schemaDirectory = path.resolve(option('--schemas') || process.env.DASHBOARD_SCHEMA_DIR || defaultSchemaDirectory);
const runSql = createSqliteRunner(database);

loadSchemaRegistry(schemaDirectory)
  .then(({ domains }) => resetDashboardConfiguration(runSql, domains))
  .then((result) => {
    console.log(`[dashboard-config] reset ${result.dashboards} dashboards, ${result.panels} panels and ${result.placements} placements in ${database}`);
  })
  .catch((error) => {
    console.error(`[dashboard-config] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
