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
  evidenceGroups: [
    { id: 'demand', label: '出行需求', description: '结合每日趋势、行政区排名、区域排名和乘客量判断需求。', panelIds: ['taxi-daily-trips', 'taxi-borough-demand', 'taxi-zone-demand', 'taxi-borough-passengers'], questions: ['哪个行政区需求最高', '哪个区域行程最多', '需求如何变化'] },
    { id: 'revenue', label: '收入分析', description: '从总收入、每日趋势、行政区和上车区域交叉分析收入。', panelIds: ['taxi-total-revenue', 'taxi-daily-revenue', 'taxi-borough-revenue', 'taxi-zone-revenue'], questions: ['当前总收入是多少', '哪个行政区收入最高', '收入如何变化'] },
    { id: 'efficiency', label: '运行效率', description: '结合车费、时长、距离趋势和区域明细判断运行效率。', panelIds: ['taxi-average-fare', 'taxi-average-duration', 'taxi-distance-fare', 'taxi-zone-efficiency'], questions: ['平均车费和时长如何', '哪些区域行程效率不同', '距离与车费是否同步'] },
    { id: 'zone', label: '区域运营', description: '比较区域需求、收入和运营指标。', panelIds: ['taxi-zone-demand', 'taxi-zone-revenue', 'taxi-zone-operations', 'taxi-zone-efficiency'], questions: ['分析某个上车区域', '哪些区域最繁忙', '区域运营表现如何'] }
  ],
  assistantPrompt: '你是 NYC Taxi Assistant。回答问题前必须调用 dashboard.read_data。根据页面 metadata 中的 evidenceGroups 选择 2-4 个互补 Panel 交叉分析，并调用 dashboard.highlight 高亮同一组主要证据；只有用户明确要求不改变界面时才不高亮。不要为了凑数量选择无关 Panel。必须说明区域名称、日期范围和金额/距离/时长单位。',
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
    { id: 'taxi-daily-revenue', type: 'line', title: '每日收入趋势', description: '按日期观察总收费金额变化。', query: { datasetId: 'nyc_taxi_demo', metrics: [{ metricId: 'totalRevenue' }], dimensions: [{ dimensionId: 'date' }], filters: [], limit: 100 }, layout: { width: 6, minHeight: 300 } },
    { id: 'taxi-duration-trend', type: 'line', title: '每日行程时长', description: '按日期观察平均行程时长变化。', query: { datasetId: 'nyc_taxi_demo', metrics: [{ metricId: 'averageTripDuration' }], dimensions: [{ dimensionId: 'date' }], filters: [], limit: 100 }, layout: { width: 6, minHeight: 300 } },
    { id: 'taxi-zone-demand', type: 'bar', title: '上车区域需求排名', description: '比较各上车区域的行程数量。', query: { datasetId: 'nyc_taxi_demo', metrics: [{ metricId: 'tripCount' }], dimensions: [{ dimensionId: 'pickupZone' }], filters: [], limit: 20 }, visualization: { showLabels: true }, layout: { width: 6, minHeight: 300 } },
    { id: 'taxi-distance-fare', type: 'line', title: '距离与车费趋势', description: '按日期对比平均行程距离和平均基础车费。', query: { datasetId: 'nyc_taxi_demo', metrics: [{ metricId: 'averageTripDistance' }, { metricId: 'averageFare' }], dimensions: [{ dimensionId: 'date' }], filters: [], limit: 100 }, layout: { width: 6, minHeight: 300 } },
    { id: 'taxi-borough-revenue', type: 'bar', title: '行政区收入排名', description: '比较各行政区产生的总收费金额。', query: { datasetId: 'nyc_taxi_demo', metrics: [{ metricId: 'totalRevenue' }], dimensions: [{ dimensionId: 'borough' }], filters: [], limit: 10, orderBy: { fieldId: 'totalRevenue', direction: 'desc' } }, visualization: { showLabels: true }, layout: { width: 4, minHeight: 300 } },
    { id: 'taxi-zone-revenue', type: 'bar', title: '上车区域收入排名', description: '比较各上车区域产生的总收费金额。', query: { datasetId: 'nyc_taxi_demo', metrics: [{ metricId: 'totalRevenue' }], dimensions: [{ dimensionId: 'pickupZone' }], filters: [], limit: 20, orderBy: { fieldId: 'totalRevenue', direction: 'desc' } }, visualization: { showLabels: true }, layout: { width: 4, minHeight: 300 } },
    { id: 'taxi-borough-passengers', type: 'bar', title: '行政区乘客量', description: '比较各行政区乘客数量字段的合计。', query: { datasetId: 'nyc_taxi_demo', metrics: [{ metricId: 'passengerCount' }], dimensions: [{ dimensionId: 'borough' }], filters: [], limit: 10, orderBy: { fieldId: 'passengerCount', direction: 'desc' } }, visualization: { showLabels: true }, layout: { width: 4, minHeight: 300 } },
    { id: 'taxi-zone-operations', type: 'table', title: '区域运行明细', description: '查看上车区域的行程、车费和时长指标。', query: { datasetId: 'nyc_taxi_demo', metrics: [{ metricId: 'tripCount' }, { metricId: 'averageFare' }, { metricId: 'averageTripDuration' }], dimensions: [{ dimensionId: 'pickupZone' }], filters: [], limit: 20 }, layout: { width: 12, minHeight: 340 } },
    { id: 'taxi-zone-efficiency', type: 'table', title: '区域效率明细', description: '按上车区域并列查看行程距离、车费、小费和行程时长。', query: { datasetId: 'nyc_taxi_demo', metrics: [{ metricId: 'averageTripDistance' }, { metricId: 'averageFare' }, { metricId: 'averageTip' }, { metricId: 'averageTripDuration' }], dimensions: [{ dimensionId: 'pickupZone' }], filters: [], limit: 20, orderBy: { fieldId: 'averageTripDuration', direction: 'desc' } }, layout: { width: 12, minHeight: 340 } }
  ]
};
