import { reactive, toRaw } from 'vue';
import { queryDashboardBatch } from '../query/client';
import type { DashboardConfig, DatasetDefinition, PanelConfig, QueryResult, QuerySpec } from '../model/types';

export interface AirQualityFilters {
  startDate: string;
  endDate: string;
  station: string;
}

const defaultFilters: AirQualityFilters = {
  startDate: '2016-01-01',
  endDate: '2017-02-28',
  station: 'ALL'
};

function clone<T>(value: T): T {
  return structuredClone(toRaw(value));
}

function normalizePanel(panel: PanelConfig): PanelConfig {
  return {
    ...panel,
    query: {
      ...panel.query,
      metrics: Array.isArray(panel.query?.metrics) ? panel.query.metrics : [],
      dimensions: Array.isArray(panel.query?.dimensions) ? panel.query.dimensions : [],
      filters: Array.isArray(panel.query?.filters) ? panel.query.filters : []
    }
  };
}

export const airQualityState = reactive<{
  config: DashboardConfig;
  panelLibrary: PanelConfig[];
  dataset: DatasetDefinition;
  stations: Array<{ code: string; label: string }>;
  filters: AirQualityFilters;
  panelResults: Map<string, QueryResult>;
  dataLoading: boolean;
  dataError: string;
  highlightedPanelIds: string[];
  selectedPanelId: string;
  lastAction: string;
}>({
  config: { id: 'air-quality-operations', topicId: 'air-quality', title: 'Beijing Air Quality / Pollution Monitoring', description: '', panels: [] },
  panelLibrary: [],
  dataset: { id: 'beijing_air_quality_demo', name: '', description: '', sourceLabel: '', entities: [], dimensions: [], metrics: [], relations: [] },
  stations: [],
  filters: clone(defaultFilters),
  panelResults: new Map(),
  dataLoading: false,
  dataError: '',
  highlightedPanelIds: [],
  selectedPanelId: '',
  lastAction: '页面已加载'
});

let refreshSequence = 0;

function setAction(message: string) {
  airQualityState.lastAction = message;
}

export function queryForAirPanel(panel: PanelConfig): QuerySpec {
  const filters = [...panel.query.filters.filter((item) => item.dimensionId !== 'date' && item.dimensionId !== 'station')];
  filters.push({ dimensionId: 'date', operator: 'between', value: [airQualityState.filters.startDate, airQualityState.filters.endDate] });
  if (airQualityState.filters.station !== 'ALL') filters.push({ dimensionId: 'station', operator: 'eq', value: airQualityState.filters.station });
  return { ...panel.query, filters };
}

export function resultForAirPanel(panel: PanelConfig): QueryResult {
  return airQualityState.panelResults.get(panel.id) ?? {
    columns: [],
    rows: [],
    loading: airQualityState.dataLoading,
    error: airQualityState.dataLoading ? undefined : (airQualityState.dataError || '数据尚未加载。'),
    summary: { rowCount: 0, source: 'SQLite air_quality_dashboard_rollup', query: queryForAirPanel(panel) }
  };
}

export async function loadAirQualityConfig() {
  airQualityState.dataLoading = true;
  airQualityState.dataError = '';
  try {
    const response = await fetch('/api/dashboard/config?dashboard=air-quality-operations');
    const payload = await response.json() as {
      id: string; topicId: string; title: string; description: string; dataset: DatasetDefinition;
      panels: PanelConfig[]; panelLibrary: PanelConfig[]; facets: { stations?: Array<{ code: string; label: string }> }; error?: string;
    };
    if (!response.ok || payload.error) throw new Error(payload.error || `空气质量配置请求失败（${response.status}）。`);
    airQualityState.config = { id: payload.id, topicId: payload.topicId, title: payload.title, description: payload.description, panels: payload.panels.map(normalizePanel) };
    airQualityState.panelLibrary = payload.panelLibrary.map(normalizePanel);
    airQualityState.dataset = payload.dataset;
    airQualityState.stations = payload.facets.stations ?? [];
    await refreshAirQualityData();
  } catch (error) {
    airQualityState.dataError = error instanceof Error ? error.message : '空气质量配置加载失败。';
  } finally {
    airQualityState.dataLoading = false;
  }
}

export async function refreshAirQualityData() {
  const panels = airQualityState.config.panels.map(clone);
  const sequence = ++refreshSequence;
  airQualityState.dataLoading = true;
  airQualityState.panelResults.clear();
  const queries = panels.map(queryForAirPanel);
  try {
    const results = await queryDashboardBatch(queries);
    if (sequence !== refreshSequence) return;
    panels.forEach((panel, index) => airQualityState.panelResults.set(panel.id, results[index] ?? { columns: [], rows: [], error: '查询没有返回结果。', summary: { rowCount: 0, source: 'SQLite air_quality_dashboard_rollup', query: queries[index] } }));
  } catch (error) {
    const message = error instanceof Error ? error.message : '空气质量查询失败。';
    panels.forEach((panel, index) => airQualityState.panelResults.set(panel.id, { columns: [], rows: [], error: message, summary: { rowCount: 0, source: 'SQLite air_quality_dashboard_rollup', query: queries[index] } }));
  } finally {
    if (sequence === refreshSequence) airQualityState.dataLoading = false;
  }
}

export function setAirQualityFilters(filters: Partial<AirQualityFilters>) {
  if (filters.startDate) airQualityState.filters.startDate = filters.startDate;
  if (filters.endDate) airQualityState.filters.endDate = filters.endDate;
  if (filters.station) airQualityState.filters.station = filters.station;
  setAction(`已更新空气质量筛选：${airQualityState.filters.startDate} 至 ${airQualityState.filters.endDate}`);
}

export function highlightAirQualityPanels(panelIds: string[]) {
  const known = new Set(airQualityState.config.panels.map((panel) => panel.id));
  const invalid = panelIds.filter((id) => !known.has(id));
  if (invalid.length) throw new Error(`未知空气质量 Panel：${invalid.join(', ')}。`);
  airQualityState.highlightedPanelIds = [...new Set(panelIds)];
  setAction(`已高亮 ${airQualityState.highlightedPanelIds.length} 个空气质量 Panel`);
}

export function airQualityPanelContext(panelId: string) {
  const panel = airQualityState.config.panels.find((item) => item.id === panelId);
  if (!panel) throw new Error(`未知空气质量 Panel：${panelId}。`);
  return { panel, query: queryForAirPanel(panel), result: resultForAirPanel(panel) };
}

export function airQualityDashboardContext() {
  return {
    dashboard: airQualityState.config,
    filters: airQualityState.filters,
    panels: airQualityState.config.panels.map((panel) => ({ id: panel.id, title: panel.title, type: panel.type, query: queryForAirPanel(panel) })),
    dataset: airQualityState.dataset,
    lastAction: airQualityState.lastAction
  };
}
