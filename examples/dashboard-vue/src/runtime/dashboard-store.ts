import { reactive, toRaw } from 'vue';
import { aviationDataset, aviationPanelTemplates, defaultAviationPanels } from '../data/aviation';
import { runQuery } from '../query/engine';
import type { DashboardConfig, DashboardFilters, DashboardView, PanelConfig, QueryResult, QuerySpec } from '../model/types';

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
    description: '固定航班运行演示数据上的可寻址、可联动 Dashboard。',
    panels: defaultAviationPanels.map((panel) => clone(panel))
  },
  filters: clone(defaultFilters),
  highlightedPanelIds: [],
  selectedPanelId: '',
  selectedAirport: '',
  savedViews: [],
  lastAction: '页面已加载'
});

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
  return runQuery(queryForPanel(panel));
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
  if (!['JFK', 'LGA', 'EWR'].includes(airport)) throw new Error(`未知机场：${airport}。`);
  dashboardState.selectedAirport = airport;
  setGlobalFilter('airport', airport);
  highlightPanels(['airport-status', 'airport-ranking', 'hourly-on-time']);
}

export function addPanel(templateId: string) {
  const template = aviationPanelTemplates.find((panel) => panel.id === templateId);
  if (!template) throw new Error(`未知 Panel 模板：${templateId}。`);
  const count = dashboardState.config.panels.filter((panel) => panel.id.startsWith(template.id)).length;
  const panel = clone(template);
  panel.id = `${template.id}-${count + 1}`;
  panel.title = `${template.title} / AI ${count + 1}`;
  dashboardState.config.panels.push(panel);
  setAction(`已添加 Panel：${panel.title}`);
  return panel.id;
}

export function resetDashboard() {
  dashboardState.filters = clone(defaultFilters);
  dashboardState.config.panels = defaultAviationPanels.map((panel) => clone(panel));
  dashboardState.highlightedPanelIds = [];
  dashboardState.selectedPanelId = '';
  dashboardState.selectedAirport = '';
  setAction('已恢复默认 Dashboard');
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
  return {
    panelId: panel.id,
    title: panel.title,
    description: panel.description,
    type: panel.type,
    datasetId: aviationDataset.id,
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
    highlightedPanelIds: dashboardState.highlightedPanelIds,
    selectedAirport: dashboardState.selectedAirport,
    lastAction: dashboardState.lastAction
  };
}
