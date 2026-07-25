import type { EnchantCapabilityDefinition } from '@enchantforge/vue';
import {
  airQualityDashboardContext,
  airQualityPanelContext,
  airQualityRuntime,
  airQualityState,
  setAirQualityFilters
} from './air-quality-runtime';

const panelCapabilityCache = new Map<string, EnchantCapabilityDefinition[]>();

export const airQualityCapabilities: EnchantCapabilityDefinition[] = [
  {
    id: 'air-quality:dashboard:read-context', owner: 'application', provider: 'air-quality-dashboard', name: 'dashboard.read_context', label: '读取空气质量上下文',
    description: '读取当前日期范围、监测站筛选、Panel 列表和数据集定义。', effect: 'read', execute: () => ({ status: 'success', data: airQualityDashboardContext() })
  },
  {
    id: 'air-quality:dashboard:read-data', owner: 'application', provider: 'air-quality-dashboard', name: 'dashboard.read_data', label: '读取空气质量数据',
    description: '读取指定 Panel 的真实 SQLite 聚合结果，用于回答污染物和监测站问题。', effect: 'read',
    inputSchema: { type: 'object', required: ['panelIds'], properties: { panelIds: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string' } } } },
    execute(input) {
      const panelIds = input && typeof input === 'object' && Array.isArray((input as { panelIds?: unknown }).panelIds) ? (input as { panelIds: unknown[] }).panelIds.map(String) : [];
      if (!panelIds.length) throw new Error('panelIds 不能为空。');
      return { status: 'success', data: { panels: [...new Set(panelIds)].map(airQualityPanelContext) } };
    }
  },
  {
    id: 'air-quality:dashboard:set-filter', owner: 'application', provider: 'air-quality-dashboard', name: 'dashboard.set_filter', label: '修改空气质量筛选',
    description: '修改日期范围或监测站，随后重新读取数据。', effect: 'visual',
    inputSchema: { type: 'object', properties: { startDate: { type: 'string' }, endDate: { type: 'string' }, station: { type: 'string' } } },
    execute(input) {
      const value = input && typeof input === 'object' ? input as { startDate?: string; endDate?: string; station?: string } : {};
      setAirQualityFilters(value);
      return { status: 'success', summary: `已更新日期范围：${airQualityState.filters.startDate} 至 ${airQualityState.filters.endDate}。` };
    }
  },
  {
    id: 'air-quality:dashboard:highlight', owner: 'application', provider: 'air-quality-dashboard', name: 'dashboard.highlight', label: '高亮空气质量 Panel',
    description: '高亮当前 Dashboard 中已注册的空气质量 Panel。', effect: 'visual',
    inputSchema: { type: 'object', required: ['panelIds'], properties: { panelIds: { type: 'array', items: { type: 'string' } } } },
    execute(input) {
      const panelIds = input && typeof input === 'object' && Array.isArray((input as { panelIds?: unknown }).panelIds) ? (input as { panelIds: unknown[] }).panelIds.map(String) : [];
      if (!panelIds.length) throw new Error('panelIds 不能为空。');
      airQualityRuntime.highlightPanels(panelIds);
      return { status: 'success', summary: `已高亮 ${panelIds.length} 个空气质量 Panel。` };
    }
  }
];

export function airQualityPanelCapabilities(panelId: string) {
  const cached = panelCapabilityCache.get(panelId);
  if (cached) return cached;
  const capabilities: EnchantCapabilityDefinition[] = [
    { id: `${panelId}:read-data`, owner: 'application', provider: 'air-quality-dashboard', name: 'panel.read_data', label: '读取 Panel 数据', description: '读取当前 Panel 的真实聚合结果。', effect: 'read', execute: () => ({ status: 'success', data: airQualityPanelContext(panelId) }) },
    { id: `${panelId}:highlight`, owner: 'application', provider: 'air-quality-dashboard', name: 'panel.highlight', label: '高亮当前 Panel', description: '将当前 Panel 标记为分析重点。', effect: 'visual', execute: () => { airQualityRuntime.highlightPanels([panelId]); return { status: 'success', summary: `已高亮 Panel：${panelId}。` }; } }
  ];
  panelCapabilityCache.set(panelId, capabilities);
  return capabilities;
}
