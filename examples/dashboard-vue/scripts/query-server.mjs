import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  ensureDashboardSchema
} from './dashboard-config-store.mjs';
import { createQueryEngine } from './query-engine.mjs';
import { loadSchemaRegistry } from './schema-registry.mjs';
import { createSqliteRunner, resolveDatabasePath } from './sqlite-cli.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultDatabase = path.resolve(here, '../../data-sources/data/dashboard.sqlite');
const defaultSchemaDirectory = path.resolve(here, '../../data-sources/schemas');
const database = resolveDatabasePath(process.env.DASHBOARD_DB, defaultDatabase);
const schemaDirectory = path.resolve(process.env.DASHBOARD_SCHEMA_DIR || defaultSchemaDirectory);
const port = Number(process.env.DASHBOARD_DATA_PORT || 5176);
const maxBodySize = 1024 * 1024;
const {
  domains: dashboardDefinitions,
  domainById: dashboards,
  queryModels,
  queryModelById
} = await loadSchemaRegistry(schemaDirectory);
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

const runSql = createSqliteRunner(database);
const queryEngine = createQueryEngine({ runSql, queryModels });

async function executeDashboardQuery(query) {
  const key = JSON.stringify(query);
  const cached = queryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  const running = queryInFlight.get(key);
  if (running) return running;
  const promise = (async () => {
    const result = await queryEngine.execute(query);
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

async function readConfig(dashboardId) {
  const configs = await runSql(`SELECT id, topic_id, title, description, source_manifest_json, dataset_json, base_dashboard_id FROM dashboard_configs WHERE id = ${sqlString(dashboardId)}`);
  if (!configs.length) throw new Error('Dashboard 配置尚未初始化。');
  const config = configs[0];
  const dashboard = dashboards.get(config.base_dashboard_id || config.id);
  if (!dashboard) throw new Error(`Dashboard 数据域无效：${config.base_dashboard_id || config.id}。`);
  const panels = await runSql(`SELECT d.id, d.type, d.title, d.description, d.query_json, d.visualization_json, p.width, p.min_height FROM dashboard_panel_placements AS p JOIN panel_definitions AS d ON d.id = p.panel_id WHERE p.dashboard_id = ${sqlString(config.id)} ORDER BY p.sort_order`);
  const panelIds = [...dashboard.panels, ...dashboard.panelTemplates].map((panel) => sqlString(panel.id)).join(', ');
  const panelLibrary = await runSql(`SELECT id, type, title, description, query_json, visualization_json, default_width AS width, default_min_height AS min_height FROM panel_definitions WHERE id IN (${panelIds}) ORDER BY title, id`);
  const facetEntries = await Promise.all(dashboard.queryModels.flatMap((model) =>
    (model.facets ?? []).map(async (facet) => [facet.id, await queryEngine.readFacet(model, facet)])
  ));
  const facets = Object.fromEntries(facetEntries);
  const filterDefinitions = (dashboard.filterDefinitions ?? []).map((definition) => {
    const resolved = { ...definition };
    if (resolved.defaultFromFacet === 'first' && resolved.facetKey && facets[resolved.facetKey]?.length) {
      const first = facets[resolved.facetKey][0];
      resolved.defaultValue = typeof first === 'string' ? first : first.code;
    }
    delete resolved.defaultFromFacet;
    return resolved;
  });
  const placedPanelIds = new Set(panels.map((panel) => panel.id));
  const evidenceGroups = (dashboard.evidenceGroups ?? [])
    .map((group) => ({ ...group, panelIds: group.panelIds.filter((panelId) => placedPanelIds.has(panelId)) }))
    .filter((group) => group.panelIds.length >= 2);
  return {
    id: config.id,
    topicId: config.topic_id,
    title: config.title,
    description: config.description,
    sourceManifest: JSON.parse(config.source_manifest_json),
    dataset: JSON.parse(config.dataset_json),
    panels: panels.map(parsePanelRow),
    panelLibrary: panelLibrary.map(parsePanelRow),
    panelTemplates: panelLibrary
      .filter((panel) => dashboard.panelTemplates.some((template) => template.id === panel.id))
      .map(parsePanelRow),
    querySources: dashboard.querySources ?? [{ datasetId: dashboard.dataset.id, metricIds: dashboard.dataset.metrics.map((metric) => metric.id) }],
    facets,
    filterDefinitions,
    evidenceGroups,
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

async function readDashboardLibrary() {
  const configs = await runSql('SELECT id, topic_id, title, description, base_dashboard_id FROM dashboard_configs ORDER BY title, id');
  const placements = await runSql('SELECT dashboard_id, panel_id, sort_order, width, min_height FROM dashboard_panel_placements ORDER BY dashboard_id, sort_order');
  return {
    dashboards: configs.map((config) => ({
      id: config.id,
      topicId: config.topic_id,
      title: config.title,
      description: config.description,
      baseDashboardId: config.base_dashboard_id || config.id,
      placements: placements
        .filter((placement) => placement.dashboard_id === config.id)
        .map((placement) => ({
          panelId: placement.panel_id,
          sortOrder: Number(placement.sort_order),
          width: Number(placement.width),
          minHeight: Number(placement.min_height)
        }))
    }))
  };
}

function dataDomainSummary(domain) {
  return {
    id: domain.id,
    topicId: domain.topicId,
    title: domain.title,
    description: domain.description,
    metadata: domain.metadata,
    datasetIds: domain.queryModels.map((model) => model.id)
  };
}

function dataDomainDetail(domain) {
  return {
    ...dataDomainSummary(domain),
    sourceManifest: domain.sourceManifest ?? {},
    dataset: domain.dataset,
    querySources: domain.querySources,
    filterDefinitions: domain.filterDefinitions ?? [],
    dataSources: domain.queryModels.map((model) => ({
      id: model.id,
      title: model.title,
      sources: model.sources.map((source) => ({ id: source.id, table: source.table })),
      metricIds: [...new Set(model.sources.flatMap((source) => Object.keys(source.metrics)))],
      dimensionIds: [...new Set(model.sources.flatMap((source) => Object.keys(source.dimensions)))]
    }))
  };
}

function validateDashboardPayload(value) {
  if (!value || typeof value !== 'object') throw new Error('Dashboard 请求体无效。');
  const dashboard = value;
  if (typeof dashboard.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(dashboard.id)) throw new Error('Dashboard ID 只能使用小写字母、数字和连字符。');
  if (typeof dashboard.title !== 'string' || !dashboard.title.trim()) throw new Error('Dashboard 标题不能为空。');
  if (typeof dashboard.description !== 'string' || !dashboard.description.trim()) throw new Error('Dashboard 描述不能为空。');
  if (typeof dashboard.baseDashboardId !== 'string' || !dashboards.has(dashboard.baseDashboardId)) throw new Error('Dashboard 数据域无效。');
  if (!Array.isArray(dashboard.placements) || dashboard.placements.length < 1 || dashboard.placements.length > 64) throw new Error('Dashboard 必须包含 1 到 64 个 Panel。');
  const panelIds = new Set();
  dashboard.placements.forEach((placement) => {
    if (!placement || typeof placement.panelId !== 'string' || panelIds.has(placement.panelId)) throw new Error('Dashboard Panel 引用无效或重复。');
    panelIds.add(placement.panelId);
    if (!Number.isInteger(placement.width) || placement.width < 3 || placement.width > 12) throw new Error(`Panel ${placement.panelId} 的宽度无效。`);
    if (!Number.isInteger(placement.minHeight) || placement.minHeight < 120 || placement.minHeight > 800) throw new Error(`Panel ${placement.panelId} 的高度无效。`);
  });
  return dashboard;
}

async function saveDashboard(value) {
  const dashboard = validateDashboardPayload(value);
  const base = dashboards.get(dashboard.baseDashboardId);
  const allowedDatasets = new Set((base.querySources ?? [{ datasetId: base.dataset.id }]).map((source) => source.datasetId));
  const existing = await runSql(`SELECT id FROM dashboard_configs WHERE id = ${sqlString(dashboard.id)}`);
  const requestedIds = [...new Set(dashboard.placements.map((placement) => placement.panelId))];
  const definitions = await runSql(`SELECT id, query_json FROM panel_definitions WHERE id IN (${requestedIds.map(sqlString).join(', ')})`);
  if (definitions.length !== requestedIds.length) throw new Error('Dashboard 引用了不存在的 Panel。');
  const incompatible = definitions.filter((definition) => !allowedDatasets.has(JSON.parse(definition.query_json || '{}').datasetId));
  if (incompatible.length) throw new Error(`以下 Panel 不属于所选数据域：${incompatible.map((panel) => panel.id).join(', ')}。`);

  const configSql = existing.length
    ? `UPDATE dashboard_configs SET topic_id = ${sqlString(base.topicId)}, title = ${sqlString(dashboard.title.trim())}, description = ${sqlString(dashboard.description.trim())}, source_manifest_json = ${sqlString(JSON.stringify(base.sourceManifest))}, dataset_json = ${sqlString(JSON.stringify(base.dataset))}, base_dashboard_id = ${sqlString(base.id)} WHERE id = ${sqlString(dashboard.id)}`
    : `INSERT INTO dashboard_configs (id, topic_id, title, description, source_manifest_json, dataset_json, base_dashboard_id) VALUES (${sqlString(dashboard.id)}, ${sqlString(base.topicId)}, ${sqlString(dashboard.title.trim())}, ${sqlString(dashboard.description.trim())}, ${sqlString(JSON.stringify(base.sourceManifest))}, ${sqlString(JSON.stringify(base.dataset))}, ${sqlString(base.id)})`;
  const placementSql = dashboard.placements.map((placement, index) => `INSERT INTO dashboard_panel_placements (dashboard_id, panel_id, sort_order, width, min_height) VALUES (${sqlString(dashboard.id)}, ${sqlString(placement.panelId)}, ${index}, ${placement.width}, ${placement.minHeight})`);
  await runSql(`BEGIN; ${configSql}; DELETE FROM dashboard_panel_placements WHERE dashboard_id = ${sqlString(dashboard.id)}; ${placementSql.join(';')}; COMMIT`, { readonly: false });
  return { dashboard: (await readDashboardLibrary()).dashboards.find((item) => item.id === dashboard.id) };
}

async function deleteDashboard(dashboardId) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(dashboardId)) throw new Error('Dashboard ID 无效。');
  const existing = await runSql(`SELECT id FROM dashboard_configs WHERE id = ${sqlString(dashboardId)}`);
  if (!existing.length) throw new Error('Dashboard 不存在。');
  await runSql(`BEGIN; DELETE FROM dashboard_panel_placements WHERE dashboard_id = ${sqlString(dashboardId)}; DELETE FROM dashboard_configs WHERE id = ${sqlString(dashboardId)}; COMMIT`, { readonly: false });
  return { deleted: dashboardId };
}

async function deletePanel(panelId) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(panelId)) throw new Error('Panel ID 无效。');
  const existing = await runSql(`SELECT id FROM panel_definitions WHERE id = ${sqlString(panelId)}`);
  if (!existing.length) throw new Error('Panel 不存在。');
  const placements = await runSql(`SELECT dashboard_id FROM dashboard_panel_placements WHERE panel_id = ${sqlString(panelId)} ORDER BY dashboard_id`);
  await runSql(`BEGIN; DELETE FROM dashboard_panel_placements WHERE panel_id = ${sqlString(panelId)}; DELETE FROM panel_definitions WHERE id = ${sqlString(panelId)}; COMMIT`, { readonly: false });
  queryCache.clear();
  return { deleted: panelId, removedFromDashboards: placements.map((placement) => placement.dashboard_id) };
}

function validatePanelPayload(value) {
  if (!value || typeof value !== 'object') throw new Error('Panel 请求体无效。');
  const panel = value;
  if (typeof panel.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(panel.id)) throw new Error('Panel ID 只能使用小写字母、数字和连字符。');
  if (typeof panel.title !== 'string' || !panel.title.trim()) throw new Error('Panel 标题不能为空。');
  if (typeof panel.description !== 'string' || !panel.description.trim()) throw new Error('Panel 描述不能为空。');
  if (!['metric', 'line', 'bar', 'donut', 'table', 'timeline', 'graph'].includes(panel.type)) throw new Error('Panel 类型不支持。');
  const queryModel = panel.query && queryModelById.get(panel.query.datasetId);
  if (!queryModel) throw new Error('Panel QuerySpec 数据集不支持。');
  if (!Array.isArray(panel.query.metrics) || panel.query.metrics.length < 1 || panel.query.metrics.length > 6) throw new Error('Panel 必须选择 1 到 6 个指标。');
  if (!Array.isArray(panel.query.dimensions) || !Array.isArray(panel.query.filters)) throw new Error('Panel QuerySpec 结构无效。');
  if (panel.query.dimensions.length > 4) throw new Error('Panel 最多支持 4 个维度。');
  const compatibleSource = queryModel.sources.find((source) =>
    panel.query.metrics.every((metric) => source.metrics[metric.metricId])
      && panel.query.dimensions.every((dimension) => source.dimensions[dimension.dimensionId])
      && panel.query.filters.every((filter) => source.dimensions[filter.dimensionId])
  );
  if (!compatibleSource) throw new Error('Panel QuerySpec 没有兼容的数据源。');
  const semanticDataset = dashboardDefinitions
    .find((dashboard) => dashboard.queryModels.some((model) => model.id === panel.query.datasetId))
    ?.dataset;
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
    response.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type' });
    response.end();
    return;
  }
  if (request.method === 'GET' && requestUrl.pathname === '/api/dashboard/health') {
    try {
      await runSql('SELECT 1 AS ready');
      sendJson(response, 200, { status: 'ok', database, schemas: schemaDirectory, domains: dashboardDefinitions.length, queryModels: queryModels.length });
    } catch (error) {
      sendJson(response, 503, { status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (request.method === 'GET' && requestUrl.pathname === '/api/data-domains') {
    sendJson(response, 200, { domains: dashboardDefinitions.map(dataDomainSummary) });
    return;
  }
  if (request.method === 'GET' && requestUrl.pathname.startsWith('/api/data-domains/')) {
    const domainId = decodeURIComponent(requestUrl.pathname.slice('/api/data-domains/'.length));
    const domain = dashboards.get(domainId);
    if (!domain) {
      sendJson(response, 404, { error: '数据域不存在。' });
      return;
    }
    sendJson(response, 200, { domain: dataDomainDetail(domain) });
    return;
  }
  if (request.method === 'GET' && requestUrl.pathname === '/api/dashboard/config') {
    try {
      const dashboardId = requestUrl.searchParams.get('dashboard');
      if (!dashboardId) throw new Error('缺少 dashboard 查询参数。');
      sendJson(response, 200, await readConfig(dashboardId));
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
  if (request.method === 'GET' && requestUrl.pathname === '/api/dashboard/dashboards') {
    try {
      sendJson(response, 200, await readDashboardLibrary());
    } catch (error) {
      sendJson(response, 503, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (request.method === 'POST' && requestUrl.pathname === '/api/dashboard/dashboards') {
    try {
      sendJson(response, 200, await saveDashboard(await readBody(request)));
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (request.method === 'DELETE' && requestUrl.pathname.startsWith('/api/dashboard/dashboards/')) {
    try {
      sendJson(response, 200, await deleteDashboard(decodeURIComponent(requestUrl.pathname.slice('/api/dashboard/dashboards/'.length))));
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
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
  if (request.method === 'DELETE' && requestUrl.pathname.startsWith('/api/dashboard/panels/')) {
    try {
      sendJson(response, 200, await deletePanel(decodeURIComponent(requestUrl.pathname.slice('/api/dashboard/panels/'.length))));
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

ensureDashboardSchema(runSql)
  .then(() => queryEngine.initialize())
  .then(() => server.listen(port, '127.0.0.1', () => {
    console.log(`[dashboard-data] http://127.0.0.1:${port} -> ${database}`);
  }))
  .catch((error) => {
    console.error(`[dashboard-data] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
