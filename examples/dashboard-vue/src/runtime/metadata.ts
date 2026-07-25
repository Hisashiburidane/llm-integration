import type { EnchantMetadataNode } from '@enchantforge/vue';
import type { DashboardConfig, PanelConfig } from '../model/types';

export function dashboardMetadata(config: DashboardConfig): EnchantMetadataNode[] {
  return [{
    id: 'aviation-dashboard-region',
    scopeId: config.id,
    kind: 'region',
    label: config.title,
    description: config.description,
    visible: true,
    enabled: true,
    source: 'registered',
    children: config.panels.map((panel) => ({
      id: panel.id,
      scopeId: panel.id,
      kind: 'panel',
      label: panel.title,
      description: panel.description,
      visible: true,
      enabled: true,
      source: 'registered',
      children: [{
        id: `${panel.id}:chart`,
        scopeId: panel.id,
        kind: panel.type,
        label: panel.title,
        description: `数据集：${panel.query.datasetId}；指标：${panel.query.metrics.map((metric) => metric.metricId).join(', ')}`,
        visible: true,
        enabled: true,
        source: 'registered'
      }]
    } as EnchantMetadataNode))
  }];
}

export function panelMetadata(panel: PanelConfig): EnchantMetadataNode[] {
  return [{
    id: `${panel.id}:semantic`,
    scopeId: panel.id,
    kind: panel.type,
    label: panel.title,
    description: panel.description,
    visible: true,
    enabled: true,
    source: 'registered',
    value: {
      datasetId: panel.query.datasetId,
      metrics: panel.query.metrics.map((metric) => metric.metricId),
      dimensions: panel.query.dimensions.map((dimension) => dimension.dimensionId),
      capabilityScope: panel.id
    }
  } as EnchantMetadataNode];
}
