import type { MetricDefinition } from '../model/types';

export function formatMetricValue(value: unknown, definition?: MetricDefinition) {
  if (value === null || value === undefined || value === '') return '-';
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return String(value);
  if (definition?.format === 'percentage') return `${(number * 100).toFixed(1)}%`;
  const formatted = definition?.format === 'integer'
    ? Math.round(number).toLocaleString('en-US')
    : number.toFixed(1);
  if (definition?.unit === 'USD') return `$${formatted}`;
  if (definition?.unit) return `${formatted} ${definition.unit}`;
  return formatted;
}
