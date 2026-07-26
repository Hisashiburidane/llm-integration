export default {
  id: 'otel_metric_demo',
  title: 'OpenTelemetry metrics',
  sources: [{
    id: 'metric-minute-rollup',
    table: 'otel_metric_minute_rollup',
    from: 'otel_metric_minute_rollup AS source',
    dimensions: {
      capture: 'source.capture_id',
      minute: 'source.observed_minute',
      service: 'source.service_name',
      metricName: 'source.metric_name',
      unit: 'source.unit'
    },
    metrics: {
      metricPointCount: 'SUM(source.point_count)',
      metricSeriesCount: 'COUNT(DISTINCT source.metric_name)'
    },
    rowCountSql: 'SUM(source.point_count)'
  }]
};
