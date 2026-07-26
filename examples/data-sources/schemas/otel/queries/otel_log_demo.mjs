export default {
  id: 'otel_log_demo',
  title: 'OpenTelemetry logs',
  sources: [{
    id: 'log-minute-rollup',
    table: 'otel_log_minute_rollup',
    from: 'otel_log_minute_rollup AS source',
    dimensions: {
      capture: 'source.capture_id',
      minute: 'source.observed_minute',
      service: 'source.service_name',
      severity: 'source.severity'
    },
    metrics: {
      logCount: 'SUM(source.log_count)',
      logErrorRate: "SUM(CASE WHEN source.severity IN ('ERROR', 'FATAL') THEN source.log_count ELSE 0 END) * 1.0 / NULLIF(SUM(source.log_count), 0)"
    },
    rowCountSql: 'SUM(source.log_count)'
  }]
};
