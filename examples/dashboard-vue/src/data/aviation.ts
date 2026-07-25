import type { DatasetDefinition, FlightRecord, MetricDefinition, PanelConfig, QuerySpec } from '../model/types';

export const aviationDataset: DatasetDefinition = {
  id: 'aviation_ontime_demo',
  name: 'Flight operations delay analysis',
  description: 'A fixed, deterministic flight-delay fixture shaped after public on-time performance fields.',
  sourceLabel: 'Deterministic demo fixture; not live operations data',
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
    { id: 'direction', label: '航班方向', description: '当前专题支持出港和到港视角。', field: 'direction', dataType: 'string', semanticType: 'category' },
    { id: 'delayCause', label: '延误原因', description: '主延误原因分类。', field: 'delayCause', dataType: 'string', semanticType: 'category' },
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
};

function flight(
  flightId: string,
  date: string,
  hour: number,
  origin: string,
  destination: string,
  carrier: string,
  depDelay: number,
  arrDelay: number,
  taxiOut: number,
  delayCause: FlightRecord['delayCause'],
  delayMinutes = depDelay
): FlightRecord {
  return {
    flightId,
    date,
    hour,
    origin,
    destination,
    carrier,
    direction: 'departure',
    depDelay,
    arrDelay,
    taxiOut,
    cancelled: depDelay >= 120,
    diverted: depDelay === 0 && arrDelay >= 90,
    delayCause,
    delayMinutes
  };
}

// Fixed values are intentionally committed for reproducible demos; they are not live or randomly generated.
const departureFlights: FlightRecord[] = [
  flight('AA-101', '2025-07-01', 6, 'JFK', 'LAX', 'AA', 4, 2, 21, 'none', 0),
  flight('DL-202', '2025-07-01', 7, 'JFK', 'ATL', 'DL', 9, 6, 24, 'none', 0),
  flight('UA-303', '2025-07-01', 8, 'EWR', 'ORD', 'UA', 18, 16, 28, 'nas', 18),
  flight('B6-404', '2025-07-01', 9, 'JFK', 'BOS', 'B6', 27, 25, 31, 'carrier', 27),
  flight('AA-105', '2025-07-01', 10, 'LGA', 'DFW', 'AA', 12, 8, 19, 'none', 0),
  flight('DL-206', '2025-07-01', 11, 'JFK', 'MSP', 'DL', 33, 28, 34, 'weather', 33),
  flight('UA-307', '2025-07-01', 12, 'EWR', 'DEN', 'UA', 7, 4, 20, 'none', 0),
  flight('B6-408', '2025-07-01', 13, 'JFK', 'MCO', 'B6', 44, 39, 36, 'carrier', 44),
  flight('AA-109', '2025-07-01', 14, 'LGA', 'ORD', 'AA', 15, 12, 26, 'nas', 15),
  flight('DL-210', '2025-07-01', 15, 'JFK', 'SFO', 'DL', 52, 48, 39, 'weather', 52),
  flight('UA-311', '2025-07-01', 16, 'EWR', 'IAH', 'UA', 22, 19, 29, 'nas', 22),
  flight('B6-412', '2025-07-01', 17, 'JFK', 'SEA', 'B6', 66, 61, 43, 'carrier', 66),
  flight('AA-113', '2025-07-01', 18, 'JFK', 'CLT', 'AA', 81, 74, 49, 'weather', 81),
  flight('DL-214', '2025-07-01', 18, 'LGA', 'ATL', 'DL', 73, 69, 46, 'nas', 73),
  flight('UA-315', '2025-07-01', 19, 'EWR', 'ORD', 'UA', 104, 98, 55, 'carrier', 104),
  flight('B6-416', '2025-07-01', 20, 'JFK', 'BOS', 'B6', 92, 86, 52, 'weather', 92),
  flight('AA-117', '2025-07-01', 21, 'LGA', 'MIA', 'AA', 38, 31, 35, 'nas', 38),
  flight('DL-218', '2025-07-01', 22, 'JFK', 'LAX', 'DL', 17, 12, 27, 'none', 0),
  flight('UA-319', '2025-07-02', 6, 'EWR', 'DEN', 'UA', 5, 3, 22, 'none', 0),
  flight('B6-420', '2025-07-02', 7, 'JFK', 'BOS', 'B6', 11, 8, 24, 'none', 0),
  flight('AA-121', '2025-07-02', 8, 'LGA', 'DFW', 'AA', 21, 18, 28, 'nas', 21),
  flight('DL-222', '2025-07-02', 9, 'JFK', 'ATL', 'DL', 29, 23, 31, 'carrier', 29),
  flight('UA-323', '2025-07-02', 10, 'EWR', 'ORD', 'UA', 8, 5, 20, 'none', 0),
  flight('B6-424', '2025-07-02', 11, 'JFK', 'MCO', 'B6', 35, 30, 35, 'weather', 35),
  flight('AA-125', '2025-07-02', 12, 'LGA', 'ORD', 'AA', 14, 11, 25, 'nas', 14),
  flight('DL-226', '2025-07-02', 13, 'JFK', 'SFO', 'DL', 48, 42, 38, 'carrier', 48),
  flight('UA-327', '2025-07-02', 14, 'EWR', 'IAH', 'UA', 19, 15, 27, 'none', 0),
  flight('B6-428', '2025-07-02', 15, 'JFK', 'SEA', 'B6', 57, 51, 41, 'weather', 57),
  flight('AA-129', '2025-07-02', 16, 'LGA', 'MIA', 'AA', 24, 18, 30, 'nas', 24),
  flight('DL-230', '2025-07-02', 17, 'JFK', 'MSP', 'DL', 69, 62, 45, 'carrier', 69),
  flight('UA-331', '2025-07-02', 18, 'EWR', 'ORD', 'UA', 88, 79, 50, 'weather', 88),
  flight('B6-432', '2025-07-02', 19, 'JFK', 'BOS', 'B6', 76, 70, 47, 'carrier', 76),
  flight('AA-133', '2025-07-02', 20, 'LGA', 'ATL', 'AA', 43, 37, 36, 'nas', 43),
  flight('DL-234', '2025-07-02', 21, 'JFK', 'LAX', 'DL', 31, 25, 32, 'none', 0),
  flight('UA-335', '2025-07-02', 22, 'EWR', 'DEN', 'UA', 10, 7, 23, 'none', 0)
];

// The arrival view is derived from the same fixed records, using arrival delay as its active delay measure.
export const aviationFlights: FlightRecord[] = departureFlights.flatMap((record) => [
  record,
  { ...record, flightId: `${record.flightId}-ARR`, direction: 'arrival', depDelay: record.arrDelay }
]);

export const defaultAviationQueries: Record<string, QuerySpec> = {
  totalFlights: { datasetId: aviationDataset.id, metrics: [{ metricId: 'flightCount' }], dimensions: [], filters: [] },
  onTimeRate: { datasetId: aviationDataset.id, metrics: [{ metricId: 'onTimeRate' }], dimensions: [], filters: [] },
  averageDelay: { datasetId: aviationDataset.id, metrics: [{ metricId: 'averageDepartureDelay' }], dimensions: [], filters: [] },
  cancellationRate: { datasetId: aviationDataset.id, metrics: [{ metricId: 'cancellationRate' }], dimensions: [], filters: [] }
};

export const aviationPanelTemplates: PanelConfig[] = [
  {
    id: 'carrier-delay-template',
    type: 'bar',
    title: '航空公司平均出港延误',
    description: '比较当前筛选范围内不同航空公司的平均出港延误。',
    query: { datasetId: aviationDataset.id, metrics: [{ metricId: 'averageDepartureDelay' }], dimensions: [{ dimensionId: 'carrier' }], filters: [] },
    visualization: { showLabels: true },
    layout: { width: 6, minHeight: 300 }
  },
  {
    id: 'airport-p95-template',
    type: 'bar',
    title: '机场 P95 延误排名',
    description: '比较机场尾部延误风险。',
    query: { datasetId: aviationDataset.id, metrics: [{ metricId: 'p95DepartureDelay' }], dimensions: [{ dimensionId: 'airport' }], filters: [] },
    visualization: { showLabels: true },
    layout: { width: 6, minHeight: 300 }
  }
];

export const defaultAviationPanels: PanelConfig[] = [
  { id: 'flight-count', type: 'metric', title: '航班数量', description: '当前筛选范围内的航班数量。', query: defaultAviationQueries.totalFlights, layout: { width: 3, minHeight: 148 } },
  { id: 'on-time-rate', type: 'metric', title: '准点率', description: '出港延误不超过 15 分钟的航班占比。', query: defaultAviationQueries.onTimeRate, layout: { width: 3, minHeight: 148 } },
  { id: 'average-delay', type: 'metric', title: '平均出港延误', description: '当前筛选范围内的平均出港延误分钟数。', query: defaultAviationQueries.averageDelay, layout: { width: 3, minHeight: 148 } },
  { id: 'cancellation-rate', type: 'metric', title: '取消率', description: '当前筛选范围内的取消航班比例。', query: defaultAviationQueries.cancellationRate, layout: { width: 3, minHeight: 148 } },
  {
    id: 'airport-status', type: 'airport-status', title: '机场运行状态', description: '按机场比较当前准点率和平均延误。',
    query: { datasetId: aviationDataset.id, metrics: [{ metricId: 'onTimeRate' }, { metricId: 'averageDepartureDelay' }], dimensions: [{ dimensionId: 'airport' }], filters: [] }, layout: { width: 6, minHeight: 330 }
  },
  {
    id: 'hourly-on-time', type: 'line', title: '每小时准点率趋势', description: '识别晚高峰准点率变化和异常时间段。',
    query: { datasetId: aviationDataset.id, metrics: [{ metricId: 'onTimeRate' }], dimensions: [{ dimensionId: 'hour' }], filters: [] }, layout: { width: 6, minHeight: 330 }
  },
  {
    id: 'airport-ranking', type: 'bar', title: '机场平均延误排名', description: '按机场比较平均出港延误。',
    query: { datasetId: aviationDataset.id, metrics: [{ metricId: 'averageDepartureDelay' }], dimensions: [{ dimensionId: 'airport' }], filters: [] }, visualization: { showLabels: true }, layout: { width: 4, minHeight: 300 }
  },
  {
    id: 'delay-causes', type: 'donut', title: '延误原因构成', description: '查看当前范围内不同原因贡献的延误分钟数。',
    query: { datasetId: aviationDataset.id, metrics: [{ metricId: 'delayMinutes' }], dimensions: [{ dimensionId: 'delayCause' }], filters: [{ dimensionId: 'delayCause', operator: 'neq', value: 'none' }] }, layout: { width: 4, minHeight: 300 }
  },
  {
    id: 'carrier-ranking', type: 'bar', title: '航空公司准点率', description: '比较航空公司在当前筛选范围内的准点率。',
    query: { datasetId: aviationDataset.id, metrics: [{ metricId: 'onTimeRate' }], dimensions: [{ dimensionId: 'carrier' }], filters: [] }, visualization: { showLabels: true }, layout: { width: 4, minHeight: 300 }
  },
  {
    id: 'delay-timeline', type: 'timeline', title: '严重延误时间线', description: '按小时显示严重延误航班数量。',
    query: { datasetId: aviationDataset.id, metrics: [{ metricId: 'severeDelayCount' }], dimensions: [{ dimensionId: 'hour' }], filters: [] }, layout: { width: 6, minHeight: 300 }
  },
  {
    id: 'flight-details', type: 'table', title: '航班明细', description: '列出当前筛选范围内的代表性航班记录。',
    query: { datasetId: aviationDataset.id, metrics: [{ metricId: 'averageDepartureDelay' }], dimensions: [{ dimensionId: 'flightId' }, { dimensionId: 'airport' }, { dimensionId: 'destination' }, { dimensionId: 'carrier' }, { dimensionId: 'hour' }, { dimensionId: 'delayCause' }], filters: [], limit: 12 }, layout: { width: 12, minHeight: 340 }
  }
];

export const aviationSourceManifest = {
  datasetId: aviationDataset.id,
  sourceType: 'curated_demo_fixture',
  provider: 'EnchantForge example project',
  license: 'Fixture values are committed for demonstration; not a live operational feed.',
  retrievedAt: '2026-07-25',
  limitations: ['The fixture is deterministic and intentionally small.', 'It does not represent current airport operations.', 'BTS download and checksum workflow remains TODO.']
};

export const metricById = new Map<string, MetricDefinition>(aviationDataset.metrics.map((metric) => [metric.id, metric]));
