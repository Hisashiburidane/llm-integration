import type { DatasetDefinition } from '../model/types';
import type { DashboardFilterDefinition } from '../runtime/dashboard-runtime';

export interface QuerySourceDefinition {
  datasetId: string;
  metricIds: string[];
}

export interface DataSourceDefinition {
  id: string;
  title: string;
  sources: Array<{ id: string; table: string }>;
  metricIds: string[];
  dimensionIds: string[];
}

export interface DataDomainMetadata {
  aliases: string[];
  keywords: string[];
  useCases: string[];
  exampleRequests: string[];
}

export interface DataDomain {
  id: string;
  topicId: string;
  title: string;
  description: string;
  metadata: DataDomainMetadata;
  datasetIds: string[];
  sourceManifest: Record<string, unknown>;
  dataset: DatasetDefinition;
  querySources: QuerySourceDefinition[];
  filterDefinitions: DashboardFilterDefinition[];
  dataSources: DataSourceDefinition[];
}

interface DataDomainSummary {
  id: string;
  topicId: string;
  title: string;
  description: string;
  metadata: DataDomainMetadata;
  datasetIds: string[];
}

async function readJson<T>(response: Response, fallback: string) {
  const payload = await response.json() as T & { error?: string };
  if (!response.ok || payload.error) throw new Error(payload.error || `${fallback}（${response.status}）。`);
  return payload;
}

export async function fetchDataDomains(): Promise<DataDomain[]> {
  const listResponse = await fetch('/api/data-domains');
  const list = await readJson<{ domains?: DataDomainSummary[] }>(listResponse, '数据域列表加载失败');
  return Promise.all((list.domains ?? []).map(async ({ id }) => {
    const response = await fetch(`/api/data-domains/${encodeURIComponent(id)}`);
    const payload = await readJson<{ domain?: DataDomain }>(response, `数据域 ${id} 加载失败`);
    if (!payload.domain) throw new Error(`数据域 ${id} 响应无效。`);
    return payload.domain;
  }));
}
