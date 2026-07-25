import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { aviationDashboard } from './dashboard-config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultDatabase = path.resolve(here, '../../data-sources/data/dashboard.sqlite');
const database = path.resolve(process.env.DASHBOARD_DB || defaultDatabase);
const port = Number(process.env.DASHBOARD_DATA_PORT || 5176);
const maxBodySize = 1024 * 1024;

const dimensions = {
  date: 'flight_date',
  hour: 'hour',
  airport: 'origin',
  destination: 'destination',
  carrier: 'carrier',
  direction: 'direction',
  delayCause: 'delay_cause',
  flightId: 'flight_id'
};

const rawMetricSql = {
  flightCount: 'COUNT(*)',
  onTimeRate: 'AVG(on_time)',
  averageDepartureDelay: 'AVG(dep_delay)',
  cancellationRate: 'AVG(cancelled)',
  severeDelayCount: 'SUM(severe_delay)',
  delayMinutes: 'SUM(delay_minutes)'
};

const rollupMetricSql = {
  flightCount: 'SUM(flight_count)',
  onTimeRate: 'SUM(on_time_count) * 1.0 / NULLIF(SUM(flight_count), 0)',
  averageDepartureDelay: 'SUM(dep_delay_sum) * 1.0 / NULLIF(SUM(flight_count), 0)',
  cancellationRate: 'SUM(cancelled_count) * 1.0 / NULLIF(SUM(flight_count), 0)',
  severeDelayCount: 'SUM(severe_delay_count)',
  delayMinutes: 'SUM(delay_minutes_sum)'
};

const rollupDimensions = new Set(['airport', 'carrier', 'direction', 'hour', 'delayCause']);
const rollupFields = { airport: 'origin', carrier: 'carrier', direction: 'direction', hour: 'hour', delayCause: 'delay_cause' };
let rollupAvailable = false;
const queryCache = new Map();
const queryInFlight = new Map();
const queryCacheTtlMs = 5000;
const airportLabels = new Map();
const delayCauseLabels = new Map();

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': 'no-store'
  });
  response.end(payload);
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return sqlString(value);
}

function validateQuery(query) {
  if (!query || query.datasetId !== 'aviation_ontime_demo') throw new Error('不支持的数据集。');
  if (!Array.isArray(query.metrics) || query.metrics.length === 0) throw new Error('QuerySpec 至少需要一个指标。');
  if (!Array.isArray(query.dimensions) || !Array.isArray(query.filters)) throw new Error('QuerySpec 结构无效。');
  for (const item of query.metrics) {
    if (!rawMetricSql[item.metricId] && item.metricId !== 'p95DepartureDelay') throw new Error(`未知指标：${item.metricId}。`);
  }
  for (const item of query.dimensions) {
    if (!dimensions[item.dimensionId]) throw new Error(`未知维度：${item.dimensionId}。`);
  }
  if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100)) {
    throw new Error('QuerySpec limit 必须是 1 到 100 的整数。');
  }
  if (query.timeRange && (!Number.isInteger(query.timeRange.startHour) || !Number.isInteger(query.timeRange.endHour)
    || query.timeRange.startHour < 0 || query.timeRange.endHour > 23 || query.timeRange.startHour > query.timeRange.endHour)) {
    throw new Error('时间范围必须位于 0-23 小时之间。');
  }
}

function whereClause(query, fields = dimensions) {
  const clauses = [];
  for (const filter of query.filters) {
    const field = fields[filter.dimensionId];
    if (!field) throw new Error(`未知过滤维度：${filter.dimensionId}。`);
    if (filter.operator === 'eq' || filter.operator === 'neq' || filter.operator === 'gte' || filter.operator === 'lte') {
      clauses.push(`${field} ${filter.operator === 'eq' ? '=' : filter.operator === 'neq' ? '!=' : filter.operator === 'gte' ? '>=' : '<='} ${sqlValue(filter.value)}`);
    } else if (filter.operator === 'in' && Array.isArray(filter.value) && filter.value.length) {
      clauses.push(`${field} IN (${filter.value.map(sqlValue).join(', ')})`);
    } else if (filter.operator === 'between' && Array.isArray(filter.value) && filter.value.length === 2) {
      clauses.push(`${field} BETWEEN ${sqlValue(filter.value[0])} AND ${sqlValue(filter.value[1])}`);
    } else if (filter.operator === 'neq' && filter.value === undefined) {
      throw new Error('过滤条件值无效。');
    } else {
      throw new Error(`不支持的过滤条件：${filter.operator}。`);
    }
  }
  if (query.timeRange) clauses.push(`${fields.hour} BETWEEN ${query.timeRange.startHour} AND ${query.timeRange.endHour}`);
  return clauses.length ? clauses.join(' AND ') : '1 = 1';
}

function canUseRollup(query) {
  return rollupAvailable
    && !query.metrics.some((item) => item.metricId === 'p95DepartureDelay')
    && query.dimensions.every((item) => rollupDimensions.has(item.dimensionId))
    && query.filters.every((item) => rollupDimensions.has(item.dimensionId));
}

function buildSql(query) {
  validateQuery(query);
  const useRollup = canUseRollup(query);
  const fields = useRollup ? rollupFields : dimensions;
  const metricDefinitions = useRollup ? rollupMetricSql : rawMetricSql;
  const table = useRollup ? 'aviation_dashboard_rollup' : 'aviation_flights';
  const groupFields = query.dimensions.map((item) => fields[item.dimensionId]);
  const groupAliases = query.dimensions.map((item) => item.alias || item.dimensionId);
  const groupSql = groupFields.length ? groupFields.join(', ') : '';
  const partitionSql = groupFields.length ? groupFields.join(', ') : '1';
  const hasP95 = query.metrics.some((item) => item.metricId === 'p95DepartureDelay');
  const base = `SELECT *, ${useRollup ? 'SUM(flight_count) OVER()' : 'COUNT(*) OVER()'} AS __row_count FROM ${table} WHERE ${whereClause(query, fields)}`;
  const source = hasP95
    ? `ranked AS (SELECT base.*, ROW_NUMBER() OVER (PARTITION BY ${partitionSql} ORDER BY dep_delay) AS __rank, COUNT(*) OVER (PARTITION BY ${partitionSql}) AS __group_count FROM base)`
    : 'ranked AS (SELECT * FROM base)';
  const selections = [
    ...groupFields.map((field, index) => `${field} AS ${groupAliases[index]}`),
    ...query.metrics.map((item) => {
      if (item.metricId === 'p95DepartureDelay') return `MAX(CASE WHEN __rank = CAST((__group_count * 95 + 99) / 100 AS INTEGER) THEN dep_delay END) AS ${item.alias || item.metricId}`;
      return `${metricDefinitions[item.metricId]} AS ${item.alias || item.metricId}`;
    }),
    'MAX(__row_count) AS __row_count'
  ];
  const grouping = groupSql ? ` GROUP BY ${groupSql} ORDER BY ${groupSql}` : '';
  return { sql: `WITH base AS (${base}), ${source} SELECT ${selections.join(', ')} FROM ranked${grouping} LIMIT ${query.limit || 100}`, useRollup };
}

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

async function executeDashboardQuery(query) {
  const key = JSON.stringify(query);
  const cached = queryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  const running = queryInFlight.get(key);
  if (running) return running;
  const promise = (async () => {
    const statement = buildSql(query);
    const rows = await runSql(statement.sql);
    const rowCount = Number(rows[0]?.__row_count ?? 0);
    rows.forEach((row) => { delete row.__row_count; });
    query.dimensions.forEach((dimension) => {
      const alias = dimension.alias || dimension.dimensionId;
      if (dimension.dimensionId === 'airport' || dimension.dimensionId === 'destination') {
        rows.forEach((row) => { row[`${alias}Label`] = airportLabels.get(String(row[alias] ?? '')) || `机场（${row[alias] ?? '-'}）`; });
      }
      if (dimension.dimensionId === 'delayCause') {
        rows.forEach((row) => { row[`${alias}Label`] = delayCauseLabels.get(String(row[alias] ?? '')) || String(row[alias] ?? '-'); });
      }
    });
    const result = {
      columns: [...query.dimensions.map((item) => item.alias || item.dimensionId), ...query.metrics.map((item) => item.alias || item.metricId)],
      rows,
      summary: { rowCount, source: statement.useRollup ? 'SQLite aviation_dashboard_rollup' : 'SQLite aviation_flights', query }
    };
    queryCache.set(key, { expiresAt: Date.now() + queryCacheTtlMs, result });
    return result;
  })();
  queryInFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    queryInFlight.delete(key);
  }
}

async function ensureDashboardConfig() {
  if (!existsSync(database)) return;
  const statements = [
    'CREATE TABLE IF NOT EXISTS dashboard_configs (id TEXT PRIMARY KEY, topic_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, source_manifest_json TEXT NOT NULL, dataset_json TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS dashboard_panels (id TEXT PRIMARY KEY, dashboard_id TEXT NOT NULL, template_id TEXT, is_template INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, query_json TEXT NOT NULL, visualization_json TEXT, layout_json TEXT NOT NULL, FOREIGN KEY (dashboard_id) REFERENCES dashboard_configs(id))',
    'CREATE INDEX IF NOT EXISTS idx_dashboard_panels_dashboard ON dashboard_panels(dashboard_id, is_template, sort_order)'
  ];
  const config = aviationDashboard;
  try {
    await runSql("ALTER TABLE dashboard_configs ADD COLUMN dataset_json TEXT NOT NULL DEFAULT '{}'", { readonly: false });
  } catch (error) {
    if (!String(error).includes('duplicate column name')) throw error;
  }
  const insertConfig = `INSERT INTO dashboard_configs (id, topic_id, title, description, source_manifest_json, dataset_json) VALUES (${sqlString(config.id)}, ${sqlString(config.topicId)}, ${sqlString(config.title)}, ${sqlString(config.description)}, ${sqlString(JSON.stringify(config.sourceManifest))}, ${sqlString(JSON.stringify(config.dataset))}) ON CONFLICT(id) DO UPDATE SET topic_id = excluded.topic_id, title = excluded.title, description = excluded.description, source_manifest_json = excluded.source_manifest_json, dataset_json = excluded.dataset_json`;
  const allPanels = [
    ...config.panels.map((panel, index) => ({ ...panel, sortOrder: index, isTemplate: 0, templateId: null })),
    ...config.panelTemplates.map((panel, index) => ({ ...panel, sortOrder: index, isTemplate: 1, templateId: panel.id }))
  ];
  const inserts = allPanels.map((panel) => `INSERT OR IGNORE INTO dashboard_panels (id, dashboard_id, template_id, is_template, sort_order, type, title, description, query_json, visualization_json, layout_json) VALUES (${sqlString(panel.id)}, ${sqlString(config.id)}, ${panel.templateId ? sqlString(panel.templateId) : 'NULL'}, ${panel.isTemplate}, ${panel.sortOrder}, ${sqlString(panel.type)}, ${sqlString(panel.title)}, ${sqlString(panel.description)}, ${sqlString(JSON.stringify(panel.query))}, ${panel.visualization ? sqlString(JSON.stringify(panel.visualization)) : 'NULL'}, ${sqlString(JSON.stringify(panel.layout))})`);
  await runSql(`${statements.join(';')}; ${insertConfig}; ${inserts.join(';')}`, { readonly: false });
}

async function detectRollup() {
  const table = await runSql("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'aviation_dashboard_rollup'");
  if (!table.length) {
    rollupAvailable = false;
    return;
  }
  const rows = await runSql('SELECT COUNT(*) AS aggregate_count FROM aviation_dashboard_rollup');
  rollupAvailable = Number(rows[0]?.aggregate_count ?? 0) > 0;
}

async function loadDictionaries() {
  try {
    const airports = await runSql('SELECT code, name_zh FROM aviation_airport_dictionary');
    airports.forEach((item) => airportLabels.set(item.code, item.name_zh));
  } catch {
    // Older snapshots continue to work with code-based fallback labels.
  }
  try {
    const causes = await runSql('SELECT code, label_zh FROM aviation_delay_cause_dictionary');
    causes.forEach((item) => delayCauseLabels.set(item.code, item.label_zh));
  } catch {
    // Older snapshots continue to work with raw cause codes.
  }
}

async function readConfig() {
  const configs = await runSql('SELECT id, topic_id, title, description, source_manifest_json, dataset_json FROM dashboard_configs LIMIT 1');
  if (!configs.length) throw new Error('Dashboard 配置尚未初始化。');
  const config = configs[0];
  const panels = await runSql(`SELECT id, type, title, description, query_json, visualization_json, layout_json FROM dashboard_panels WHERE dashboard_id = ${sqlString(config.id)} AND is_template = 0 ORDER BY sort_order`);
  const templates = await runSql(`SELECT id, type, title, description, query_json, visualization_json, layout_json FROM dashboard_panels WHERE dashboard_id = ${sqlString(config.id)} AND is_template = 1 ORDER BY sort_order`);
  const airports = await runSql("SELECT DISTINCT f.origin AS code, COALESCE(d.name_zh, '机场（' || f.origin || '）') AS label FROM aviation_flights AS f LEFT JOIN aviation_airport_dictionary AS d ON d.code = f.origin WHERE f.origin <> '' ORDER BY f.origin").catch(() => runSql("SELECT DISTINCT origin AS code, '机场（' || origin || '）' AS label FROM aviation_flights WHERE origin <> '' ORDER BY origin"));
  const carriers = await runSql('SELECT DISTINCT carrier AS value FROM aviation_flights WHERE carrier <> \'\' ORDER BY carrier');
  const parsePanel = (panel) => ({ id: panel.id, type: panel.type, title: panel.title, description: panel.description, query: JSON.parse(panel.query_json), ...(panel.visualization_json ? { visualization: JSON.parse(panel.visualization_json) } : {}), layout: JSON.parse(panel.layout_json) });
  return {
    id: config.id,
    topicId: config.topic_id,
    title: config.title,
    description: config.description,
    sourceManifest: JSON.parse(config.source_manifest_json),
    dataset: JSON.parse(config.dataset_json),
    panels: panels.map(parsePanel),
    panelTemplates: templates.map(parsePanel),
    facets: { airports: airports.map((item) => ({ code: item.code, label: item.label })), carriers: carriers.map((item) => item.value) }
  };
}

function validatePanelPayload(value) {
  if (!value || typeof value !== 'object') throw new Error('Panel 请求体无效。');
  const panel = value;
  if (typeof panel.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(panel.id)) throw new Error('Panel ID 只能使用小写字母、数字和连字符。');
  if (typeof panel.title !== 'string' || !panel.title.trim()) throw new Error('Panel 标题不能为空。');
  if (typeof panel.description !== 'string' || !panel.description.trim()) throw new Error('Panel 描述不能为空。');
  if (!['metric', 'line', 'bar', 'donut', 'table', 'timeline', 'airport-status'].includes(panel.type)) throw new Error('Panel 类型不支持。');
  if (!panel.query || panel.query.datasetId !== aviationDashboard.dataset.id) throw new Error('Panel QuerySpec 数据集不支持。');
  if (!Array.isArray(panel.query.metrics) || panel.query.metrics.length !== 1) throw new Error('Panel 必须选择一个指标。');
  if (!Array.isArray(panel.query.dimensions) || !Array.isArray(panel.query.filters)) throw new Error('Panel QuerySpec 结构无效。');
  const metric = aviationDashboard.dataset.metrics.find((item) => item.id === panel.query.metrics[0].metricId);
  if (!metric) throw new Error(`未知指标：${panel.query.metrics[0].metricId}。`);
  for (const dimension of panel.query.dimensions) {
    if (!aviationDashboard.dataset.dimensions.some((item) => item.id === dimension.dimensionId)) throw new Error(`未知维度：${dimension.dimensionId}。`);
    if (!metric.supportedDimensions.includes(dimension.dimensionId)) throw new Error(`指标「${metric.label}」不支持维度「${dimension.dimensionId}」。`);
  }
  if (panel.query.limit !== undefined && (!Number.isInteger(panel.query.limit) || panel.query.limit < 1 || panel.query.limit > 100)) throw new Error('Query limit 必须是 1 到 100 的整数。');
  if (!panel.layout || !Number.isInteger(panel.layout.width) || panel.layout.width < 3 || panel.layout.width > 12 || !Number.isInteger(panel.layout.minHeight) || panel.layout.minHeight < 120 || panel.layout.minHeight > 800) throw new Error('Panel 布局参数无效。');
  return panel;
}

async function savePanel(value) {
  const panel = validatePanelPayload(value);
  const existing = await runSql(`SELECT id, is_template, sort_order FROM dashboard_panels WHERE id = ${sqlString(panel.id)}`);
  if (existing[0]?.is_template) throw new Error(`Panel ID 已被模板占用：${panel.id}。`);
  const dashboardId = aviationDashboard.id;
  const visualization = panel.visualization ? sqlString(JSON.stringify(panel.visualization)) : 'NULL';
  const query = sqlString(JSON.stringify(panel.query));
  const layout = sqlString(JSON.stringify(panel.layout));
  if (existing.length) {
    await runSql(`UPDATE dashboard_panels SET type = ${sqlString(panel.type)}, title = ${sqlString(panel.title.trim())}, description = ${sqlString(panel.description.trim())}, query_json = ${query}, visualization_json = ${visualization}, layout_json = ${layout} WHERE id = ${sqlString(panel.id)}`, { readonly: false });
  } else {
    const nextOrder = await runSql(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM dashboard_panels WHERE dashboard_id = ${sqlString(dashboardId)} AND is_template = 0`);
    await runSql(`INSERT INTO dashboard_panels (id, dashboard_id, template_id, is_template, sort_order, type, title, description, query_json, visualization_json, layout_json) VALUES (${sqlString(panel.id)}, ${sqlString(dashboardId)}, NULL, 0, ${Number(nextOrder[0]?.next_order ?? 0)}, ${sqlString(panel.type)}, ${sqlString(panel.title.trim())}, ${sqlString(panel.description.trim())}, ${query}, ${visualization}, ${layout})`, { readonly: false });
  }
  queryCache.clear();
  return readConfig();
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > maxBodySize) throw new Error('请求体过大。');
  }
  return JSON.parse(body || '{}');
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' });
    response.end();
    return;
  }
  if (request.method === 'GET' && request.url === '/api/dashboard/health') {
    try {
      const rows = await runSql("SELECT COALESCE((SELECT row_count FROM dataset_runs WHERE dataset_id = 'aviation-ontime'), 0) AS flight_count");
      const rollupRows = rollupAvailable ? await runSql('SELECT COUNT(*) AS aggregate_count FROM aviation_dashboard_rollup') : [];
      sendJson(response, 200, { status: rollupAvailable ? 'ok' : 'degraded', database, flightCount: rows[0]?.flight_count ?? 0, aggregateCount: rollupRows[0]?.aggregate_count ?? 0, querySource: rollupAvailable ? 'aviation_dashboard_rollup' : 'aviation_flights' });
    } catch (error) {
      sendJson(response, 503, { status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (request.method === 'GET' && request.url === '/api/dashboard/config') {
    try {
      sendJson(response, 200, await readConfig());
    } catch (error) {
      sendJson(response, 503, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (request.method === 'POST' && request.url === '/api/dashboard/panels') {
    try {
      sendJson(response, 200, await savePanel(await readBody(request)));
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (request.method === 'POST' && request.url === '/api/dashboard/query') {
    try {
      const query = await readBody(request);
      sendJson(response, 200, await executeDashboardQuery(query));
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (request.method === 'POST' && request.url === '/api/dashboard/query-batch') {
    try {
      const body = await readBody(request);
      if (!Array.isArray(body.queries) || body.queries.length < 1 || body.queries.length > 24) throw new Error('批量查询数量必须是 1 到 24。');
      sendJson(response, 200, { results: await Promise.all(body.queries.map((query) => executeDashboardQuery(query))) });
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  sendJson(response, 404, { error: 'Not found' });
});

ensureDashboardConfig()
  .then(detectRollup)
  .then(loadDictionaries)
  .then(() => server.listen(port, '127.0.0.1', () => {
    console.log(`[dashboard-data] http://127.0.0.1:${port} -> ${database}`);
  }))
  .catch((error) => {
    console.error(`[dashboard-data] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
