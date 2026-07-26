import type { EnchantMetadataNode } from '@enchantforge/vue';
import type { DashboardConfig, DashboardEvidenceGroup, PanelConfig } from '../model/types';

export function dashboardMetadata(config: DashboardConfig, evidenceGroups: DashboardEvidenceGroup[] = []): EnchantMetadataNode[] {
  return [{
    id: `${config.id}:region`, scopeId: config.id, kind: 'region', label: config.title, description: config.description,
    visible: true, enabled: true, source: 'registered',
    children: [
      ...evidenceGroups.map((group) => ({
        id: `${config.id}:evidence:${group.id}`,
        scopeId: config.id,
        kind: 'evidence-group',
        label: group.label,
        description: group.description,
        visible: true,
        enabled: true,
        source: 'registered' as const,
        value: { panelIds: group.panelIds, questions: group.questions },
        children: group.panelIds.map((panelId) => {
          const panel = config.panels.find((item) => item.id === panelId);
          return {
            id: panelId,
            scopeId: config.id,
            kind: 'panel-reference',
            label: panel?.title ?? panelId,
            visible: true,
            enabled: true,
            source: 'registered' as const
          };
        })
      })),
      ...config.panels.map((panel) => panelMetadataNode(panel))
    ]
  }];
}

function panelMetadataNode(panel: PanelConfig): EnchantMetadataNode {
  return { id: panel.id, scopeId: panel.id, kind: 'panel', label: panel.title, description: panel.description, visible: true, enabled: true, source: 'registered', value: { datasetId: panel.query.datasetId, metrics: panel.query.metrics.map((metric) => metric.metricId), dimensions: panel.query.dimensions.map((dimension) => dimension.dimensionId) } } as EnchantMetadataNode;
}

export function panelMetadata(panel: PanelConfig): EnchantMetadataNode[] { return [panelMetadataNode(panel)]; }
