import type { EnchantCapabilityDefinition } from '@enchantforge/vue';
import { aviationDataset, aviationPanelTemplates } from '../data/aviation';
import {
  addPanel,
  dashboardContext,
  dashboardState,
  highlightPanels,
  panelContext,
  resetDashboard,
  restoreView,
  saveView,
  selectAirport,
  setGlobalFilter,
  setTimeRange
} from './dashboard-store';

const panelCapabilityCache = new Map<string, EnchantCapabilityDefinition[]>();
const metricIds = aviationDataset.metrics.map((metric) => metric.id);

export const dashboardCapabilities: EnchantCapabilityDefinition[] = [
  {
    id: 'aviation:dashboard:read-context',
    owner: 'application',
    provider: 'aviation-dashboard',
    name: 'dashboard.read_context',
    label: '读取 Dashboard 上下文',
    description: '读取当前专题、全局筛选、Panel 列表和最近操作。',
    effect: 'read',
    execute: () => ({ status: 'success', data: dashboardContext() })
  },
  {
    id: 'aviation:dashboard:set-filter',
    owner: 'application',
    provider: 'aviation-dashboard',
    name: 'dashboard.set_filter',
    label: '修改 Dashboard 筛选',
    description: '修改机场、航空公司或航班方向筛选。',
    effect: 'visual',
    inputSchema: {
      type: 'object',
      required: ['field', 'value'],
      properties: {
        field: { type: 'string', enum: ['airport', 'carrier', 'direction'] },
        value: { type: 'string' }
      }
    },
    execute(input) {
      const value = input && typeof input === 'object' ? input as { field?: string; value?: string } : {};
      const field = value.field;
      const selected = value.value ?? '';
      if (field !== 'airport' && field !== 'carrier' && field !== 'direction') throw new Error('不支持的筛选字段。');
      if (field === 'airport') selectAirport(selected);
      else setGlobalFilter(field, selected);
      return { status: 'success', summary: `已更新 ${field} 筛选为 ${selected}。` };
    }
  },
  {
    id: 'aviation:dashboard:set-time-range',
    owner: 'application',
    provider: 'aviation-dashboard',
    name: 'dashboard.set_time_range',
    label: '修改调查时间范围',
    description: '将所有关联 Panel 的查询范围切换到指定小时。',
    effect: 'visual',
    inputSchema: {
      type: 'object',
      required: ['startHour', 'endHour'],
      properties: {
        startHour: { type: 'integer', minimum: 0, maximum: 23 },
        endHour: { type: 'integer', minimum: 0, maximum: 23 }
      }
    },
    execute(input) {
      const value = input && typeof input === 'object' ? input as { startHour?: number; endHour?: number } : {};
      setTimeRange(Number(value.startHour), Number(value.endHour));
      return { status: 'success', summary: `已切换到 ${value.startHour}:00-${value.endHour}:00。` };
    }
  },
  {
    id: 'aviation:dashboard:highlight',
    owner: 'application',
    provider: 'aviation-dashboard',
    name: 'dashboard.highlight',
    label: '高亮 Dashboard Panel',
    description: '高亮当前 Dashboard 中已注册的 Panel。',
    effect: 'visual',
    inputSchema: {
      type: 'object',
      required: ['panelIds'],
      properties: { panelIds: { type: 'array', items: { type: 'string' } } }
    },
    execute(input) {
      const panelIds = input && typeof input === 'object' && Array.isArray((input as { panelIds?: unknown }).panelIds)
        ? (input as { panelIds: unknown[] }).panelIds.map(String)
        : [];
      if (!panelIds.length) throw new Error('panelIds 不能为空。');
      highlightPanels(panelIds);
      return { status: 'success', summary: `已高亮 ${panelIds.length} 个 Panel。` };
    }
  },
  {
    id: 'aviation:dashboard:add-panel',
    owner: 'application',
    provider: 'aviation-dashboard',
    name: 'dashboard.add_panel',
    label: '添加分析 Panel',
    description: '从受约束的模板列表中添加 Panel，不接受任意组件代码。',
    effect: 'visual',
    inputSchema: {
      type: 'object',
      required: ['templateId'],
      properties: { templateId: { type: 'string', enum: aviationPanelTemplates.map((panel) => panel.id) } }
    },
    execute(input) {
      const templateId = input && typeof input === 'object' ? String((input as { templateId?: unknown }).templateId ?? '') : '';
      const panelId = addPanel(templateId);
      return { status: 'success', summary: `已添加 Panel：${panelId}。`, data: { panelId } };
    }
  },
  {
    id: 'aviation:dashboard:save-view',
    owner: 'application',
    provider: 'aviation-dashboard',
    name: 'dashboard.save_view',
    label: '保存调查视图',
    description: '保存当前筛选和 Panel 配置，便于恢复调查上下文。',
    effect: 'draft',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', minLength: 1, maxLength: 60 } }
    },
    execute(input) {
      const name = input && typeof input === 'object' ? String((input as { name?: unknown }).name ?? '') : '';
      const view = saveView(name || undefined);
      return { status: 'success', summary: `已保存视图：${view.name}。`, data: { viewId: view.id } };
    }
  },
  {
    id: 'aviation:dashboard:restore-view',
    owner: 'application',
    provider: 'aviation-dashboard',
    name: 'dashboard.restore_view',
    label: '恢复调查视图',
    description: '恢复最近保存的调查视图。',
    effect: 'visual',
    execute(input) {
      const viewId = input && typeof input === 'object' ? String((input as { viewId?: unknown }).viewId ?? '') : undefined;
      restoreView(viewId || undefined);
      return { status: 'success', summary: '已恢复调查视图。' };
    }
  },
  {
    id: 'aviation:dashboard:reset',
    owner: 'application',
    provider: 'aviation-dashboard',
    name: 'dashboard.reset',
    label: '恢复默认 Dashboard',
    description: '清除当前筛选并恢复默认 Panel 配置。',
    effect: 'visual',
    execute: () => {
      resetDashboard();
      return { status: 'success', summary: '已恢复默认 Dashboard。' };
    }
  }
];

export function panelCapabilities(panelId: string) {
  const cached = panelCapabilityCache.get(panelId);
  if (cached) return cached;
  const capabilities: EnchantCapabilityDefinition[] = [
    {
      id: `${panelId}:read-data`,
      owner: 'application',
      provider: 'aviation-dashboard',
      name: 'panel.read_data',
      label: '读取 Panel 数据',
      description: '读取当前 Panel 的查询、筛选条件和结果摘要，用于可追溯分析。',
      effect: 'read',
      execute: () => ({ status: 'success', data: panelContext(panelId) })
    },
    {
      id: `${panelId}:highlight`,
      owner: 'application',
      provider: 'aviation-dashboard',
      name: 'panel.highlight',
      label: '高亮当前 Panel',
      description: '将当前 Panel 标记为分析重点。',
      effect: 'visual',
      execute: () => {
        highlightPanels([panelId]);
        return { status: 'success', summary: `已高亮 Panel：${panelId}。` };
      }
    },
    {
      id: `${panelId}:read-contract`,
      owner: 'application',
      provider: 'aviation-dashboard',
      name: 'panel.read_contract',
      label: '读取 Panel 合约',
      description: '读取当前 Panel 的类型、指标和维度定义。',
      effect: 'read',
      execute: () => ({ status: 'success', data: panelContext(panelId) })
    }
  ];
  if (panelId === 'hourly-on-time') {
    capabilities.push({
      id: `${panelId}:set-time-range`,
      owner: 'application',
      provider: 'aviation-dashboard',
      name: 'panel.set_time_range',
      label: '缩放趋势时间范围',
      description: '修改所有关联 Panel 的小时范围。',
      effect: 'visual',
      inputSchema: { type: 'object', required: ['startHour', 'endHour'], properties: { startHour: { type: 'integer' }, endHour: { type: 'integer' } } },
      execute(input) {
        const value = input && typeof input === 'object' ? input as { startHour?: number; endHour?: number } : {};
        setTimeRange(Number(value.startHour), Number(value.endHour));
        return { status: 'success', summary: '已缩放趋势时间范围。' };
      }
    });
  }
  if (panelId === 'airport-status') {
    capabilities.push({
      id: `${panelId}:select-airport`,
      owner: 'application',
      provider: 'aviation-dashboard',
      name: 'panel.select_airport',
      label: '选择机场',
      description: '选择机场并联动所有关联 Panel。',
      effect: 'visual',
      inputSchema: { type: 'object', required: ['airport'], properties: { airport: { type: 'string', enum: ['JFK', 'LGA', 'EWR'] } } },
      execute(input) {
        const airport = input && typeof input === 'object' ? String((input as { airport?: unknown }).airport ?? '') : '';
        selectAirport(airport);
        return { status: 'success', summary: `已选择机场：${airport}。` };
      }
    });
  }
  panelCapabilityCache.set(panelId, capabilities);
  return capabilities;
}

export function clearPanelCapabilityCache() {
  panelCapabilityCache.clear();
}

export function activePanelCount() {
  return dashboardState.config.panels.length;
}

export const availableMetricIds = metricIds;
