import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { aviationDashboard } from './dashboard-config.mjs';
import { airQualityDashboard } from './air-quality-config.mjs';
import { otelDashboard } from './otel-config.mjs';
import { taxiDashboard } from './taxi-config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultDatabase = path.resolve(here, '../../data-sources/data/dashboard.sqlite');
const database = path.resolve(process.env.DASHBOARD_DB || defaultDatabase);
const port = Number(process.env.DASHBOARD_DATA_PORT || 5176);
const maxBodySize = 1024 * 1024;

const dashboards = new Map([
  [aviationDashboard.id, aviationDashboard],
  [airQualityDashboard.id, airQualityDashboard],
  [taxiDashboard.id, taxiDashboard],
  [otelDashboard.id, otelDashboard]
]);
const dashboardDefinitions = [...dashboards.values()];
const datasetDefinitions = {
  aviation_ontime_demo: {
    dimensions: { date: 'flight_date', hour: 'hour', airport: 'origin', destination: 'destination', carrier: 'carrier', direction: 'direction', delayCause: 'delay_cause', flightId: 'flight_id' },
    rawMetricSql: { flightCount: 'COUNT(*)', onTimeRate: 'AVG(on_time)', averageDepartureDelay: 'AVG(dep_delay)', cancellationRate: 'AVG(cancelled)', severeDelayCount: 'SUM(severe_delay)', delayMinutes: 'SUM(delay_minutes)' },
    rollupMetricSql: { flightCount: 'SUM(flight_count)', onTimeRate: 'SUM(on_time_count) * 1.0 / NULLIF(SUM(flight_count), 0)', averageDepartureDelay: 'SUM(dep_delay_sum) * 1.0 / NULLIF(SUM(flight_count), 0)', cancellationRate: 'SUM(cancelled_count) * 1.0 / NULLIF(SUM(flight_count), 0)', severeDelayCount: 'SUM(severe_delay_count)', delayMinutes: 'SUM(delay_minutes_sum)' },
    rawTable: 'aviation_flights',
    rollupTable: 'aviation_dashboard_rollup',
    rollupFields: { airport: 'origin', carrier: 'carrier', direction: 'direction', hour: 'hour', delayCause: 'delay_cause' },
    rollupDimensions: new Set(['airport', 'carrier', 'direction', 'hour', 'delayCause']),
    labelJoins: true,
    rowCountExpression: 'SUM(flight_count)'
  },
  beijing_air_quality_demo: {
    dimensions: { date: 'observed_date', station: 'station' },
    rawDimensions: { date: "substr(observed_at, 1, 10)", station: 'station' },
    rawMetricSql: { observationCount: 'COUNT(*)', stationCount: 'COUNT(DISTINCT station)', pm25Average: 'AVG(pm25)', pm25Peak: 'MAX(pm25)', pm10Average: 'AVG(pm10)', no2Average: 'AVG(no2)', so2Average: 'AVG(so2)', o3Average: 'AVG(o3)', temperatureAverage: 'AVG(temperature)', rainTotal: 'SUM(COALESCE(rain, 0))' },
    rollupMetricSql: { observationCount: 'SUM(observation_count)', stationCount: 'COUNT(DISTINCT station)', pm25Average: 'SUM(pm25_avg * observation_count) * 1.0 / NULLIF(SUM(CASE WHEN pm25_avg IS NOT NULL THEN observation_count ELSE 0 END), 0)', pm25Peak: 'MAX(pm25_max)', pm10Average: 'SUM(pm10_avg * observation_count) * 1.0 / NULLIF(SUM(CASE WHEN pm10_avg IS NOT NULL THEN observation_count ELSE 0 END), 0)', no2Average: 'SUM(no2_avg * observation_count) * 1.0 / NULLIF(SUM(CASE WHEN no2_avg IS NOT NULL THEN observation_count ELSE 0 END), 0)', so2Average: 'SUM(so2_avg * observation_count) * 1.0 / NULLIF(SUM(CASE WHEN so2_avg IS NOT NULL THEN observation_count ELSE 0 END), 0)', o3Average: 'SUM(o3_avg * observation_count) * 1.0 / NULLIF(SUM(CASE WHEN o3_avg IS NOT NULL THEN observation_count ELSE 0 END), 0)', temperatureAverage: 'SUM(temperature_avg * observation_count) * 1.0 / NULLIF(SUM(CASE WHEN temperature_avg IS NOT NULL THEN observation_count ELSE 0 END), 0)', rainTotal: 'SUM(rain_total)' },
    rawTable: 'air_quality_observations',
    rollupTable: 'air_quality_dashboard_rollup',
    rollupFields: { date: 'observed_date', station: 'station' },
    rollupDimensions: new Set(['date', 'station']),
    rowCountExpression: 'SUM(observation_count)'
  },
  nyc_taxi_demo: {
    dimensions: { date: 'pickup_date', borough: 'pickup_borough', pickupZone: 'pickup_zone', pickupLocation: 'pickup_location_id', paymentType: 'payment_type' },
    rawDimensions: { date: "substr(pickup_at, 1, 10)", borough: 'pickup_location_id', pickupZone: 'pickup_location_id', pickupLocation: 'pickup_location_id', paymentType: 'payment_type' },
    rawMetricSql: { tripCount: 'COUNT(*)', passengerCount: 'SUM(COALESCE(passenger_count, 0))', averageTripDistance: 'AVG(trip_distance)', averageFare: 'AVG(fare_amount)', averageTip: 'AVG(tip_amount)', totalRevenue: 'SUM(total_amount)', averageTripDuration: 'AVG(trip_duration_minutes)' },
    rollupMetricSql: { tripCount: 'SUM(trip_count)', passengerCount: 'SUM(passenger_sum)', averageTripDistance: 'SUM(distance_sum) * 1.0 / NULLIF(SUM(trip_count), 0)', averageFare: 'SUM(fare_sum) * 1.0 / NULLIF(SUM(trip_count), 0)', averageTip: 'SUM(tip_sum) * 1.0 / NULLIF(SUM(trip_count), 0)', totalRevenue: 'SUM(total_amount_sum)', averageTripDuration: 'SUM(duration_sum) * 1.0 / NULLIF(SUM(trip_count), 0)' },
    rawTable: 'nyc_taxi_trips',
    rollupTable: 'nyc_taxi_dashboard_rollup',
    rollupFields: { date: 'pickup_date', borough: 'pickup_borough', pickupZone: 'pickup_zone', pickupLocation: 'pickup_location_id' },
    rollupDimensions: new Set(['date', 'borough', 'pickupZone', 'pickupLocation']),
    taxiJoins: true,
    rowCountExpression: 'SUM(trip_count)'
  },
  otel_service_demo: {
    dimensions: { capture: 'capture_id', minute: 'observed_minute', service: 'service_name' },
    rawMetricSql: {
      serviceCount: 'COUNT(DISTINCT service_name)',
      spanCount: 'SUM(span_count)',
      spanErrorCount: 'SUM(error_count)',
      spanErrorRate: 'SUM(error_count) * 1.0 / NULLIF(SUM(span_count), 0)',
      averageLatency: 'SUM(average_duration_ms * span_count) * 1.0 / NULLIF(SUM(span_count), 0)',
      p95Latency: 'MAX(p95_duration_ms)'
    },
    rollupMetricSql: {
      serviceCount: 'COUNT(DISTINCT service_name)',
      spanCount: 'SUM(span_count)',
      spanErrorCount: 'SUM(error_count)',
      spanErrorRate: 'SUM(error_count) * 1.0 / NULLIF(SUM(span_count), 0)',
      averageLatency: 'SUM(average_duration_ms * span_count) * 1.0 / NULLIF(SUM(span_count), 0)',
      p95Latency: 'MAX(p95_duration_ms)'
    },
    rawTable: 'otel_service_minute_rollup',
    rollupTable: 'otel_service_minute_rollup',
    rollupFields: { capture: 'capture_id', minute: 'observed_minute', service: 'service_name' },
    rollupDimensions: new Set(['capture', 'minute', 'service']),
    rowCountExpression: 'SUM(span_count)'
  },
  otel_edge_demo: {
    dimensions: { capture: 'capture_id', sourceService: 'source_service', targetService: 'target_service' },
    rawMetricSql: {
      callCount: 'SUM(call_count)',
      edgeErrorRate: 'SUM(error_count) * 1.0 / NULLIF(SUM(call_count), 0)',
      edgeAverageLatency: 'SUM(average_duration_ms * call_count) * 1.0 / NULLIF(SUM(call_count), 0)',
      edgeP95Latency: 'MAX(p95_duration_ms)'
    },
    rollupMetricSql: {
      callCount: 'SUM(call_count)',
      edgeErrorRate: 'SUM(error_count) * 1.0 / NULLIF(SUM(call_count), 0)',
      edgeAverageLatency: 'SUM(average_duration_ms * call_count) * 1.0 / NULLIF(SUM(call_count), 0)',
      edgeP95Latency: 'MAX(p95_duration_ms)'
    },
    rawTable: 'otel_service_edge_rollup',
    rollupTable: 'otel_service_edge_rollup',
    rollupFields: { capture: 'capture_id', sourceService: 'source_service', targetService: 'target_service' },
    rollupDimensions: new Set(['capture', 'sourceService', 'targetService']),
    rowCountExpression: 'SUM(call_count)'
  },
  otel_log_demo: {
    dimensions: { capture: 'capture_id', minute: 'observed_minute', service: 'service_name', severity: 'severity' },
    rawMetricSql: {
      logCount: 'SUM(log_count)',
      logErrorRate: "SUM(CASE WHEN severity IN ('ERROR', 'FATAL') THEN log_count ELSE 0 END) * 1.0 / NULLIF(SUM(log_count), 0)"
    },
    rollupMetricSql: {
      logCount: 'SUM(log_count)',
      logErrorRate: "SUM(CASE WHEN severity IN ('ERROR', 'FATAL') THEN log_count ELSE 0 END) * 1.0 / NULLIF(SUM(log_count), 0)"
    },
    rawTable: 'otel_log_minute_rollup',
    rollupTable: 'otel_log_minute_rollup',
    rollupFields: { capture: 'capture_id', minute: 'observed_minute', service: 'service_name', severity: 'severity' },
    rollupDimensions: new Set(['capture', 'minute', 'service', 'severity']),
    rowCountExpression: 'SUM(log_count)'
  },
  otel_metric_demo: {
    dimensions: { capture: 'capture_id', minute: 'observed_minute', service: 'service_name', metricName: 'metric_name', unit: 'unit' },
    rawMetricSql: {
      metricPointCount: 'SUM(point_count)',
      metricSeriesCount: 'COUNT(DISTINCT metric_name)'
    },
    rollupMetricSql: {
      metricPointCount: 'SUM(point_count)',
      metricSeriesCount: 'COUNT(DISTINCT metric_name)'
    },
    rawTable: 'otel_metric_minute_rollup',
    rollupTable: 'otel_metric_minute_rollup',
    rollupFields: { capture: 'capture_id', minute: 'observed_minute', service: 'service_name', metricName: 'metric_name', unit: 'unit' },
    rollupDimensions: new Set(['capture', 'minute', 'service', 'metricName', 'unit']),
    rowCountExpression: 'SUM(point_count)'
  }
};
const rollupAvailable = new Map();
const queryCache = new Map();
const queryInFlight = new Map();
const queryCacheTtlMs = 5000;

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
  const definition = query && datasetDefinitions[query.datasetId];
  if (!definition) throw new Error('不支持的数据集。');
  if (!Array.isArray(query.metrics) || query.metrics.length === 0) throw new Error('QuerySpec 至少需要一个指标。');
  if (!Array.isArray(query.dimensions) || !Array.isArray(query.filters)) throw new Error('QuerySpec 结构无效。');
  for (const item of query.metrics) {
    if (!definition.rawMetricSql[item.metricId] && !(query.datasetId === 'aviation_ontime_demo' && item.metricId === 'p95DepartureDelay')) throw new Error(`未知指标：${item.metricId}。`);
  }
  for (const item of query.dimensions) {
    if (!definition.dimensions[item.dimensionId]) throw new Error(`未知维度：${item.dimensionId}。`);
  }
  if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100)) {
    throw new Error('QuerySpec limit 必须是 1 到 100 的整数。');
  }
  if (query.orderBy && (
    typeof query.orderBy.fieldId !== 'string'
    || !['asc', 'desc'].includes(query.orderBy.direction)
  )) {
    throw new Error('QuerySpec orderBy 无效。');
  }
  if (query.timeRange && (!Number.isInteger(query.timeRange.startHour) || !Number.isInteger(query.timeRange.endHour)
    || query.timeRange.startHour < 0 || query.timeRange.endHour > 23 || query.timeRange.startHour > query.timeRange.endHour)) {
    throw new Error('时间范围必须位于 0-23 小时之间。');
  }
}

function whereClause(query, fields) {
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
  if (query.timeRange && fields.hour) clauses.push(`${fields.hour} BETWEEN ${query.timeRange.startHour} AND ${query.timeRange.endHour}`);
  return clauses.length ? clauses.join(' AND ') : '1 = 1';
}

function canUseRollup(query, definition) {
  return rollupAvailable.get(query.datasetId)
    && !query.metrics.some((item) => item.metricId === 'p95DepartureDelay')
    && query.dimensions.every((item) => definition.rollupDimensions.has(item.dimensionId))
    && query.filters.every((item) => definition.rollupDimensions.has(item.dimensionId));
}

function buildSql(query) {
  validateQuery(query);
  const definition = datasetDefinitions[query.datasetId];
  const useRollup = canUseRollup(query, definition);
  const fields = useRollup ? definition.rollupFields : (definition.rawDimensions || definition.dimensions);
  const metricDefinitions = useRollup ? definition.rollupMetricSql : definition.rawMetricSql;
  const table = useRollup ? definition.rollupTable : definition.rawTable;
  const groupFields = query.dimensions.map((item) => fields[item.dimensionId]);
  const groupAliases = query.dimensions.map((item) => item.alias || item.dimensionId);
  const groupSql = groupFields.length ? groupFields.join(', ') : '';
  const partitionSql = groupFields.length ? groupFields.join(', ') : '1';
  const hasP95 = query.metrics.some((item) => item.metricId === 'p95DepartureDelay');
  const base = `SELECT *, ${useRollup ? definition.rowCountExpression + ' OVER()' : 'COUNT(*) OVER()'} AS __row_count FROM ${table} WHERE ${whereClause(query, fields)}`;
  const source = hasP95
    ? `ranked AS (SELECT base.*, ROW_NUMBER() OVER (PARTITION BY ${partitionSql} ORDER BY dep_delay) AS __rank, COUNT(*) OVER (PARTITION BY ${partitionSql}) AS __group_count FROM base)`
    : 'ranked AS (SELECT * FROM base)';
  const joins = [];
  if (definition.labelJoins && query.dimensions.some((item) => item.dimensionId === 'airport')) {
    joins.push('LEFT JOIN aviation_airport_dictionary AS airport_dictionary ON airport_dictionary.code = ranked.origin');
  }
  if (definition.labelJoins && query.dimensions.some((item) => item.dimensionId === 'destination')) {
    joins.push('LEFT JOIN aviation_airport_dictionary AS destination_dictionary ON destination_dictionary.code = ranked.destination');
  }
  if (definition.labelJoins && query.dimensions.some((item) => item.dimensionId === 'delayCause')) {
    joins.push('LEFT JOIN aviation_delay_cause_dictionary AS delay_cause_dictionary ON delay_cause_dictionary.code = ranked.delay_cause');
  }
  if (definition.taxiJoins && !useRollup && query.dimensions.some((item) => item.dimensionId === 'borough' || item.dimensionId === 'pickupZone')) {
    joins.push('LEFT JOIN nyc_taxi_zones AS pickup_zone_dictionary ON pickup_zone_dictionary.location_id = ranked.pickup_location_id');
  }
  const dimensionSelections = query.dimensions.flatMap((item, index) => {
    const field = groupFields[index];
    const alias = groupAliases[index];
    if (definition.labelJoins && item.dimensionId === 'airport') {
      return [`COALESCE(airport_dictionary.name_zh, ranked.${field}) AS ${alias}`, `ranked.${field} AS ${alias}Code`];
    }
    if (definition.labelJoins && item.dimensionId === 'destination') {
      return [`COALESCE(destination_dictionary.name_zh, ranked.${field}) AS ${alias}`, `ranked.${field} AS ${alias}Code`];
    }
    if (definition.labelJoins && item.dimensionId === 'delayCause') {
      return [`COALESCE(delay_cause_dictionary.label_zh, ranked.${field}) AS ${alias}`, `ranked.${field} AS ${alias}Code`];
    }
    if (definition.taxiJoins && !useRollup && item.dimensionId === 'borough') {
      return [`COALESCE(pickup_zone_dictionary.borough, ranked.${field}) AS ${alias}`, `ranked.${field} AS ${alias}Code`];
    }
    if (definition.taxiJoins && !useRollup && item.dimensionId === 'pickupZone') {
      return [`COALESCE(pickup_zone_dictionary.zone, ranked.${field}) AS ${alias}`, `ranked.${field} AS ${alias}Code`];
    }
    return [`ranked.${field} AS ${alias}`];
  });
  const selections = [
    ...dimensionSelections,
    ...query.metrics.map((item) => {
      if (item.metricId === 'p95DepartureDelay') return `MAX(CASE WHEN __rank = CAST((__group_count * 95 + 99) / 100 AS INTEGER) THEN dep_delay END) AS ${item.alias || item.metricId}`;
      return `${metricDefinitions[item.metricId]} AS ${item.alias || item.metricId}`;
    }),
    'MAX(__row_count) AS __row_count'
  ];
  const availableOrderFields = new Map([
    ...query.dimensions.map((item) => [item.dimensionId, item.alias || item.dimensionId]),
    ...query.metrics.map((item) => [item.metricId, item.alias || item.metricId])
  ]);
  const orderAlias = query.orderBy ? availableOrderFields.get(query.orderBy.fieldId) : undefined;
  if (query.orderBy && !orderAlias) throw new Error(`排序字段不在查询结果中：${query.orderBy.fieldId}。`);
  const orderSql = orderAlias
    ? ` ORDER BY ${orderAlias} ${query.orderBy.direction.toUpperCase()}`
    : groupSql ? ` ORDER BY ${groupSql}` : '';
  const grouping = `${groupSql ? ` GROUP BY ${groupSql}` : ''}${orderSql}`;
  return { sql: `WITH base AS (${base}), ${source} SELECT ${selections.join(', ')} FROM ranked ${joins.join(' ')}${grouping} LIMIT ${query.limit || 100}`, useRollup };
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
    const result = {
      columns: [...query.dimensions.map((item) => item.alias || item.dimensionId), ...query.metrics.map((item) => item.alias || item.metricId)],
      rows,
      summary: { rowCount, source: statement.useRollup ? `SQLite ${datasetDefinitions[query.datasetId].rollupTable}` : `SQLite ${datasetDefinitions[query.datasetId].rawTable}`, query }
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
    'CREATE INDEX IF NOT EXISTS idx_dashboard_panels_dashboard ON dashboard_panels(dashboard_id, is_template, sort_order)',
    'CREATE TABLE IF NOT EXISTS panel_definitions (id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, query_json TEXT NOT NULL, visualization_json TEXT, default_width INTEGER NOT NULL, default_min_height INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS dashboard_panel_placements (dashboard_id TEXT NOT NULL, panel_id TEXT NOT NULL, sort_order INTEGER NOT NULL, width INTEGER NOT NULL, min_height INTEGER NOT NULL, PRIMARY KEY (dashboard_id, panel_id), FOREIGN KEY (dashboard_id) REFERENCES dashboard_configs(id), FOREIGN KEY (panel_id) REFERENCES panel_definitions(id))',
    'CREATE INDEX IF NOT EXISTS idx_dashboard_panel_placements_dashboard ON dashboard_panel_placements(dashboard_id, sort_order)',
    'CREATE INDEX IF NOT EXISTS idx_panel_definitions_title ON panel_definitions(title)'
  ];
  try {
    await runSql("ALTER TABLE dashboard_configs ADD COLUMN dataset_json TEXT NOT NULL DEFAULT '{}'", { readonly: false });
  } catch (error) {
    if (!String(error).includes('duplicate column name')) throw error;
  }
  const configs = dashboardDefinitions;
  const configInserts = configs.map((config) => `INSERT INTO dashboard_configs (id, topic_id, title, description, source_manifest_json, dataset_json) VALUES (${sqlString(config.id)}, ${sqlString(config.topicId)}, ${sqlString(config.title)}, ${sqlString(config.description)}, ${sqlString(JSON.stringify(config.sourceManifest))}, ${sqlString(JSON.stringify(config.dataset))}) ON CONFLICT(id) DO UPDATE SET topic_id = excluded.topic_id, title = excluded.title, description = excluded.description, source_manifest_json = excluded.source_manifest_json, dataset_json = excluded.dataset_json`);
  const allPanels = configs.flatMap((config) => [
    ...config.panels.map((panel, index) => ({ ...panel, dashboardId: config.id, sortOrder: index, isTemplate: 0, templateId: null })),
    ...config.panelTemplates.map((panel, index) => ({ ...panel, dashboardId: config.id, sortOrder: index, isTemplate: 1, templateId: panel.id }))
  ]);
  const inserts = allPanels.map((panel) => `INSERT OR IGNORE INTO dashboard_panels (id, dashboard_id, template_id, is_template, sort_order, type, title, description, query_json, visualization_json, layout_json) VALUES (${sqlString(panel.id)}, ${sqlString(panel.dashboardId)}, ${panel.templateId ? sqlString(panel.templateId) : 'NULL'}, ${panel.isTemplate}, ${panel.sortOrder}, ${sqlString(panel.type)}, ${sqlString(panel.title)}, ${sqlString(panel.description)}, ${sqlString(JSON.stringify(panel.query))}, ${panel.visualization ? sqlString(JSON.stringify(panel.visualization)) : 'NULL'}, ${sqlString(JSON.stringify(panel.layout))})`);
  const definitionInserts = allPanels.map((panel) => `INSERT OR IGNORE INTO panel_definitions (id, type, title, description, query_json, visualization_json, default_width, default_min_height) VALUES (${sqlString(panel.id)}, ${sqlString(panel.type)}, ${sqlString(panel.title)}, ${sqlString(panel.description)}, ${sqlString(JSON.stringify(panel.query))}, ${panel.visualization ? sqlString(JSON.stringify(panel.visualization)) : 'NULL'}, ${panel.layout.width}, ${panel.layout.minHeight})`);
  const migrateDefinitions = `INSERT OR IGNORE INTO panel_definitions (id, type, title, description, query_json, visualization_json, default_width, default_min_height) SELECT id, type, title, description, query_json, visualization_json, 6, 300 FROM dashboard_panels`;
  const migratePlacements = `INSERT OR IGNORE INTO dashboard_panel_placements (dashboard_id, panel_id, sort_order, width, min_height) SELECT dashboard_id, id, sort_order, COALESCE(CAST(json_extract(layout_json, '$.width') AS INTEGER), 6), COALESCE(CAST(json_extract(layout_json, '$.minHeight') AS INTEGER), 300) FROM dashboard_panels WHERE is_template = 0`;
  const placementInserts = configs.flatMap((config) => config.panels.map((panel, index) => `INSERT OR IGNORE INTO dashboard_panel_placements (dashboard_id, panel_id, sort_order, width, min_height) VALUES (${sqlString(config.id)}, ${sqlString(panel.id)}, ${index}, ${panel.layout.width}, ${panel.layout.minHeight})`));
  await runSql(`${statements.join(';')}; ${configInserts.join(';')}; ${inserts.join(';')}; ${definitionInserts.join(';')}; ${migrateDefinitions}; ${migratePlacements}; ${placementInserts.join(';')}; UPDATE panel_definitions SET type = 'table' WHERE type = 'airport-status'; UPDATE dashboard_panels SET type = 'table' WHERE type = 'airport-status'`, { readonly: false });
}

async function detectRollup() {
  for (const [datasetId, definition] of Object.entries(datasetDefinitions)) {
    const table = await runSql(`SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ${sqlString(definition.rollupTable)}`);
    if (!table.length) {
      rollupAvailable.set(datasetId, false);
      continue;
    }
    const rows = await runSql(`SELECT COUNT(*) AS aggregate_count FROM ${definition.rollupTable}`);
    rollupAvailable.set(datasetId, Number(rows[0]?.aggregate_count ?? 0) > 0);
  }
}

async function readConfig(dashboardId = aviationDashboard.id) {
  const dashboard = dashboards.get(dashboardId);
  if (!dashboard) throw new Error(`未知 Dashboard：${dashboardId}。`);
  const configs = await runSql(`SELECT id, topic_id, title, description, source_manifest_json, dataset_json FROM dashboard_configs WHERE id = ${sqlString(dashboard.id)}`);
  if (!configs.length) throw new Error('Dashboard 配置尚未初始化。');
  const config = configs[0];
  const panels = await runSql(`SELECT d.id, d.type, d.title, d.description, d.query_json, d.visualization_json, p.width, p.min_height FROM dashboard_panel_placements AS p JOIN panel_definitions AS d ON d.id = p.panel_id WHERE p.dashboard_id = ${sqlString(config.id)} ORDER BY p.sort_order`);
  const panelIds = [...dashboard.panels, ...dashboard.panelTemplates].map((panel) => sqlString(panel.id)).join(', ');
  const panelLibrary = await runSql(`SELECT id, type, title, description, query_json, visualization_json, default_width AS width, default_min_height AS min_height FROM panel_definitions WHERE id IN (${panelIds}) ORDER BY title, id`);
  const airports = dashboard.id === aviationDashboard.id
    ? await runSql("SELECT DISTINCT f.origin AS code, COALESCE(d.name_zh, '机场（' || f.origin || '）') AS label FROM aviation_flights AS f LEFT JOIN aviation_airport_dictionary AS d ON d.code = f.origin WHERE f.origin <> '' ORDER BY f.origin")
    : [];
  const carriers = dashboard.id === aviationDashboard.id
    ? await runSql('SELECT DISTINCT carrier AS value FROM aviation_flights WHERE carrier <> \'\' ORDER BY carrier')
    : [];
  const stations = dashboard.id === airQualityDashboard.id
    ? await runSql('SELECT DISTINCT station AS code, station AS label FROM air_quality_observations WHERE station <> \'\' ORDER BY station')
    : [];
  const taxiZones = dashboard.id === taxiDashboard.id
    ? await runSql("SELECT COALESCE(zone, '区域 ' || location_id) AS code, COALESCE(zone, '区域 ' || location_id) AS label FROM nyc_taxi_zones WHERE location_id IS NOT NULL ORDER BY label")
    : [];
  const captures = dashboard.id === otelDashboard.id
    ? await runSql("SELECT capture_id AS code, scenario || ' · ' || started_at || ' · ' || duration_seconds || 's' AS label FROM otel_capture_runs ORDER BY started_at DESC")
    : [];
  const facets = {
    airports: airports.map((item) => ({ code: item.code, label: item.label })),
    carriers: carriers.map((item) => item.value),
    stations: stations.map((item) => ({ code: item.code, label: item.label })),
    taxiZones: taxiZones.map((item) => ({ code: item.code, label: item.label })),
    captures: captures.map((item) => ({ code: item.code, label: item.label }))
  };
  const filterDefinitions = (dashboard.filterDefinitions ?? []).map((definition) => {
    const resolved = { ...definition };
    if (resolved.defaultFromFacet === 'first' && resolved.facetKey && facets[resolved.facetKey]?.length) {
      const first = facets[resolved.facetKey][0];
      resolved.defaultValue = typeof first === 'string' ? first : first.code;
    }
    delete resolved.defaultFromFacet;
    return resolved;
  });
  return {
    id: config.id,
    topicId: config.topic_id,
    title: config.title,
    description: config.description,
    sourceManifest: JSON.parse(config.source_manifest_json),
    dataset: JSON.parse(config.dataset_json),
    panels: panels.map(parsePanelRow),
    panelLibrary: panelLibrary.map(parsePanelRow),
    panelTemplates: dashboard.panelTemplates,
    querySources: dashboard.querySources ?? [{ datasetId: dashboard.dataset.id, metricIds: dashboard.dataset.metrics.map((metric) => metric.id) }],
    facets,
    filterDefinitions,
    assistantPrompt: dashboard.assistantPrompt ?? '',
    suggestions: dashboard.suggestions ?? []
  };
}

function parsePanelRow(panel) {
  const parsedQuery = JSON.parse(panel.query_json || '{}');
  const query = {
    ...parsedQuery,
    metrics: Array.isArray(parsedQuery.metrics) ? parsedQuery.metrics : [],
    dimensions: Array.isArray(parsedQuery.dimensions) ? parsedQuery.dimensions : [],
    filters: Array.isArray(parsedQuery.filters) ? parsedQuery.filters : []
  };
  return {
    id: panel.id,
    type: panel.type,
    title: panel.title,
    description: panel.description,
    query,
    ...(panel.visualization_json ? { visualization: JSON.parse(panel.visualization_json) } : {}),
    layout: { width: Number(panel.width), minHeight: Number(panel.min_height) }
  };
}

async function readPanelLibrary() {
  const rows = await runSql('SELECT id, type, title, description, query_json, visualization_json, default_width AS width, default_min_height AS min_height FROM panel_definitions ORDER BY title, id');
  return { panels: rows.map(parsePanelRow) };
}

function validatePanelPayload(value) {
  if (!value || typeof value !== 'object') throw new Error('Panel 请求体无效。');
  const panel = value;
  if (typeof panel.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(panel.id)) throw new Error('Panel ID 只能使用小写字母、数字和连字符。');
  if (typeof panel.title !== 'string' || !panel.title.trim()) throw new Error('Panel 标题不能为空。');
  if (typeof panel.description !== 'string' || !panel.description.trim()) throw new Error('Panel 描述不能为空。');
  if (!['metric', 'line', 'bar', 'donut', 'table', 'timeline', 'graph'].includes(panel.type)) throw new Error('Panel 类型不支持。');
  if (!panel.query || !datasetDefinitions[panel.query.datasetId]) throw new Error('Panel QuerySpec 数据集不支持。');
  if (!Array.isArray(panel.query.metrics) || panel.query.metrics.length < 1 || panel.query.metrics.length > 6) throw new Error('Panel 必须选择 1 到 6 个指标。');
  if (!Array.isArray(panel.query.dimensions) || !Array.isArray(panel.query.filters)) throw new Error('Panel QuerySpec 结构无效。');
  if (panel.query.dimensions.length > 4) throw new Error('Panel 最多支持 4 个维度。');
  validateQuery(panel.query);
  const semanticDataset = dashboardDefinitions
    .map((dashboard) => dashboard.dataset)
    .find((dataset) => panel.query.metrics.every((metric) => dataset.metrics.some((item) => item.id === metric.metricId))
      && panel.query.dimensions.every((dimension) => dataset.dimensions.some((item) => item.id === dimension.dimensionId)));
  if (!semanticDataset) throw new Error('Panel 指标和维度不属于同一个逻辑数据集。');
  const metrics = panel.query.metrics.map((item) => semanticDataset.metrics.find((metric) => metric.id === item.metricId));
  if (metrics.some((metric) => !metric)) throw new Error('Panel 包含未知指标。');
  for (const dimension of panel.query.dimensions) {
    for (const metric of metrics) {
      if (!metric.supportedDimensions.includes(dimension.dimensionId)) throw new Error(`指标「${metric.label}」不支持维度「${dimension.dimensionId}」。`);
    }
  }
  if (panel.type === 'metric' && panel.query.dimensions.length) throw new Error('指标卡不能包含分组维度。');
  if (panel.type === 'graph' && panel.query.dimensions.length !== 2) throw new Error('拓扑图必须选择两个维度。');
  if (!panel.layout || !Number.isInteger(panel.layout.width) || panel.layout.width < 3 || panel.layout.width > 12 || !Number.isInteger(panel.layout.minHeight) || panel.layout.minHeight < 120 || panel.layout.minHeight > 800) throw new Error('Panel 布局参数无效。');
  return panel;
}

async function savePanel(value) {
  const panel = validatePanelPayload(value);
  const existing = await runSql(`SELECT id FROM panel_definitions WHERE id = ${sqlString(panel.id)}`);
  const templateIds = dashboardDefinitions.flatMap((dashboard) => dashboard.panelTemplates).map((item) => item.id);
  if (!existing.length && templateIds.includes(panel.id)) throw new Error(`Panel ID 已被模板占用：${panel.id}。`);
  const visualization = panel.visualization ? sqlString(JSON.stringify(panel.visualization)) : 'NULL';
  const query = sqlString(JSON.stringify(panel.query));
  if (existing.length) {
    await runSql(`UPDATE panel_definitions SET type = ${sqlString(panel.type)}, title = ${sqlString(panel.title.trim())}, description = ${sqlString(panel.description.trim())}, query_json = ${query}, visualization_json = ${visualization}, default_width = ${panel.layout.width}, default_min_height = ${panel.layout.minHeight} WHERE id = ${sqlString(panel.id)}`, { readonly: false });
  } else {
    await runSql(`INSERT INTO panel_definitions (id, type, title, description, query_json, visualization_json, default_width, default_min_height) VALUES (${sqlString(panel.id)}, ${sqlString(panel.type)}, ${sqlString(panel.title.trim())}, ${sqlString(panel.description.trim())}, ${query}, ${visualization}, ${panel.layout.width}, ${panel.layout.minHeight})`, { readonly: false });
  }
  queryCache.clear();
  const saved = await runSql(`SELECT id, type, title, description, query_json, visualization_json, default_width AS width, default_min_height AS min_height FROM panel_definitions WHERE id = ${sqlString(panel.id)}`);
  return { panel: parsePanelRow(saved[0]) };
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
  const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' });
    response.end();
    return;
  }
  if (request.method === 'GET' && requestUrl.pathname === '/api/dashboard/health') {
    try {
      const rows = await runSql("SELECT COALESCE((SELECT row_count FROM dataset_runs WHERE dataset_id = 'aviation-ontime'), 0) AS flight_count");
      const rollupRows = rollupAvailable.get('aviation_ontime_demo') ? await runSql('SELECT COUNT(*) AS aggregate_count FROM aviation_dashboard_rollup') : [];
      sendJson(response, 200, { status: rollupAvailable.get('aviation_ontime_demo') ? 'ok' : 'degraded', database, flightCount: rows[0]?.flight_count ?? 0, aggregateCount: rollupRows[0]?.aggregate_count ?? 0, querySource: rollupAvailable.get('aviation_ontime_demo') ? 'aviation_dashboard_rollup' : 'aviation_flights' });
    } catch (error) {
      sendJson(response, 503, { status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (request.method === 'GET' && requestUrl.pathname === '/api/dashboard/config') {
    try {
      sendJson(response, 200, await readConfig(requestUrl.searchParams.get('dashboard') || aviationDashboard.id));
    } catch (error) {
      sendJson(response, 503, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (request.method === 'GET' && requestUrl.pathname === '/api/dashboard/panels') {
    try {
      sendJson(response, 200, await readPanelLibrary());
    } catch (error) {
      sendJson(response, 503, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (request.method === 'POST' && requestUrl.pathname === '/api/dashboard/panels') {
    try {
      sendJson(response, 200, await savePanel(await readBody(request)));
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (request.method === 'POST' && requestUrl.pathname === '/api/dashboard/query') {
    try {
      const query = await readBody(request);
      sendJson(response, 200, await executeDashboardQuery(query));
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (request.method === 'POST' && requestUrl.pathname === '/api/dashboard/query-batch') {
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
  .then(() => server.listen(port, '127.0.0.1', () => {
    console.log(`[dashboard-data] http://127.0.0.1:${port} -> ${database}`);
  }))
  .catch((error) => {
    console.error(`[dashboard-data] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
