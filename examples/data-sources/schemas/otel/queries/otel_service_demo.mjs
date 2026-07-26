export default {
  id: 'otel_service_demo',
  title: 'OpenTelemetry service health',
  sources: [{
    id: 'service-minute-rollup',
    table: 'otel_service_minute_rollup',
    from: `(SELECT rollup.*, capture.scenario, capture.started_at, capture.duration_seconds,
      capture.scenario || ' · ' || capture.started_at || ' · ' || capture.duration_seconds || 's' AS capture_label
      FROM otel_service_minute_rollup AS rollup
      LEFT JOIN otel_capture_runs AS capture ON capture.capture_id = rollup.capture_id) AS source`,
    dimensions: {
      capture: { sql: 'source.capture_id', labelSql: 'source.capture_label' },
      minute: 'source.observed_minute',
      service: 'source.service_name'
    },
    metrics: {
      serviceCount: 'COUNT(DISTINCT source.service_name)',
      spanCount: 'SUM(source.span_count)',
      spanErrorCount: 'SUM(source.error_count)',
      spanErrorRate: 'SUM(source.error_count) * 1.0 / NULLIF(SUM(source.span_count), 0)',
      averageLatency: 'SUM(source.average_duration_ms * source.span_count) * 1.0 / NULLIF(SUM(source.span_count), 0)',
      p95Latency: 'MAX(source.p95_duration_ms)'
    },
    rowCountSql: 'SUM(source.span_count)'
  }],
  facets: [
    { id: 'captures', dimensionId: 'capture', order: 'desc' }
  ]
};
