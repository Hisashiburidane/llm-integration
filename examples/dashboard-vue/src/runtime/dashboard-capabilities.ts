import type { EnchantCapabilityDefinition } from '@enchantforge/vue';
import type { DashboardRuntime } from './dashboard-runtime';

export function createDashboardCapabilities(runtime: DashboardRuntime<Record<string, unknown>>): EnchantCapabilityDefinition[] {
  const { state } = runtime;
  return [
    {
      id: `${state.config.id}:read-context`, owner: 'application', provider: 'dashboard-runtime', name: 'dashboard.read_context', label: '读取 Dashboard 上下文',
      description: '读取当前 Dashboard、筛选、Panel 和数据集定义。', effect: 'read', execute: () => ({ status: 'success', data: dashboardContext(runtime) })
    },
    {
      id: `${state.config.id}:read-data`, owner: 'application', provider: 'dashboard-runtime', name: 'dashboard.read_data', label: '读取 Dashboard 数据',
      description: '读取指定 Panel 的真实查询结果，用于回答数据问题。', effect: 'read',
      inputSchema: { type: 'object', required: ['panelIds'], properties: { panelIds: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'string' } } } },
      execute(input) {
        const panelIds = input && typeof input === 'object' && Array.isArray((input as { panelIds?: unknown }).panelIds) ? (input as { panelIds: unknown[] }).panelIds.map(String) : [];
        if (!panelIds.length) throw new Error('panelIds 不能为空。');
        return { status: 'success', data: { panels: [...new Set(panelIds)].map((panelId) => panelContext(runtime, panelId)) } };
      }
    },
    {
      id: `${state.config.id}:set-filter`, owner: 'application', provider: 'dashboard-runtime', name: 'dashboard.set_filter', label: '修改 Dashboard 筛选',
      description: '使用服务端声明的筛选定义修改当前 Dashboard 查询。', effect: 'visual',
      inputSchema: { type: 'object', required: ['id', 'value'], properties: { id: { type: 'string' }, value: {} } },
      execute(input) {
        const value = input && typeof input === 'object' ? input as { id?: string; value?: unknown } : {};
        if (!value.id || value.value === undefined || (typeof value.value !== 'string' && typeof value.value !== 'number' && typeof value.value !== 'boolean' && !Array.isArray(value.value))) throw new Error('筛选 id/value 无效。');
        runtime.setFilter(value.id, value.value as string | number | boolean | Array<string | number | boolean>);
        return { status: 'success', summary: `已更新筛选：${value.id}。` };
      }
    },
    {
      id: `${state.config.id}:highlight`, owner: 'application', provider: 'dashboard-runtime', name: 'dashboard.highlight', label: '高亮 Dashboard Panel',
      description: '高亮当前 Dashboard 中已注册的 Panel。', effect: 'visual', inputSchema: { type: 'object', required: ['panelIds'], properties: { panelIds: { type: 'array', items: { type: 'string' } } } },
      execute(input) {
        const panelIds = input && typeof input === 'object' && Array.isArray((input as { panelIds?: unknown }).panelIds) ? (input as { panelIds: unknown[] }).panelIds.map(String) : [];
        if (!panelIds.length) throw new Error('panelIds 不能为空。');
        runtime.highlightPanels(panelIds);
        return { status: 'success', summary: `已高亮 ${panelIds.length} 个 Panel。` };
      }
    }
  ];
}

export function createPanelCapabilities(runtime: DashboardRuntime<Record<string, unknown>>, panelId: string): EnchantCapabilityDefinition[] {
  return [
    { id: `${panelId}:read-data`, owner: 'application', provider: 'dashboard-runtime', name: 'panel.read_data', label: '读取 Panel 数据', description: '读取当前 Panel 的真实结果。', effect: 'read', execute: () => ({ status: 'success', data: panelContext(runtime, panelId) }) },
    { id: `${panelId}:highlight`, owner: 'application', provider: 'dashboard-runtime', name: 'panel.highlight', label: '高亮当前 Panel', description: '将当前 Panel 标记为分析重点。', effect: 'visual', execute: () => { runtime.highlightPanels([panelId]); return { status: 'success', summary: `已高亮 Panel：${panelId}。` }; } }
  ];
}

export function panelContext(runtime: DashboardRuntime<Record<string, unknown>>, panelId: string) {
  const panel = runtime.state.config.panels.find((item) => item.id === panelId);
  if (!panel) throw new Error(`未知 Panel：${panelId}。`);
  return { panel, query: runtime.queryForPanel(panel), result: runtime.resultForPanel(panel) };
}

export function dashboardContext(runtime: DashboardRuntime<Record<string, unknown>>) {
  return {
    dashboard: runtime.state.config,
    filters: runtime.state.filters,
    filterDefinitions: runtime.state.filterDefinitions,
    panels: runtime.state.config.panels.map((panel) => ({ id: panel.id, title: panel.title, type: panel.type, query: runtime.queryForPanel(panel) })),
    dataset: runtime.state.dataset,
    lastAction: runtime.state.lastAction
  };
}
