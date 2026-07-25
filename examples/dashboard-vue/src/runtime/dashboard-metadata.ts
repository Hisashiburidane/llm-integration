import type { EnchantMetadataNode } from '@enchantforge/vue';
import type { DashboardConfig, PanelConfig } from '../model/types';

export function dashboardMetadata(config: DashboardConfig): EnchantMetadataNode[] {
  return [{
    id: `${config.id}:region`, scopeId: config.id, kind: 'region', label: config.title, description: config.description,
    visible: true, enabled: true, source: 'registered', children: config.panels.map((panel) => panelMetadataNode(panel))
  }];
}

function panelMetadataNode(panel: PanelConfig): EnchantMetadataNode {
  return { id: panel.id, scopeId: panel.id, kind: 'panel', label: panel.title, description: panel.description, visible: true, enabled: true, source: 'registered', value: { datasetId: panel.query.datasetId, metrics: panel.query.metrics.map((metric) => metric.metricId), dimensions: panel.query.dimensions.map((dimension) => dimension.dimensionId) } } as EnchantMetadataNode;
}

export function panelMetadata(panel: PanelConfig): EnchantMetadataNode[] { return [panelMetadataNode(panel)]; }
