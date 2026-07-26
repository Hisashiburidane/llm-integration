import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resetDashboardConfiguration } from './dashboard-config-store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultDatabase = path.resolve(here, '../../data-sources/data/dashboard.sqlite');

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
  -h, --help         Show this help`);
  process.exit(0);
}

const database = path.resolve(option('--database') || process.env.DASHBOARD_DB || defaultDatabase);

function runSql(sql, { readonly = true } = {}) {
  return new Promise((resolve, reject) => {
    if (!existsSync(database)) {
      reject(new Error(`SQLite 数据库不存在：${database}。请先运行 data:process。`));
      return;
    }
    const child = spawn('sqlite3', [...(readonly ? ['-readonly'] : []), '-json', database], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => reject(new Error(`无法启动 sqlite3：${error.message}`)));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `sqlite3 退出码：${code}`));
        return;
      }
      try {
        resolve(stdout.trim() ? JSON.parse(stdout) : []);
      } catch (error) {
        reject(new Error(`SQLite 返回了无效 JSON：${error instanceof Error ? error.message : String(error)}`));
      }
    });
    child.stdin.end(`${sql};\n`);
  });
}

resetDashboardConfiguration(runSql)
  .then((result) => {
    console.log(`[dashboard-config] reset ${result.dashboards} dashboards, ${result.panels} panels and ${result.placements} placements in ${database}`);
  })
  .catch((error) => {
    console.error(`[dashboard-config] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
