import { aviationDataset, aviationFlights, metricById } from '../data/aviation';
import type { DatasetDefinition, FilterCondition, FlightRecord, QueryResult, QuerySpec, Scalar } from '../model/types';

const dimensionById = new Map(aviationDataset.dimensions.map((dimension) => [dimension.id, dimension]));

function valueFor(record: FlightRecord, dimensionId: string): Scalar {
  const dimension = dimensionById.get(dimensionId);
  if (!dimension) throw new Error(`未知维度：${dimensionId}。`);
  return record[dimension.field] as Scalar;
}

function matchesFilter(record: FlightRecord, filter: FilterCondition) {
  const value = valueFor(record, filter.dimensionId);
  const expected = filter.value;
  switch (filter.operator) {
    case 'eq': return value === expected;
    case 'neq': return value !== expected;
    case 'in': return Array.isArray(expected) && expected.includes(value);
    case 'gte': return typeof value === 'number' && typeof expected === 'number' && value >= expected;
    case 'lte': return typeof value === 'number' && typeof expected === 'number' && value <= expected;
    case 'between': return Array.isArray(expected) && expected.length === 2 && typeof value === 'number' && typeof expected[0] === 'number' && typeof expected[1] === 'number' && value >= expected[0] && value <= expected[1];
    default: return false;
  }
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

function metricValue(metricId: string, records: FlightRecord[]): number {
  const values = records.map((record) => record.depDelay);
  switch (metricId) {
    case 'flightCount': return records.length;
    case 'onTimeRate': return records.length ? records.filter((record) => record.depDelay <= 15).length / records.length : 0;
    case 'averageDepartureDelay': return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    case 'p95DepartureDelay': return percentile(values, .95);
    case 'cancellationRate': return records.length ? records.filter((record) => record.cancelled).length / records.length : 0;
    case 'severeDelayCount': return records.filter((record) => record.depDelay >= 60).length;
    case 'delayMinutes': return records.reduce((sum, record) => sum + record.delayMinutes, 0);
    default: throw new Error(`未知指标：${metricId}。`);
  }
}

export function validateQuery(query: QuerySpec, dataset: DatasetDefinition = aviationDataset) {
  if (query.datasetId !== dataset.id) throw new Error(`不支持的数据集：${query.datasetId}。`);
  if (!query.metrics.length) throw new Error('QuerySpec 至少需要一个指标。');
  const dimensions = query.dimensions.map((item) => {
    const definition = dataset.dimensions.find((dimension) => dimension.id === item.dimensionId);
    if (!definition) throw new Error(`未知维度：${item.dimensionId}。`);
    return definition;
  });
  query.metrics.forEach((item) => {
    const metric = dataset.metrics.find((definition) => definition.id === item.metricId);
    if (!metric) throw new Error(`未知指标：${item.metricId}。`);
    dimensions.forEach((dimension) => {
      if (!metric.supportedDimensions.includes(dimension.id)) throw new Error(`指标「${metric.label}」不支持维度「${dimension.label}」。`);
    });
  });
  query.filters.forEach((filter) => {
    if (!dataset.dimensions.some((dimension) => dimension.id === filter.dimensionId)) throw new Error(`过滤条件引用了未知维度：${filter.dimensionId}。`);
  });
  if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100)) throw new Error('QuerySpec limit 必须是 1 到 100 的整数。');
  if (query.timeRange && (query.timeRange.startHour < 0 || query.timeRange.endHour > 23 || query.timeRange.startHour > query.timeRange.endHour)) throw new Error('时间范围必须位于 0-23 小时之间。');
  return query;
}

export function runQuery(query: QuerySpec): QueryResult {
  validateQuery(query);
  const filtered = aviationFlights.filter((record) => {
    if (query.timeRange && (record.hour < query.timeRange.startHour || record.hour > query.timeRange.endHour)) return false;
    return query.filters.every((filter) => matchesFilter(record, filter));
  });
  const groups = new Map<string, FlightRecord[]>();
  const dimensions = query.dimensions.map((dimension) => dimension.dimensionId);
  filtered.forEach((record) => {
    const key = dimensions.map((dimension) => String(valueFor(record, dimension))).join('|') || '__all__';
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  });
  if (!groups.size) groups.set('__all__', []);

  const rows = Array.from(groups.entries()).map(([, records]) => {
    const row: Record<string, Scalar | null> = {};
    const first = records[0];
    query.dimensions.forEach((dimension) => {
      row[dimension.alias ?? dimension.dimensionId] = first ? valueFor(first, dimension.dimensionId) : null;
    });
    query.metrics.forEach((metric) => {
      row[metric.alias ?? metric.metricId] = metricValue(metric.metricId, records);
    });
    return row;
  });
  const columns = [
    ...query.dimensions.map((dimension) => dimension.alias ?? dimension.dimensionId),
    ...query.metrics.map((metric) => metric.alias ?? metric.metricId)
  ];
  return {
    columns,
    rows: query.limit ? rows.slice(0, query.limit) : rows,
    summary: { rowCount: filtered.length, source: aviationDataset.sourceLabel, query: JSON.parse(JSON.stringify(query)) as QuerySpec }
  };
}

export function formatMetricValue(metricId: string, value: unknown) {
  const metric = metricById.get(metricId);
  const number = typeof value === 'number' ? value : Number(value ?? 0);
  if (!metric) return String(value ?? '-');
  if (metric.format === 'percentage') return `${(number * 100).toFixed(1)}%`;
  if (metric.format === 'minutes') return `${number.toFixed(1)} min`;
  if (metric.format === 'decimal') return number.toFixed(1);
  return Math.round(number).toLocaleString('en-US');
}
