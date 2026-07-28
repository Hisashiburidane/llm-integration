export default {
  id: 'aviation-operations',
  topicId: 'aviation',
  title: 'Flight Operations / Delay Analysis',
  description: '基于 BTS 航班运行数据的可寻址、可联动 Dashboard。',
  metadata: {
    aliases: ['航班运行', '机场延误', '航空公司准点率', 'flight operations', 'on-time performance'],
    keywords: ['航班', '机场', '航空公司', '出港', '到港', '延误', '准点率', '取消率', '延误原因'],
    useCases: ['比较机场或航空公司的运行质量', '分析延误时段、原因和严重程度', '查看航班量、准点率与取消率'],
    exampleRequests: ['哪个机场平均延误最高', '比较航空公司准点率', '延误主要集中在哪些时段', '创建机场运行 Dashboard']
  },
  sourceManifest: {
    datasetId: 'aviation_ontime_demo',
    sourceType: 'sqlite',
    provider: 'Bureau of Transportation Statistics',
    license: 'BTS On-Time Performance data; see the download plan for source and terms.',
    retrievedAt: '2025-07',
    limitations: ['当前下载计划按月提供原始数据。', '指标来自已清洗的 aviation_flights 表。']
  },
  filterDefinitions: [
    { id: 'airport', dimensionId: 'airport', operator: 'eq', defaultValue: 'ALL', allValue: 'ALL', facetKey: 'airports' },
    { id: 'carrier', dimensionId: 'carrier', operator: 'eq', defaultValue: 'ALL', allValue: 'ALL', facetKey: 'carriers' },
    { id: 'direction', dimensionId: 'direction', operator: 'eq', defaultValue: 'departure', facetKey: 'directions', options: [{ value: 'departure', label: '出港' }, { value: 'arrival', label: '到港' }] },
    { id: 'hour', dimensionId: 'hour', operator: 'between', defaultValue: [6, 22], type: 'range', min: 0, max: 23 }
  ],
  evidenceGroups: [
    { id: 'airport', label: '机场运行对比', description: '结合延误、准点率、航班量和严重延误比较机场运行状态。', panelIds: ['airport-ranking', 'airport-status', 'airport-volume', 'airport-reliability'], questions: ['哪个机场延误最高', '哪个机场运行压力最大', '比较机场准点表现'] },
    { id: 'carrier', label: '航空公司对比', description: '结合准点率、平均延误和取消率比较承运人。', panelIds: ['carrier-ranking', 'carrier-average-delay', 'carrier-reliability'], questions: ['比较航空公司准点率', '哪家航空公司延误严重', '承运人取消情况'] },
    { id: 'time', label: '时段分析', description: '从准点率、平均延误和严重延误数量识别异常时段。', panelIds: ['hourly-on-time', 'hourly-average-delay', 'delay-timeline'], questions: ['哪个小时延误最多', '晚高峰表现如何', '严重延误何时集中'] },
    { id: 'cause', label: '延误原因', description: '同时查看原因构成、机场原因分布和总体延误。', panelIds: ['delay-causes', 'delay-cause-airport', 'average-delay'], questions: ['延误主要原因是什么', '哪些机场受特定原因影响', '解释平均延误'] }
  ],
  assistantPrompt: '你是 Flight Ops Assistant。回答数据问题前必须调用 dashboard.read_data 读取真实 Panel 结果。根据页面 metadata 中的 evidenceGroups 选择 2-4 个互补 Panel 交叉分析，并调用 dashboard.highlight 高亮同一组主要证据；只有用户明确要求不改变界面时才不高亮。不要为了凑数量选择无关 Panel。查询结果中的 airport、destination 和 delayCause 已由 SQL dictionary JOIN 转换为可读名称，不要只输出代码。',
  suggestions: ['当前哪个机场的平均延误最高？', '比较各航空公司的准点率。', '哪些小时的严重延误最多？', '当前延误主要由哪些原因构成？'],
  dataset: {
    id: 'aviation_ontime_demo',
    name: 'Flight operations delay analysis',
    description: 'BTS 航班运行数据清洗后的出港和到港记录。',
    sourceLabel: 'SQLite aviation_flights; BTS On-Time Performance',
    entities: [
      { id: 'flight', label: '航班', description: '单个航班运行记录。', idField: 'flightId', displayField: 'flightId' },
      { id: 'airport', label: '机场', description: '出发机场和到达机场。', idField: 'origin', displayField: 'origin' },
      { id: 'airline', label: '航空公司', description: '承运航空公司。', idField: 'carrier', displayField: 'carrier' }
    ],
    dimensions: [
      { id: 'date', label: '日期', description: '航班运行日期。', field: 'date', dataType: 'date', semanticType: 'time' },
      { id: 'hour', label: '出港小时', description: '计划出港小时。', field: 'hour', dataType: 'number', semanticType: 'time' },
      { id: 'airport', label: '出发机场', description: '航班出发机场。', field: 'origin', dataType: 'string', semanticType: 'entity' },
      { id: 'destination', label: '到达机场', description: '航班到达机场。', field: 'destination', dataType: 'string', semanticType: 'entity' },
      { id: 'carrier', label: '航空公司', description: '承运航空公司代码。', field: 'carrier', dataType: 'string', semanticType: 'entity' },
      { id: 'direction', label: '航班方向', description: '出港或到港视角。', field: 'direction', dataType: 'string', semanticType: 'category' },
      { id: 'delayCause', label: '延误原因', description: '主延误原因分类：NAS=国家空域系统/空管，carrier=航空公司，weather=天气，security=安保，none=无记录原因。', field: 'delayCause', dataType: 'string', semanticType: 'category' },
      { id: 'flightId', label: '航班编号', description: '航班唯一编号。', field: 'flightId', dataType: 'string', semanticType: 'entity' }
    ],
    metrics: [
      { id: 'flightCount', label: '航班数量', description: '筛选范围内航班记录数。', aggregation: 'count', format: 'integer', supportedDimensions: ['date', 'hour', 'airport', 'carrier', 'destination', 'direction', 'delayCause', 'flightId'] },
      { id: 'onTimeRate', label: '准点率', description: '出港延误不超过 15 分钟的航班占比。', aggregation: 'ratio', format: 'percentage', supportedDimensions: ['date', 'hour', 'airport', 'carrier', 'destination', 'direction', 'flightId'] },
      { id: 'averageDepartureDelay', label: '平均出港延误', description: '出港延误分钟数的平均值。', aggregation: 'avg', unit: 'min', format: 'minutes', supportedDimensions: ['date', 'hour', 'airport', 'carrier', 'destination', 'direction', 'delayCause', 'flightId'] },
      { id: 'p95DepartureDelay', label: 'P95 出港延误', description: '出港延误分钟数的 P95。', aggregation: 'p95', unit: 'min', format: 'minutes', supportedDimensions: ['date', 'hour', 'airport', 'carrier', 'destination', 'direction', 'flightId'] },
      { id: 'cancellationRate', label: '取消率', description: '取消航班占筛选范围内航班的比例。', aggregation: 'ratio', format: 'percentage', supportedDimensions: ['date', 'hour', 'airport', 'carrier', 'direction', 'flightId'] },
      { id: 'severeDelayCount', label: '严重延误', description: '出港延误至少 60 分钟的航班数量。', aggregation: 'count', format: 'integer', supportedDimensions: ['date', 'hour', 'airport', 'carrier', 'destination', 'direction', 'flightId'] },
      { id: 'delayMinutes', label: '延误分钟数', description: '按主原因汇总的延误分钟数。', aggregation: 'sum', unit: 'min', format: 'minutes', supportedDimensions: ['delayCause', 'airport', 'carrier', 'date'] }
    ],
    relations: [
      { id: 'flight-origin', label: '航班出发于机场', description: '航班与出发机场的关系。', sourceEntity: 'flight', targetEntity: 'airport', sourceField: 'origin', targetField: 'origin' },
      { id: 'flight-carrier', label: '航班由航空公司承运', description: '航班与承运航空公司的关系。', sourceEntity: 'flight', targetEntity: 'airline', sourceField: 'carrier', targetField: 'carrier' }
    ]
  },
  panelTemplates: [
    { id: 'carrier-delay-template', type: 'bar', title: '航空公司平均出港延误', description: '比较当前筛选范围内不同航空公司的平均出港延误。', query: { datasetId: 'aviation_ontime_demo', metrics: [{ metricId: 'averageDepartureDelay' }], dimensions: [{ dimensionId: 'carrier' }], filters: [] }, visualization: { showLabels: true }, layout: { width: 6, minHeight: 300 } },
    { id: 'airport-p95-template', type: 'bar', title: '机场 P95 延误排名', description: '比较机场尾部延误风险。', query: { datasetId: 'aviation_ontime_demo', metrics: [{ metricId: 'p95DepartureDelay' }], dimensions: [{ dimensionId: 'airport' }], filters: [] }, visualization: { showLabels: true }, layout: { width: 6, minHeight: 300 } }
  ],
  panels: [
    { id: 'flight-count', type: 'metric', title: '航班数量', description: '当前筛选范围内的航班数量。', query: { datasetId: 'aviation_ontime_demo', metrics: [{ metricId: 'flightCount' }], dimensions: [], filters: [] }, layout: { width: 3, minHeight: 148 } },
    { id: 'on-time-rate', type: 'metric', title: '准点率', description: '出港延误不超过 15 分钟的航班占比。', query: { datasetId: 'aviation_ontime_demo', metrics: [{ metricId: 'onTimeRate' }], dimensions: [], filters: [] }, layout: { width: 3, minHeight: 148 } },
    { id: 'average-delay', type: 'metric', title: '平均出港延误', description: '当前筛选范围内的平均出港延误分钟数。', query: { datasetId: 'aviation_ontime_demo', metrics: [{ metricId: 'averageDepartureDelay' }], dimensions: [], filters: [] }, layout: { width: 3, minHeight: 148 } },
    { id: 'cancellation-rate', type: 'metric', title: '取消率', description: '当前筛选范围内的取消航班比例。', query: { datasetId: 'aviation_ontime_demo', metrics: [{ metricId: 'cancellationRate' }], dimensions: [], filters: [] }, layout: { width: 3, minHeight: 148 } },
    { id: 'airport-status', type: 'table', title: '机场运行状态', description: '按机场比较当前准点率和平均延误。', query: { datasetId: 'aviation_ontime_demo', metrics: [{ metricId: 'onTimeRate' }, { metricId: 'averageDepartureDelay' }], dimensions: [{ dimensionId: 'airport' }], filters: [] }, layout: { width: 6, minHeight: 330 } },
    { id: 'hourly-on-time', type: 'line', title: '每小时准点率趋势', description: '识别晚高峰准点率变化和异常时间段。', query: { datasetId: 'aviation_ontime_demo', metrics: [{ metricId: 'onTimeRate' }], dimensions: [{ dimensionId: 'hour' }], filters: [] }, layout: { width: 6, minHeight: 330 } },
    { id: 'airport-ranking', type: 'bar', title: '机场平均延误排名', description: '按机场比较平均出港延误。', query: { datasetId: 'aviation_ontime_demo', metrics: [{ metricId: 'averageDepartureDelay' }], dimensions: [{ dimensionId: 'airport' }], filters: [] }, visualization: { showLabels: true }, layout: { width: 4, minHeight: 300 } },
    { id: 'airport-volume', type: 'bar', title: '机场航班量排名', description: '比较各机场当前筛选范围内的航班数量。', query: { datasetId: 'aviation_ontime_demo', metrics: [{ metricId: 'flightCount' }], dimensions: [{ dimensionId: 'airport' }], filters: [], limit: 20, orderBy: { fieldId: 'flightCount', direction: 'desc' } }, visualization: { showLabels: true }, layout: { width: 4, minHeight: 300 } },
    { id: 'airport-reliability', type: 'table', title: '机场可靠性明细', description: '并列查看机场航班量、准点率、平均延误、取消率和严重延误。', query: { datasetId: 'aviation_ontime_demo', metrics: [{ metricId: 'flightCount' }, { metricId: 'onTimeRate' }, { metricId: 'averageDepartureDelay' }, { metricId: 'cancellationRate' }, { metricId: 'severeDelayCount' }], dimensions: [{ dimensionId: 'airport' }], filters: [], limit: 20, orderBy: { fieldId: 'averageDepartureDelay', direction: 'desc' } }, layout: { width: 4, minHeight: 300 } },
    { id: 'delay-causes', type: 'donut', title: '延误原因构成', description: '查看当前范围内不同原因贡献的延误分钟数（空管、航空公司、天气、安保）。', query: { datasetId: 'aviation_ontime_demo', metrics: [{ metricId: 'delayMinutes' }], dimensions: [{ dimensionId: 'delayCause' }], filters: [{ dimensionId: 'delayCause', operator: 'neq', value: 'none' }] }, layout: { width: 4, minHeight: 300 } },
    { id: 'carrier-ranking', type: 'bar', title: '航空公司准点率', description: '比较航空公司在当前筛选范围内的准点率。', query: { datasetId: 'aviation_ontime_demo', metrics: [{ metricId: 'onTimeRate' }], dimensions: [{ dimensionId: 'carrier' }], filters: [] }, visualization: { showLabels: true }, layout: { width: 4, minHeight: 300 } },
    { id: 'carrier-average-delay', type: 'bar', title: '航空公司平均延误', description: '比较航空公司在当前筛选范围内的平均出港延误。', query: { datasetId: 'aviation_ontime_demo', metrics: [{ metricId: 'averageDepartureDelay' }], dimensions: [{ dimensionId: 'carrier' }], filters: [], limit: 20, orderBy: { fieldId: 'averageDepartureDelay', direction: 'desc' } }, visualization: { showLabels: true }, layout: { width: 4, minHeight: 300 } },
    { id: 'carrier-reliability', type: 'table', title: '航空公司可靠性', description: '并列比较航空公司的航班量、准点率、平均延误和取消率。', query: { datasetId: 'aviation_ontime_demo', metrics: [{ metricId: 'flightCount' }, { metricId: 'onTimeRate' }, { metricId: 'averageDepartureDelay' }, { metricId: 'cancellationRate' }], dimensions: [{ dimensionId: 'carrier' }], filters: [], limit: 20, orderBy: { fieldId: 'onTimeRate', direction: 'asc' } }, layout: { width: 4, minHeight: 300 } },
    { id: 'hourly-average-delay', type: 'line', title: '每小时平均延误', description: '按计划出港小时观察平均出港延误变化。', query: { datasetId: 'aviation_ontime_demo', metrics: [{ metricId: 'averageDepartureDelay' }], dimensions: [{ dimensionId: 'hour' }], filters: [] }, layout: { width: 6, minHeight: 300 } },
    { id: 'delay-timeline', type: 'timeline', title: '严重延误时间线', description: '按小时显示严重延误航班数量。', query: { datasetId: 'aviation_ontime_demo', metrics: [{ metricId: 'severeDelayCount' }], dimensions: [{ dimensionId: 'hour' }], filters: [] }, layout: { width: 6, minHeight: 300 } },
    { id: 'delay-cause-airport', type: 'table', title: '机场延误原因明细', description: '按机场和主延误原因汇总延误分钟数。', query: { datasetId: 'aviation_ontime_demo', metrics: [{ metricId: 'delayMinutes' }], dimensions: [{ dimensionId: 'airport' }, { dimensionId: 'delayCause' }], filters: [{ dimensionId: 'delayCause', operator: 'neq', value: 'none' }], limit: 30, orderBy: { fieldId: 'delayMinutes', direction: 'desc' } }, layout: { width: 12, minHeight: 340 } },
    { id: 'flight-details', type: 'table', title: '航班明细', description: '列出当前筛选范围内的代表性航班记录。', query: { datasetId: 'aviation_ontime_demo', metrics: [{ metricId: 'averageDepartureDelay' }], dimensions: [{ dimensionId: 'flightId' }, { dimensionId: 'airport' }, { dimensionId: 'destination' }, { dimensionId: 'carrier' }, { dimensionId: 'hour' }, { dimensionId: 'delayCause' }], filters: [], limit: 12 }, layout: { width: 12, minHeight: 340 } }
  ]
};
