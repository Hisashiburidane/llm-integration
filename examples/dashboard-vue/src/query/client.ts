import type { QueryResult, QuerySpec } from '../model/types';

export async function queryDashboard(query: QuerySpec): Promise<QueryResult> {
  const response = await fetch('/api/dashboard/query', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(query)
  });
  const payload = await response.json() as QueryResult & { error?: string };
  if (!response.ok || payload.error) throw new Error(payload.error || `数据服务请求失败（${response.status}）。`);
  return payload;
}

export async function queryDashboardBatch(queries: QuerySpec[]): Promise<QueryResult[]> {
  const response = await fetch('/api/dashboard/query-batch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ queries })
  });
  const payload = await response.json() as { results?: QueryResult[]; error?: string };
  if (!response.ok || payload.error || !payload.results) throw new Error(payload.error || `数据服务请求失败（${response.status}）。`);
  return payload.results;
}
