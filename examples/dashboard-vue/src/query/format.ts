export function formatMetricValue(metricId: string, value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return String(value);
  const normalized = metricId.toLowerCase();
  if (normalized.includes('rate') || normalized.includes('ratio') || normalized.includes('percentage')) return `${(number * 100).toFixed(1)}%`;
  if (normalized.includes('count') || normalized.includes('number')) return Math.round(number).toLocaleString('en-US');
  return number.toFixed(1);
}
