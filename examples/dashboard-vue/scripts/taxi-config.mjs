export const taxiDashboard = {
  id: 'nyc-taxi-operations',
  topicId: 'mobility',
  title: 'NYC Taxi / Mobility Operations',
  description: '基于 NYC TLC Yellow Taxi 月度数据的需求、收入和运行效率分析。',
  sourceManifest: {
    datasetId: 'nyc_taxi_demo',
    sourceType: 'sqlite',
    provider: 'NYC Taxi & Limousine Commission',
    license: 'NYC TLC trip record data; see the download plan for source and terms.',
    retrievedAt: '2025-01',
    limitations: ['当前样本为 2025 年 1 月 Yellow Taxi 数据。', '异常距离、金额和时长在清洗阶段保留为零或缺失，不代表完整运营账本。', 'Panel 查询使用日期 × 上车区域物化聚合表。']
  },
  filterDefinitions: [
    { id: 'date', dimensionId: 'date', operator: 'between', defaultValue: ['2025-01-01', '2025-01-31'] },
    { id: 'borough', dimensionId: 'borough', operator: 'eq', defaultValue: 'ALL', allValue: 'ALL', options: [{ value: 'Bronx', label: 'Bronx' }, { value: 'Brooklyn', label: 'Brooklyn' }, { value: 'Manhattan', label: 'Manhattan' }, { value: 'Queens', label: 'Queens' }, { value: 'Staten Island', label: 'Staten Island' }] },
    { id: 'pickupZone', dimensionId: 'pickupZone', operator: 'eq', defaultValue: 'ALL', allValue: 'ALL', facetKey: 'taxiZones' }
  ],
  assistantPrompt: '你是 NYC Taxi Assistant。回答问题前必须调用 dashboard.read_data，并在同一计划中调用 dashboard.highlight 高亮作为回答主要证据的 Panel；只有用户明确要求不改变界面时才不高亮。需求问题使用需求排名和趋势 Panel，收入问题使用收入 Panel，运行效率问题使用时长和距离 Panel。必须说明区域名称、日期范围和金额/距离/时长单位。',
  suggestions: ['哪个行政区的出租车需求最高？', '哪个上车区域行程最多？', '平均车费和平均行程时长如何变化？', '当前样本的总收入是多少？'],
  dataset: {
    id: 'nyc_taxi_demo',
    name: 'NYC Yellow Taxi operations',
    description: 'NYC Yellow Taxi 行程清洗后的需求、收入和运行效率指标。',
    sourceLabel: 'SQLite nyc_taxi_dashboard_rollup; NYC TLC Yellow Taxi',
    entities: [
      { id: 'trip', label: '出租车行程', description: '一条 Yellow Taxi 行程记录。', idField: 'pickupAt', displayField: 'pickupAt' },
      { id: 'zone', label: '上车区域', description: '纽约出租车区域字典中的上车区域。', idField: 'pickupLocation', displayField: 'pickupZone' }
    ],
    dimensions: [
      { id: 'date', label: '上车日期', description: '行程上车日期。', field: 'pickup_date', dataType: 'date', semanticType: 'time' },
      { id: 'borough', label: '上车行政区', description: '上车区域所属行政区。', field: 'pickup_borough', dataType: 'string', semanticType: 'category' },
      { id: 'pickupZone', label: '上车区域', description: '上车区域名称。', field: 'pickup_zone', dataType: 'string', semanticType: 'entity' },
      { id: 'pickupLocation', label: '上车区域 ID', description: 'NYC TLC 上车区域 ID。', field: 'pickup_location_id', dataType: 'number', semanticType: 'entity' },
      { id: 'paymentType', label: '支付方式', description: 'TLC 支付方式代码。', field: 'payment_type', dataType: 'string', semanticType: 'category' }
    ],
    metrics: [
      { id: 'tripCount', label: '行程数', description: '当前范围内的出租车行程数。', aggregation: 'count', format: 'integer', supportedDimensions: ['date', 'borough', 'pickupZone', 'pickupLocation', 'paymentType'] },
      { id: 'passengerCount', label: '乘客人次', description: '乘客数量字段的合计。', aggregation: 'sum', format: 'decimal', supportedDimensions: ['date', 'borough', 'pickupZone'] },
      { id: 'averageTripDistance', label: '平均行程距离', description: '平均行程距离，单位英里。', aggregation: 'avg', unit: 'mi', format: 'decimal', supportedDimensions: ['date', 'borough', 'pickupZone'] },
      { id: 'averageFare', label: '平均车费', description: '平均基础车费，不含小费，单位美元。', aggregation: 'avg', unit: 'USD', format: 'decimal', supportedDimensions: ['date', 'borough', 'pickupZone'] },
      { id: 'averageTip', label: '平均小费', description: '平均小费金额，单位美元。', aggregation: 'avg', unit: 'USD', format: 'decimal', supportedDimensions: ['date', 'borough', 'pickupZone'] },
      { id: 'totalRevenue', label: '总收入', description: '总收费金额，包含小费和其他费用，单位美元。', aggregation: 'sum', unit: 'USD', format: 'decimal', supportedDimensions: ['date', 'borough', 'pickupZone'] },
      { id: 'averageTripDuration', label: '平均行程时长', description: '平均行程时长，单位分钟。', aggregation: 'avg', unit: 'min', format: 'decimal', supportedDimensions: ['date', 'borough', 'pickupZone'] }
    ],
    relations: []
  },
  panelTemplates: [
    { id: 'taxi-zone-demand-template', type: 'bar', title: '上车区域需求排名', description: '比较各上车区域的行程数量。', query: { datasetId: 'nyc_taxi_demo', metrics: [{ metricId: 'tripCount' }], dimensions: [{ dimensionId: 'pickupZone' }], filters: [], limit: 20 }, visualization: { showLabels: true }, layout: { width: 6, minHeight: 300 } }
  ],
  panels: [
    { id: 'taxi-trip-count', type: 'metric', title: '出租车行程数', description: '当前日期范围内的 Yellow Taxi 行程数。', query: { datasetId: 'nyc_taxi_demo', metrics: [{ metricId: 'tripCount' }], dimensions: [], filters: [] }, layout: { width: 3, minHeight: 148 } },
    { id: 'taxi-average-fare', type: 'metric', title: '平均车费', description: '当前日期范围内的平均基础车费。', query: { datasetId: 'nyc_taxi_demo', metrics: [{ metricId: 'averageFare' }], dimensions: [], filters: [] }, layout: { width: 3, minHeight: 148 } },
    { id: 'taxi-average-duration', type: 'metric', title: '平均行程时长', description: '当前日期范围内的平均行程时长。', query: { datasetId: 'nyc_taxi_demo', metrics: [{ metricId: 'averageTripDuration' }], dimensions: [], filters: [] }, layout: { width: 3, minHeight: 148 } },
    { id: 'taxi-total-revenue', type: 'metric', title: '总收入', description: '当前日期范围内的总收费金额。', query: { datasetId: 'nyc_taxi_demo', metrics: [{ metricId: 'totalRevenue' }], dimensions: [], filters: [] }, layout: { width: 3, minHeight: 148 } },
    { id: 'taxi-daily-trips', type: 'line', title: '每日行程需求', description: '观察样本月份内每日出租车行程量变化。', query: { datasetId: 'nyc_taxi_demo', metrics: [{ metricId: 'tripCount' }], dimensions: [{ dimensionId: 'date' }], filters: [], limit: 100 }, layout: { width: 8, minHeight: 330 } },
    { id: 'taxi-borough-demand', type: 'bar', title: '行政区需求排名', description: '比较各行政区的上车行程量。', query: { datasetId: 'nyc_taxi_demo', metrics: [{ metricId: 'tripCount' }], dimensions: [{ dimensionId: 'borough' }], filters: [], limit: 10 }, visualization: { showLabels: true }, layout: { width: 4, minHeight: 330 } },
    { id: 'taxi-zone-demand', type: 'bar', title: '上车区域需求排名', description: '比较各上车区域的行程数量。', query: { datasetId: 'nyc_taxi_demo', metrics: [{ metricId: 'tripCount' }], dimensions: [{ dimensionId: 'pickupZone' }], filters: [], limit: 20 }, visualization: { showLabels: true }, layout: { width: 6, minHeight: 300 } },
    { id: 'taxi-distance-fare', type: 'line', title: '距离与车费趋势', description: '按日期对比平均行程距离和平均基础车费。', query: { datasetId: 'nyc_taxi_demo', metrics: [{ metricId: 'averageTripDistance' }, { metricId: 'averageFare' }], dimensions: [{ dimensionId: 'date' }], filters: [], limit: 100 }, layout: { width: 6, minHeight: 300 } },
    { id: 'taxi-zone-operations', type: 'table', title: '区域运行明细', description: '查看上车区域的行程、车费和时长指标。', query: { datasetId: 'nyc_taxi_demo', metrics: [{ metricId: 'tripCount' }, { metricId: 'averageFare' }, { metricId: 'averageTripDuration' }], dimensions: [{ dimensionId: 'pickupZone' }], filters: [], limit: 20 }, layout: { width: 12, minHeight: 340 } }
  ]
};
