import { reactive, toRaw } from 'vue';
import { aviationDataset, aviationPanelTemplates, aviationSourceManifest, defaultAviationPanels, metricById } from '../data/aviation';
import { queryDashboardBatch } from '../query/client';
import type { DashboardConfig, DashboardFilters, DashboardView, DatasetDefinition, FacetOption, PanelConfig, QueryResult, QuerySpec } from '../model/types';

const defaultFilters: DashboardFilters = {
  airport: 'ALL',
  carrier: 'ALL',
  direction: 'departure',
  timeRange: { startHour: 6, endHour: 22 }
};

function clone<T>(value: T): T {
  return structuredClone(toRaw(value));
}

export const dashboardState = reactive<{
  config: DashboardConfig;
  defaultPanels: PanelConfig[];
  panelTemplates: PanelConfig[];
  airports: FacetOption[];
  carriers: string[];
  dataset: DatasetDefinition;
  sourceManifest: typeof aviationSourceManifest;
  panelResults: Map<string, QueryResult>;
  dataLoading: boolean;
  dataError: string;
  filters: DashboardFilters;
  highlightedPanelIds: string[];
  selectedPanelId: string;
  selectedAirport: string;
  savedViews: DashboardView[];
  lastAction: string;
}>({
  config: {
    id: 'aviation-operations',
    topicId: 'aviation',
    title: 'Flight Operations / Delay Analysis',
    description: '基于 BTS 航班运行数据的可寻址、可联动 Dashboard。',
    panels: defaultAviationPanels.map((panel) => clone(panel))
  },
  defaultPanels: defaultAviationPanels.map((panel) => clone(panel)),
  panelTemplates: aviationPanelTemplates.map((panel) => clone(panel)),
  airports: [{ code: 'JFK', label: '约翰·肯尼迪国际机场' }, { code: 'LGA', label: '拉瓜迪亚机场' }, { code: 'EWR', label: '纽瓦克自由国际机场' }],
  carriers: ['AA', 'DL', 'UA', 'B6'],
  dataset: aviationDataset,
  sourceManifest: aviationSourceManifest,
  panelResults: new Map(),
  dataLoading: false,
  dataError: '',
  filters: clone(defaultFilters),
  highlightedPanelIds: [],
  selectedPanelId: '',
  selectedAirport: '',
  savedViews: [],
  lastAction: '页面已加载'
});

let refreshSequence = 0;

function setAction(message: string) {
  dashboardState.lastAction = message;
}

export function queryForPanel(panel: PanelConfig): QuerySpec {
  const filters = [...panel.query.filters];
  if (dashboardState.filters.airport !== 'ALL') filters.push({ dimensionId: 'airport', operator: 'eq', value: dashboardState.filters.airport });
  if (dashboardState.filters.carrier !== 'ALL') filters.push({ dimensionId: 'carrier', operator: 'eq', value: dashboardState.filters.carrier });
  filters.push({ dimensionId: 'direction', operator: 'eq', value: dashboardState.filters.direction });
  return {
    ...panel.query,
    filters,
    timeRange: { ...dashboardState.filters.timeRange }
  };
}

export function resultForPanel(panel: PanelConfig): QueryResult {
  const query = queryForPanel(panel);
  return dashboardState.panelResults.get(panel.id) ?? {
    columns: [],
    rows: [],
    loading: dashboardState.dataLoading,
    error: dashboardState.dataLoading ? undefined : (dashboardState.dataError || '数据尚未加载。'),
    summary: { rowCount: 0, source: 'SQLite aviation_flights', query }
  };
}

export async function loadDashboardConfig() {
  dashboardState.dataLoading = true;
  dashboardState.dataError = '';
  try {
    const response = await fetch('/api/dashboard/config');
    const payload = await response.json() as {
      id: string;
      topicId: string;
      title: string;
      description: string;
      sourceManifest: typeof aviationSourceManifest;
      dataset: DatasetDefinition;
      panels: PanelConfig[];
      panelTemplates: PanelConfig[];
      facets: { airports: FacetOption[]; carriers: string[] };
    } & { error?: string };
    if (!response.ok || payload.error) throw new Error(payload.error || `Dashboard 配置请求失败（${response.status}）。`);
    dashboardState.config = { id: payload.id, topicId: payload.topicId, title: payload.title, description: payload.description, panels: payload.panels.map((panel) => clone(panel)) };
    dashboardState.defaultPanels = payload.panels.map((panel) => clone(panel));
    dashboardState.panelTemplates = payload.panelTemplates.map((panel) => clone(panel));
    dashboardState.airports = payload.facets.airports;
    dashboardState.carriers = payload.facets.carriers;
    dashboardState.dataset = payload.dataset;
    metricById.clear();
    payload.dataset.metrics.forEach((metric) => metricById.set(metric.id, metric));
    dashboardState.sourceManifest = payload.sourceManifest;
    await refreshDashboardData();
  } catch (error) {
    dashboardState.dataError = error instanceof Error ? error.message : 'Dashboard 配置加载失败。';
  } finally {
    dashboardState.dataLoading = false;
  }
}

export async function savePanelConfig(panel: PanelConfig) {
  const response = await fetch('/api/dashboard/panels', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(panel)
  });
  const payload = await response.json() as {
    panels?: PanelConfig[];
    panelTemplates?: PanelConfig[];
    error?: string;
  };
  if (!response.ok || payload.error || !payload.panels || !payload.panelTemplates) {
    throw new Error(payload.error || `Panel 保存失败（${response.status}）。`);
  }
  dashboardState.config.panels = payload.panels.map((item) => clone(item));
  dashboardState.defaultPanels = payload.panels.map((item) => clone(item));
  dashboardState.panelTemplates = payload.panelTemplates.map((item) => clone(item));
  dashboardState.panelResults.clear();
  setAction(`已保存 Panel：${panel.title}`);
  await refreshDashboardData();
  return dashboardState.config.panels.find((item) => item.id === panel.id) ?? panel;
}

export async function refreshDashboardData() {
  const panels = dashboardState.config.panels.map((panel) => clone(panel));
  const sequence = ++refreshSequence;
  dashboardState.dataLoading = true;
  dashboardState.panelResults.clear();
  const queries = panels.map((panel) => queryForPanel(panel));
  let results: QueryResult[];
  try {
    results = await queryDashboardBatch(queries);
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询执行失败。';
    results = queries.map((query) => ({ columns: [], rows: [], error: message, summary: { rowCount: 0, source: 'SQLite aviation_flights', query } }));
  }
  if (sequence !== refreshSequence) return;
  dashboardState.panelResults.clear();
  panels.forEach((panel, index) => dashboardState.panelResults.set(panel.id, results[index] ?? { columns: [], rows: [], error: '查询没有返回结果。', summary: { rowCount: 0, source: 'SQLite aviation_flights', query: queries[index] } }));
  dashboardState.dataLoading = false;
}

export function setGlobalFilter(field: 'airport' | 'carrier' | 'direction', value: string) {
  if (field === 'direction') {
    if (value !== 'departure' && value !== 'arrival') throw new Error('不支持的航班方向。');
    dashboardState.filters.direction = value;
  }
  if (field === 'airport') dashboardState.filters.airport = value;
  if (field === 'carrier') dashboardState.filters.carrier = value;
  setAction(`已更新全局筛选：${field} = ${value}`);
}

export function setTimeRange(startHour: number, endHour: number) {
  if (!Number.isInteger(startHour) || !Number.isInteger(endHour) || startHour < 0 || endHour > 23 || startHour > endHour) throw new Error('时间范围必须是 0-23 小时内的整数。');
  dashboardState.filters.timeRange = { startHour, endHour };
  setAction(`已更新时间范围：${startHour}:00-${endHour}:00`);
}

export function highlightPanels(panelIds: string[]) {
  const known = new Set(dashboardState.config.panels.map((panel) => panel.id));
  const invalid = panelIds.filter((id) => !known.has(id));
  if (invalid.length) throw new Error(`未知 Panel：${invalid.join(', ')}。`);
  dashboardState.highlightedPanelIds = [...new Set(panelIds)];
  setAction(`已高亮 ${dashboardState.highlightedPanelIds.length} 个 Panel`);
}

export function selectAirport(airport: string) {
  if (!dashboardState.airports.some((item) => item.code === airport)) throw new Error(`未知机场：${airport}。`);
  dashboardState.selectedAirport = airport;
  setGlobalFilter('airport', airport);
  highlightPanels(['airport-status', 'airport-ranking', 'hourly-on-time']);
}

export function addPanel(templateId: string) {
  const template = dashboardState.panelTemplates.find((panel) => panel.id === templateId);
  if (!template) throw new Error(`未知 Panel 模板：${templateId}。`);
  const count = dashboardState.config.panels.filter((panel) => panel.id.startsWith(template.id)).length;
  const panel = clone(template);
  panel.id = `${template.id}-${count + 1}`;
  panel.title = `${template.title} / AI ${count + 1}`;
  dashboardState.config.panels.push(panel);
  setAction(`已添加 Panel：${panel.title}`);
  void refreshDashboardData();
  return panel.id;
}

export function resetDashboard() {
  dashboardState.filters = clone(defaultFilters);
  dashboardState.config.panels = dashboardState.defaultPanels.map((panel) => clone(panel));
  dashboardState.highlightedPanelIds = [];
  dashboardState.selectedPanelId = '';
  dashboardState.selectedAirport = '';
  setAction('已恢复默认 Dashboard');
  void refreshDashboardData();
}

export function saveView(name = `调查视图 ${dashboardState.savedViews.length + 1}`) {
  const view: DashboardView = {
    id: `view-${Date.now()}`,
    name,
    savedAt: new Date().toISOString(),
    filters: clone(dashboardState.filters),
    panels: dashboardState.config.panels.map((panel) => clone(panel))
  };
  dashboardState.savedViews.unshift(view);
  dashboardState.savedViews.splice(5);
  setAction(`已保存视图：${name}`);
  return view;
}

export function restoreView(viewId?: string) {
  const view = dashboardState.savedViews.find((item) => item.id === viewId) ?? dashboardState.savedViews[0];
  if (!view) throw new Error('当前没有可恢复的调查视图。');
  dashboardState.filters = clone(view.filters);
  dashboardState.config.panels = view.panels.map((panel) => clone(panel));
  setAction(`已恢复视图：${view.name}`);
}

export function panelContext(panelId: string) {
  const panel = dashboardState.config.panels.find((item) => item.id === panelId);
  if (!panel) throw new Error(`Panel 不存在：${panelId}。`);
  const result = resultForPanel(panel);
  if (result.error) throw new Error(result.error);
  return {
    panelId: panel.id,
    title: panel.title,
    description: panel.description,
    type: panel.type,
    datasetId: dashboardState.dataset.id,
    metrics: panel.query.metrics.map((metric) => metric.metricId),
    dimensions: panel.query.dimensions.map((dimension) => dimension.dimensionId),
    filters: queryForPanel(panel).filters,
    timeRange: queryForPanel(panel).timeRange,
    resultSummary: result.summary,
    rows: result.rows.slice(0, 20)
  };
}

export function dashboardContext() {
  return {
    dashboardId: dashboardState.config.id,
    topicId: dashboardState.config.topicId,
    filters: dashboardState.filters,
    panels: dashboardState.config.panels.map((panel) => ({ id: panel.id, title: panel.title, type: panel.type })),
    dataset: dashboardState.dataset.id,
    highlightedPanelIds: dashboardState.highlightedPanelIds,
    selectedAirport: dashboardState.selectedAirport,
    lastAction: dashboardState.lastAction
  };
}
