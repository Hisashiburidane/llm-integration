import type { EnchantMetadataNode } from '@enchantforge/vue';
import type { DashboardConfig, PanelConfig } from '../model/types';

export function airQualityDashboardMetadata(config: DashboardConfig): EnchantMetadataNode[] {
  return [{
    id: 'air-quality-dashboard-region',
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
      source: 'registered'
    }))
  }];
}

export function airQualityPanelMetadata(panel: PanelConfig): EnchantMetadataNode[] {
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
