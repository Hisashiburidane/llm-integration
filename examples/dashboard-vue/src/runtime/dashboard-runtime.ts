import { reactive, toRaw } from 'vue';
import { queryDashboardBatch } from '../query/client';
import type { DashboardConfig, DatasetDefinition, FacetOption, FilterOperator, PanelConfig, QueryResult, QuerySpec, Scalar } from '../model/types';

export interface DashboardFilterDefinition {
  id: string;
  label?: string;
  dimensionId: string;
  operator: FilterOperator;
  defaultValue?: Scalar | Scalar[];
  allValue?: Scalar;
  facetKey?: string;
  type?: 'range' | 'date' | 'select';
  min?: number;
  max?: number;
  options?: Array<{ value: Scalar; label: string }>;
}

export interface DashboardRuntimeState<TFilters extends Record<string, unknown>> {
  config: DashboardConfig;
  panelLibrary: PanelConfig[];
  panelTemplates: PanelConfig[];
  dataset: DatasetDefinition;
  sourceManifest: Record<string, unknown>;
  assistantPrompt: string;
  suggestions: string[];
  facets: Record<string, FacetOption[] | string[]>;
  filterDefinitions: DashboardFilterDefinition[];
  filters: TFilters;
  panelResults: Map<string, QueryResult>;
  dataLoading: boolean;
  dataError: string;
  highlightedPanelIds: string[];
  lastAction: string;
}

export interface DashboardRuntimeOptions<TFilters extends Record<string, unknown>> {
  configUrl: string;
  initialConfig: DashboardConfig;
  initialDataset: DatasetDefinition;
  initialFilters?: TFilters;
  filterDefinitions?: DashboardFilterDefinition[];
  buildQuery?: (panel: PanelConfig, filters: TFilters) => QuerySpec;
}

export interface DashboardRuntime<TFilters extends Record<string, unknown>> {
  state: DashboardRuntimeState<TFilters>;
  queryForPanel: (panel: PanelConfig) => QuerySpec;
  resultForPanel: (panel: PanelConfig) => QueryResult;
  loadConfig: () => Promise<void>;
  refreshData: () => Promise<void>;
  highlightPanels: (panelIds: string[]) => void;
  setFilter: (id: string, value: Scalar | Scalar[]) => void;
  setAction: (message: string) => void;
}

function clone<T>(value: T): T {
  return structuredClone(toRaw(value));
}

function normalizePanel(panel: PanelConfig): PanelConfig {
  const query = panel.query ?? {};
  return {
    ...panel,
    query: {
      ...query,
      metrics: Array.isArray(query.metrics) ? query.metrics : [],
      dimensions: Array.isArray(query.dimensions) ? query.dimensions : [],
      filters: Array.isArray(query.filters) ? query.filters : []
    }
  };
}

export function createDashboardRuntime<TFilters extends Record<string, unknown>>(options: DashboardRuntimeOptions<TFilters>): DashboardRuntime<TFilters> {
  const state = reactive({
    config: clone(options.initialConfig),
    panelLibrary: [],
    panelTemplates: [],
    dataset: clone(options.initialDataset),
    sourceManifest: {},
    assistantPrompt: '',
    suggestions: [],
    facets: {},
    filterDefinitions: options.filterDefinitions ?? [],
    filters: clone(options.initialFilters ?? {} as TFilters),
    panelResults: new Map(),
    dataLoading: false,
    dataError: '',
    highlightedPanelIds: [],
    lastAction: '页面已加载'
  }) as unknown as DashboardRuntimeState<TFilters>;

  let refreshSequence = 0;

  function setAction(message: string) {
    state.lastAction = message;
  }

  function queryForPanel(panel: PanelConfig): QuerySpec {
    if (options.buildQuery) return options.buildQuery(panel, state.filters as TFilters);
    const filterValues = state.filters as Record<string, unknown>;
    const dimensions = new Set(state.filterDefinitions.map((definition) => definition.dimensionId));
    const filters = panel.query.filters.filter((item) => !dimensions.has(item.dimensionId));
    state.filterDefinitions.forEach((definition) => {
      const value = filterValues[definition.id];
      if (value === undefined || (definition.allValue !== undefined && value === definition.allValue)) return;
      filters.push({ dimensionId: definition.dimensionId, operator: definition.operator, value: value as Scalar | Scalar[] });
    });
    return { ...panel.query, filters };
  }

  function resultForPanel(panel: PanelConfig): QueryResult {
    return state.panelResults.get(panel.id) ?? {
      columns: [],
      rows: [],
      loading: state.dataLoading,
      error: state.dataLoading ? undefined : (state.dataError || '数据尚未加载。'),
      summary: { rowCount: 0, source: `SQLite ${state.dataset.sourceLabel}`, query: queryForPanel(panel) }
    };
  }

  async function loadConfig() {
    state.dataLoading = true;
    state.dataError = '';
    try {
      const response = await fetch(options.configUrl);
      const payload = await response.json() as {
        id: string; topicId: string; title: string; description: string; sourceManifest?: Record<string, unknown>;
        dataset: DatasetDefinition; panels: PanelConfig[]; panelTemplates: PanelConfig[]; panelLibrary: PanelConfig[];
        facets?: Record<string, FacetOption[] | string[]>; assistantPrompt?: string; suggestions?: string[]; error?: string;
        filterDefinitions?: DashboardFilterDefinition[];
      };
      if (!response.ok || payload.error) throw new Error(payload.error || `Dashboard 配置请求失败（${response.status}）。`);
      state.config = { id: payload.id, topicId: payload.topicId, title: payload.title, description: payload.description, panels: (payload.panels ?? []).map(normalizePanel) };
      state.panelLibrary = (payload.panelLibrary ?? []).map(normalizePanel);
      state.panelTemplates = (payload.panelTemplates ?? []).map(normalizePanel);
      state.dataset = payload.dataset;
      state.sourceManifest = payload.sourceManifest ?? {};
      state.assistantPrompt = payload.assistantPrompt ?? '';
      state.suggestions = payload.suggestions ?? [];
      state.facets = payload.facets ?? {};
      state.filterDefinitions = payload.filterDefinitions ?? state.filterDefinitions;
      state.filterDefinitions.forEach((definition) => {
        const filterValues = state.filters as Record<string, unknown>;
        if (filterValues[definition.id] === undefined && definition.defaultValue !== undefined) filterValues[definition.id] = clone(definition.defaultValue);
      });
      await refreshData();
    } catch (error) {
      state.dataError = error instanceof Error ? error.message : 'Dashboard 配置加载失败。';
    } finally {
      state.dataLoading = false;
    }
  }

  async function refreshData() {
    const panels = state.config.panels.map(clone);
    const sequence = ++refreshSequence;
    state.dataLoading = true;
    state.panelResults.clear();
    const queries = panels.map(queryForPanel);
    try {
      const results = await queryDashboardBatch(queries);
      if (sequence !== refreshSequence) return;
      panels.forEach((panel, index) => state.panelResults.set(panel.id, results[index] ?? {
        columns: [], rows: [], error: '查询没有返回结果。', summary: { rowCount: 0, source: `SQLite ${state.dataset.sourceLabel}`, query: queries[index] }
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '查询执行失败。';
      panels.forEach((panel, index) => state.panelResults.set(panel.id, {
        columns: [], rows: [], error: message, summary: { rowCount: 0, source: `SQLite ${state.dataset.sourceLabel}`, query: queries[index] }
      }));
    } finally {
      if (sequence === refreshSequence) state.dataLoading = false;
    }
  }

  function highlightPanels(panelIds: string[]) {
    const known = new Set(state.config.panels.map((panel) => panel.id));
    const invalid = panelIds.filter((id) => !known.has(id));
    if (invalid.length) throw new Error(`未知 Panel：${invalid.join(', ')}。`);
    state.highlightedPanelIds = [...new Set(panelIds)];
    setAction(state.highlightedPanelIds.length ? `已高亮 ${state.highlightedPanelIds.length} 个 Panel` : '已清除 Panel 高亮');
  }

  function setFilter(id: string, value: Scalar | Scalar[]) {
    if (!state.filterDefinitions.some((definition) => definition.id === id)) throw new Error(`未知 Dashboard 筛选：${id}。`);
    (state.filters as Record<string, unknown>)[id] = value;
    setAction(`已更新筛选：${id}`);
  }

  return { state, queryForPanel, resultForPanel, loadConfig, refreshData, highlightPanels, setFilter, setAction };
}
