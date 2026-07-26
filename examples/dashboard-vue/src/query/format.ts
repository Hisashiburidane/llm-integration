export function formatMetricValue(metricId: string, value: unknown, unit?: string) {
  if (value === null || value === undefined || value === '') return '-';
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return String(value);
  const normalized = metricId.toLowerCase();
  if (normalized.includes('rate') || normalized.includes('ratio') || normalized.includes('percentage')) return `${(number * 100).toFixed(1)}%`;
  const formatted = normalized.includes('count') || normalized.includes('number') ? Math.round(number).toLocaleString('en-US') : number.toFixed(1);
  if (unit === 'USD') return `$${formatted}`;
  if (unit) return `${formatted} ${unit}`;
  return formatted;
}
