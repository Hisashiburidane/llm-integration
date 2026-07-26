export default {
  id: 'otel_edge_demo',
  title: 'OpenTelemetry service dependencies',
  sources: [{
    id: 'service-edge-rollup',
    table: 'otel_service_edge_rollup',
    from: 'otel_service_edge_rollup AS source',
    dimensions: {
      capture: 'source.capture_id',
      sourceService: 'source.source_service',
      targetService: 'source.target_service'
    },
    metrics: {
      callCount: 'SUM(source.call_count)',
      edgeErrorRate: 'SUM(source.error_count) * 1.0 / NULLIF(SUM(source.call_count), 0)',
      edgeAverageLatency: 'SUM(source.average_duration_ms * source.call_count) * 1.0 / NULLIF(SUM(source.call_count), 0)',
      edgeP95Latency: 'MAX(source.p95_duration_ms)'
    },
    rowCountSql: 'SUM(source.call_count)'
  }]
};
