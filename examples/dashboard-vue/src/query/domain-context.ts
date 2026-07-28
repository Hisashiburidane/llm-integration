import type { PanelConfig } from '../model/types';
import type { DataDomain, QuerySourceDefinition } from './domains';

function line(label: string, values: string[]) {
  return `${label}：${values.join('、')}`;
}

export function describeDataDomain(domain: DataDomain) {
  return [
    `${domain.id}: ${domain.title}`,
    `说明：${domain.description}`,
    line('别名', domain.metadata.aliases),
    line('关键词', domain.metadata.keywords),
    line('适用分析', domain.metadata.useCases),
    line('示例需求', domain.metadata.exampleRequests)
  ].join('\n');
}

export function querySourceForMetrics(domain: DataDomain, metricIds: string[]): QuerySourceDefinition | undefined {
  return domain.querySources.find((source) => metricIds.every((metricId) => source.metricIds.includes(metricId)));
}

export function panelsForDataDomain(panels: PanelConfig[], domain: DataDomain | undefined) {
  if (!domain) return [];
  const datasetIds = new Set(domain.datasetIds);
  return panels.filter((panel) => datasetIds.has(panel.query.datasetId));
}
