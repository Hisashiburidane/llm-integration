import { createDashboardRuntime } from './dashboard-runtime';
import type { DashboardConfig, DatasetDefinition, PanelConfig, QuerySpec } from '../model/types';

export interface AirQualityFilters extends Record<string, unknown> {
  startDate: string;
  endDate: string;
  station: string;
}

const initialConfig: DashboardConfig = {
  id: 'air-quality-operations',
  topicId: 'air-quality',
  title: 'Beijing Air Quality / Pollution Monitoring',
  description: '基于北京多站点小时观测数据的污染物与气象条件分析。',
  panels: []
};

const initialDataset: DatasetDefinition = {
  id: 'beijing_air_quality_demo',
  name: 'Beijing multi-site air quality',
  description: '北京多站点小时空气质量和气象观测的日级聚合。',
  sourceLabel: 'air_quality_dashboard_rollup',
  entities: [],
  dimensions: [],
  metrics: [],
  relations: []
};

export const airQualityRuntime = createDashboardRuntime<AirQualityFilters>({
  configUrl: '/api/dashboard/config?dashboard=air-quality-operations',
  initialConfig,
  initialDataset,
  initialFilters: { startDate: '2016-01-01', endDate: '2017-02-28', station: 'ALL' },
  buildQuery(panel: PanelConfig, filters: AirQualityFilters): QuerySpec {
    const queryFilters = panel.query.filters.filter((item) => item.dimensionId !== 'date' && item.dimensionId !== 'station');
    queryFilters.push({ dimensionId: 'date', operator: 'between', value: [filters.startDate, filters.endDate] });
    if (filters.station !== 'ALL') queryFilters.push({ dimensionId: 'station', operator: 'eq', value: filters.station });
    return { ...panel.query, filters: queryFilters };
  }
});

export const airQualityState = airQualityRuntime.state;

export function queryForAirPanel(panel: PanelConfig) {
  return airQualityRuntime.queryForPanel(panel);
}

export function resultForAirPanel(panel: PanelConfig) {
  return airQualityRuntime.resultForPanel(panel);
}

export function loadAirQualityConfig() {
  return airQualityRuntime.loadConfig();
}

export function refreshAirQualityData() {
  return airQualityRuntime.refreshData();
}

export function setAirQualityFilters(filters: Partial<AirQualityFilters>) {
  if (filters.startDate) airQualityState.filters.startDate = filters.startDate;
  if (filters.endDate) airQualityState.filters.endDate = filters.endDate;
  if (filters.station) airQualityState.filters.station = filters.station;
  airQualityRuntime.setAction(`已更新空气质量筛选：${airQualityState.filters.startDate} 至 ${airQualityState.filters.endDate}`);
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
