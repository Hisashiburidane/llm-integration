export default {
  id: 'otel-demo-observability',
  topicId: 'observability',
  title: 'Astronomy Shop / OpenTelemetry',
  description: '基于 OpenTelemetry Demo 真实采集信号的服务健康、调用链、指标和日志分析。',
  sourceManifest: {
    datasetId: 'otel_demo',
    sourceType: 'sqlite',
    provider: 'OpenTelemetry Demo',
    license: 'Apache-2.0',
    retrievedAt: 'capture manifest',
    limitations: [
      '数据由 Astronomy Shop 的合成业务负载生成，不代表生产系统。',
      '服务依赖关系由跨服务父子 Span 推导。',
      '错误判断基于 Span status 和标准化日志严重级别。'
    ]
  },
  filterDefinitions: [
    {
      id: 'capture',
      label: '采集批次',
      dimensionId: 'capture',
      operator: 'eq',
      defaultValue: 'ALL',
      allValue: 'ALL',
      facetKey: 'captures',
      defaultFromFacet: 'first'
    }
  ],
  evidenceGroups: [
    { id: 'latency', label: '延迟分析', description: '用总体值、时间趋势、服务排名和服务明细交叉判断延迟。', panelIds: ['otel-p95-latency', 'otel-latency-trend', 'otel-latency-ranking', 'otel-service-health'], questions: ['哪个服务延迟最高', 'P95 延迟是否异常', '延迟如何变化'] },
    { id: 'errors', label: '错误分析', description: '同时观察总体错误、时间变化、服务排名和依赖边错误。', panelIds: ['otel-error-rate', 'otel-error-trend', 'otel-service-error-ranking', 'otel-edge-risk'], questions: ['哪个服务错误率最高', '错误是否集中出现', '哪条依赖存在错误'] },
    { id: 'traffic', label: '流量与依赖', description: '从总体吞吐、服务流量、拓扑和依赖性能解释调用活动。', panelIds: ['otel-throughput-trend', 'otel-service-throughput', 'otel-service-topology', 'otel-edge-latency'], questions: ['哪个服务最繁忙', '调用量最大的依赖', '调用拓扑如何'] },
    { id: 'logs', label: '日志分析', description: '结合日志总量、错误比例、严重级别和服务分布定位日志证据。', panelIds: ['otel-log-count', 'otel-log-error-rate', 'otel-log-severity', 'otel-service-logs'], questions: ['日志严重级别如何', '哪个服务日志最多', '错误日志是否增加'] },
    { id: 'telemetry', label: '遥测覆盖', description: '检查采集服务、Metric 数据点和 Metric 目录。', panelIds: ['otel-service-count', 'otel-metric-services', 'otel-metric-catalog'], questions: ['采集覆盖哪些服务', '有哪些指标', '遥测数据量如何'] }
  ],
  assistantPrompt: '你是 OpenTelemetry Incident Assistant。回答问题前必须调用 dashboard.read_data 读取真实 Panel 结果。根据页面 metadata 中的 evidenceGroups 选择 2-4 个互补 Panel 交叉分析，并调用 dashboard.highlight 高亮同一组主要证据；只有用户明确要求不改变界面时才不高亮。不要为了凑数量选择无关 Panel。Span 是一次操作，不要把 Span 数直接表述为用户请求数；没有错误证据时不要推断故障根因。',
  suggestions: [
    '当前哪个服务的 P95 延迟最高？',
    '调用量最大的服务依赖是哪一条？',
    '日志主要来自哪些严重级别？',
    '结合服务健康和拓扑，指出值得优先调查的服务。'
  ],
  dataset: {
    id: 'otel_demo',
    name: 'OpenTelemetry Demo observability signals',
    description: 'Astronomy Shop 服务产生的 traces、metrics、logs 及分钟级聚合。',
    sourceLabel: 'SQLite OpenTelemetry rollups; Astronomy Shop',
    entities: [
      { id: 'service', label: '服务', description: '通过 resource.service.name 标识的服务。', idField: 'service', displayField: 'service' },
      { id: 'capture', label: '采集批次', description: '一次有明确起止时间和场景标签的遥测采集。', idField: 'capture', displayField: 'capture' }
    ],
    dimensions: [
      { id: 'capture', label: '采集批次', description: 'Capture manifest 中的唯一标识。', field: 'capture_id', dataType: 'string', semanticType: 'entity' },
      { id: 'minute', label: '观测分钟', description: 'UTC 分钟级时间桶。', field: 'observed_minute', dataType: 'datetime', semanticType: 'time' },
      { id: 'service', label: '服务', description: 'OpenTelemetry resource.service.name。', field: 'service_name', dataType: 'string', semanticType: 'entity' },
      { id: 'sourceService', label: '调用方服务', description: '跨服务父子 Span 中的上游服务。', field: 'source_service', dataType: 'string', semanticType: 'entity' },
      { id: 'targetService', label: '被调用服务', description: '跨服务父子 Span 中的下游服务。', field: 'target_service', dataType: 'string', semanticType: 'entity' },
      { id: 'severity', label: '日志级别', description: '标准化后的 OpenTelemetry 日志严重级别。', field: 'severity', dataType: 'string', semanticType: 'category' },
      { id: 'metricName', label: '指标名称', description: 'OpenTelemetry metric instrument 名称。', field: 'metric_name', dataType: 'string', semanticType: 'entity' },
      { id: 'unit', label: '指标单位', description: '指标声明的单位。', field: 'unit', dataType: 'string', semanticType: 'category' }
    ],
    metrics: [
      { id: 'serviceCount', label: '服务数量', description: '当前采集批次中产生 Span 的服务数。', aggregation: 'count', format: 'integer', supportedDimensions: ['capture'] },
      { id: 'spanCount', label: 'Span 数量', description: '服务操作记录数量，不等同于用户请求数。', aggregation: 'sum', format: 'integer', supportedDimensions: ['capture', 'minute', 'service'] },
      { id: 'spanErrorCount', label: '错误 Span', description: 'status 标记为 ERROR 的 Span 数。', aggregation: 'sum', format: 'integer', supportedDimensions: ['capture', 'minute', 'service'] },
      { id: 'spanErrorRate', label: 'Span 错误率', description: '错误 Span 占全部 Span 的比例。', aggregation: 'ratio', format: 'percentage', supportedDimensions: ['capture', 'minute', 'service'] },
      { id: 'averageLatency', label: '平均耗时', description: '按 Span 数加权的平均操作耗时。', aggregation: 'avg', unit: 'ms', format: 'decimal', supportedDimensions: ['capture', 'minute', 'service'] },
      { id: 'p95Latency', label: '最高 P95 耗时', description: '所选时间桶中的最高 P95 Span 耗时。', aggregation: 'p95', unit: 'ms', format: 'decimal', supportedDimensions: ['capture', 'minute', 'service'] },
      { id: 'callCount', label: '跨服务调用数', description: '由跨服务父子 Span 推导的调用次数。', aggregation: 'sum', format: 'integer', supportedDimensions: ['capture', 'sourceService', 'targetService'] },
      { id: 'edgeErrorRate', label: '依赖错误率', description: '跨服务调用边上的错误比例。', aggregation: 'ratio', format: 'percentage', supportedDimensions: ['capture', 'sourceService', 'targetService'] },
      { id: 'edgeAverageLatency', label: '依赖平均耗时', description: '跨服务调用边的加权平均耗时。', aggregation: 'avg', unit: 'ms', format: 'decimal', supportedDimensions: ['capture', 'sourceService', 'targetService'] },
      { id: 'edgeP95Latency', label: '依赖 P95 耗时', description: '跨服务调用边的 P95 耗时。', aggregation: 'p95', unit: 'ms', format: 'decimal', supportedDimensions: ['capture', 'sourceService', 'targetService'] },
      { id: 'logCount', label: '日志数量', description: '标准化后的日志记录数。', aggregation: 'sum', format: 'integer', supportedDimensions: ['capture', 'minute', 'service', 'severity'] },
      { id: 'logErrorRate', label: '错误日志比例', description: 'ERROR 和 FATAL 日志占全部日志的比例。', aggregation: 'ratio', format: 'percentage', supportedDimensions: ['capture', 'minute', 'service', 'severity'] },
      { id: 'metricPointCount', label: 'Metric 数据点', description: 'Collector 接收到的指标数据点数量。', aggregation: 'sum', format: 'integer', supportedDimensions: ['capture', 'minute', 'service', 'metricName', 'unit'] },
      { id: 'metricSeriesCount', label: 'Metric 名称数', description: '当前范围内不同指标名称的数量。', aggregation: 'count', format: 'integer', supportedDimensions: ['capture', 'service'] }
    ],
    relations: [
      { id: 'service-call', label: '服务调用', description: '由父子 Span 推导的跨服务调用。', sourceEntity: 'service', targetEntity: 'service', sourceField: 'sourceService', targetField: 'targetService' }
    ]
  },
  panelTemplates: [
    { id: 'otel-service-latency-template', type: 'bar', title: '服务 P95 耗时', description: '比较服务的最高 P95 Span 耗时。', query: { datasetId: 'otel_service_demo', metrics: [{ metricId: 'p95Latency' }], dimensions: [{ dimensionId: 'service' }], filters: [], limit: 30, orderBy: { fieldId: 'p95Latency', direction: 'desc' } }, visualization: { showLabels: true }, layout: { width: 6, minHeight: 320 } },
    { id: 'otel-service-topology-template', type: 'graph', title: '服务调用拓扑', description: '根据跨服务父子 Span 绘制调用关系。', query: { datasetId: 'otel_edge_demo', metrics: [{ metricId: 'callCount' }], dimensions: [{ dimensionId: 'sourceService' }, { dimensionId: 'targetService' }], filters: [], limit: 100, orderBy: { fieldId: 'callCount', direction: 'desc' } }, visualization: { showLabels: true }, layout: { width: 8, minHeight: 360 } }
  ],
  panels: [
    { id: 'otel-service-count', type: 'metric', title: '活跃服务', description: '当前采集批次中产生 Span 的服务数量。', query: { datasetId: 'otel_service_demo', metrics: [{ metricId: 'serviceCount' }], dimensions: [], filters: [] }, layout: { width: 3, minHeight: 148 } },
    { id: 'otel-span-count', type: 'metric', title: 'Span 数量', description: '当前采集批次中的操作记录总量。', query: { datasetId: 'otel_service_demo', metrics: [{ metricId: 'spanCount' }], dimensions: [], filters: [] }, layout: { width: 3, minHeight: 148 } },
    { id: 'otel-average-latency', type: 'metric', title: '平均操作耗时', description: '按 Span 数量加权的平均耗时。', query: { datasetId: 'otel_service_demo', metrics: [{ metricId: 'averageLatency' }], dimensions: [], filters: [] }, layout: { width: 3, minHeight: 148 } },
    { id: 'otel-error-rate', type: 'metric', title: 'Span 错误率', description: '由 OpenTelemetry Span status 计算的错误比例。', query: { datasetId: 'otel_service_demo', metrics: [{ metricId: 'spanErrorRate' }], dimensions: [], filters: [] }, layout: { width: 3, minHeight: 148 } },
    { id: 'otel-p95-latency', type: 'metric', title: '最高 P95 耗时', description: '采集窗口内所有服务分钟桶中的最高 P95 Span 耗时。', query: { datasetId: 'otel_service_demo', metrics: [{ metricId: 'p95Latency' }], dimensions: [], filters: [] }, layout: { width: 3, minHeight: 148 } },
    { id: 'otel-error-span-count', type: 'metric', title: '错误 Span', description: '当前采集批次中 status 标记为 ERROR 的 Span 数量。', query: { datasetId: 'otel_service_demo', metrics: [{ metricId: 'spanErrorCount' }], dimensions: [], filters: [] }, layout: { width: 3, minHeight: 148 } },
    { id: 'otel-log-count', type: 'metric', title: '日志数量', description: '当前采集批次中的标准化日志记录数量。', query: { datasetId: 'otel_log_demo', metrics: [{ metricId: 'logCount' }], dimensions: [], filters: [] }, layout: { width: 3, minHeight: 148 } },
    { id: 'otel-log-error-rate', type: 'metric', title: '错误日志比例', description: 'ERROR 和 FATAL 日志占全部日志的比例。', query: { datasetId: 'otel_log_demo', metrics: [{ metricId: 'logErrorRate' }], dimensions: [], filters: [] }, layout: { width: 3, minHeight: 148 } },
    { id: 'otel-throughput-trend', type: 'timeline', title: 'Span 吞吐趋势', description: '按分钟观察所有服务产生的 Span 数量。', query: { datasetId: 'otel_service_demo', metrics: [{ metricId: 'spanCount' }], dimensions: [{ dimensionId: 'minute' }], filters: [], limit: 100 }, layout: { width: 8, minHeight: 330 } },
    { id: 'otel-latency-ranking', type: 'bar', title: '服务 P95 耗时', description: '比较各服务在采集窗口内出现的最高 P95 耗时。', query: { datasetId: 'otel_service_demo', metrics: [{ metricId: 'p95Latency' }], dimensions: [{ dimensionId: 'service' }], filters: [], limit: 30, orderBy: { fieldId: 'p95Latency', direction: 'desc' } }, visualization: { showLabels: true }, layout: { width: 4, minHeight: 330 } },
    { id: 'otel-latency-trend', type: 'line', title: '延迟趋势', description: '按分钟对比平均操作耗时和最高 P95 Span 耗时。', query: { datasetId: 'otel_service_demo', metrics: [{ metricId: 'averageLatency' }, { metricId: 'p95Latency' }], dimensions: [{ dimensionId: 'minute' }], filters: [], limit: 100 }, layout: { width: 6, minHeight: 300 } },
    { id: 'otel-error-trend', type: 'timeline', title: 'Span 错误率趋势', description: '按分钟观察 Span 错误率是否集中上升。', query: { datasetId: 'otel_service_demo', metrics: [{ metricId: 'spanErrorRate' }], dimensions: [{ dimensionId: 'minute' }], filters: [], limit: 100 }, layout: { width: 6, minHeight: 300 } },
    { id: 'otel-service-throughput', type: 'bar', title: '服务 Span 活动排名', description: '按服务比较 Span 操作记录数量，用于识别高活动服务。', query: { datasetId: 'otel_service_demo', metrics: [{ metricId: 'spanCount' }], dimensions: [{ dimensionId: 'service' }], filters: [], limit: 30, orderBy: { fieldId: 'spanCount', direction: 'desc' } }, visualization: { showLabels: true }, layout: { width: 6, minHeight: 310 } },
    { id: 'otel-service-error-ranking', type: 'bar', title: '服务错误率排名', description: '按服务比较 Span 错误率，避免只看错误绝对数量。', query: { datasetId: 'otel_service_demo', metrics: [{ metricId: 'spanErrorRate' }], dimensions: [{ dimensionId: 'service' }], filters: [], limit: 30, orderBy: { fieldId: 'spanErrorRate', direction: 'desc' } }, visualization: { showLabels: true }, layout: { width: 6, minHeight: 310 } },
    { id: 'otel-service-topology', type: 'graph', title: '服务调用拓扑', description: '节点为服务，连线宽度表示跨服务调用次数。', query: { datasetId: 'otel_edge_demo', metrics: [{ metricId: 'callCount' }], dimensions: [{ dimensionId: 'sourceService' }, { dimensionId: 'targetService' }], filters: [], limit: 100, orderBy: { fieldId: 'callCount', direction: 'desc' } }, visualization: { showLabels: true }, layout: { width: 8, minHeight: 360 } },
    { id: 'otel-edge-latency', type: 'table', title: '服务依赖性能', description: '查看调用方、被调用方、调用量、平均耗时和 P95 耗时。', query: { datasetId: 'otel_edge_demo', metrics: [{ metricId: 'callCount' }, { metricId: 'edgeAverageLatency' }, { metricId: 'edgeP95Latency' }], dimensions: [{ dimensionId: 'sourceService' }, { dimensionId: 'targetService' }], filters: [], limit: 30, orderBy: { fieldId: 'callCount', direction: 'desc' } }, layout: { width: 4, minHeight: 360 } },
    { id: 'otel-edge-risk', type: 'table', title: '依赖错误与延迟', description: '并列检查服务依赖的调用量、错误率和 P95 耗时。', query: { datasetId: 'otel_edge_demo', metrics: [{ metricId: 'callCount' }, { metricId: 'edgeErrorRate' }, { metricId: 'edgeP95Latency' }], dimensions: [{ dimensionId: 'sourceService' }, { dimensionId: 'targetService' }], filters: [], limit: 30, orderBy: { fieldId: 'edgeErrorRate', direction: 'desc' } }, layout: { width: 12, minHeight: 340 } },
    { id: 'otel-log-trend', type: 'line', title: '日志量趋势', description: '按分钟观察全部服务的日志记录数量。', query: { datasetId: 'otel_log_demo', metrics: [{ metricId: 'logCount' }], dimensions: [{ dimensionId: 'minute' }], filters: [], limit: 100 }, layout: { width: 6, minHeight: 300 } },
    { id: 'otel-log-severity', type: 'donut', title: '日志严重级别', description: '比较标准化后的 TRACE、DEBUG、INFO、WARN、ERROR、FATAL 等日志数量。', query: { datasetId: 'otel_log_demo', metrics: [{ metricId: 'logCount' }], dimensions: [{ dimensionId: 'severity' }], filters: [], limit: 20 }, layout: { width: 6, minHeight: 300 } },
    { id: 'otel-service-logs', type: 'bar', title: '服务日志量排名', description: '按服务比较日志记录数量，识别日志活动集中位置。', query: { datasetId: 'otel_log_demo', metrics: [{ metricId: 'logCount' }], dimensions: [{ dimensionId: 'service' }], filters: [], limit: 30, orderBy: { fieldId: 'logCount', direction: 'desc' } }, visualization: { showLabels: true }, layout: { width: 6, minHeight: 300 } },
    { id: 'otel-log-error-trend', type: 'timeline', title: '错误日志比例趋势', description: '按分钟观察 ERROR 和 FATAL 日志比例。', query: { datasetId: 'otel_log_demo', metrics: [{ metricId: 'logErrorRate' }], dimensions: [{ dimensionId: 'minute' }], filters: [], limit: 100 }, layout: { width: 6, minHeight: 300 } },
    { id: 'otel-metric-services', type: 'bar', title: '服务 Metric 数据点', description: '比较各服务向 Collector 发送的 Metric 数据点数量。', query: { datasetId: 'otel_metric_demo', metrics: [{ metricId: 'metricPointCount' }], dimensions: [{ dimensionId: 'service' }], filters: [], limit: 30, orderBy: { fieldId: 'metricPointCount', direction: 'desc' } }, visualization: { showLabels: true }, layout: { width: 5, minHeight: 320 } },
    { id: 'otel-metric-catalog', type: 'table', title: 'Metric 目录', description: '列出当前采集批次中的指标名称、单位和数据点数量。', query: { datasetId: 'otel_metric_demo', metrics: [{ metricId: 'metricPointCount' }], dimensions: [{ dimensionId: 'metricName' }, { dimensionId: 'unit' }], filters: [], limit: 40 }, layout: { width: 7, minHeight: 320 } },
    { id: 'otel-service-health', type: 'table', title: '服务健康概览', description: '按服务汇总 Span 数、错误数、平均耗时和最高 P95 耗时。', query: { datasetId: 'otel_service_demo', metrics: [{ metricId: 'spanCount' }, { metricId: 'spanErrorCount' }, { metricId: 'averageLatency' }, { metricId: 'p95Latency' }], dimensions: [{ dimensionId: 'service' }], filters: [], limit: 30, orderBy: { fieldId: 'p95Latency', direction: 'desc' } }, layout: { width: 12, minHeight: 360 } }
  ]
};
