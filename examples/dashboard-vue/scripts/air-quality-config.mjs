export const airQualityDashboard = {
  id: 'air-quality-operations',
  topicId: 'air-quality',
  title: 'Beijing Air Quality / Pollution Monitoring',
  description: '基于北京多站点小时观测数据的污染物与气象条件分析。',
  sourceManifest: {
    datasetId: 'beijing_air_quality_demo',
    sourceType: 'sqlite',
    provider: 'UCI Machine Learning Repository',
    license: 'CC BY 4.0',
    retrievedAt: '2026-07',
    limitations: ['源数据覆盖 2013-03 至 2017-02。', '污染物缺失值保留为空，不以零替代。', 'Panel 查询使用日期 × 监测站物化聚合表。']
  },
  filterDefinitions: [
    { id: 'date', dimensionId: 'date', operator: 'between', defaultValue: ['2016-01-01', '2017-02-28'] },
    { id: 'station', dimensionId: 'station', operator: 'eq', defaultValue: 'ALL', allValue: 'ALL', facetKey: 'stations' }
  ],
  assistantPrompt: '你是 Air Quality Assistant。回答问题前必须调用 dashboard.read_data；涉及站点比较使用 aq-station-ranking，涉及趋势使用 aq-pm25-trend，需要强调证据时调用 dashboard.highlight。必须说明监测站名称、日期范围和指标单位。',
  suggestions: ['哪个监测站的 PM2.5 最高？', 'PM2.5 在当前日期范围如何变化？', '比较主要污染物的平均浓度。', '查看温度和降雨背景。'],
  dataset: {
    id: 'beijing_air_quality_demo',
    name: 'Beijing multi-site air quality',
    description: '北京多站点小时空气质量和气象观测的日级聚合。',
    sourceLabel: 'SQLite air_quality_dashboard_rollup; UCI Beijing Multi-Site Air Quality',
    entities: [
      { id: 'station', label: '监测站', description: '北京空气质量监测站。', idField: 'station', displayField: 'station' }
    ],
    dimensions: [
      { id: 'date', label: '日期', description: '观测日期。', field: 'observed_date', dataType: 'date', semanticType: 'time' },
      { id: 'station', label: '监测站', description: '观测所属监测站。', field: 'station', dataType: 'string', semanticType: 'entity' }
    ],
    metrics: [
      { id: 'observationCount', label: '观测次数', description: '日期和监测站范围内的有效小时观测数。', aggregation: 'count', format: 'integer', supportedDimensions: ['date', 'station'] },
      { id: 'stationCount', label: '监测站数量', description: '当前查询范围内有有效观测记录的监测站数量。', aggregation: 'count', format: 'integer', supportedDimensions: [] },
      { id: 'pm25Average', label: 'PM2.5 日均浓度', description: 'PM2.5 的日平均浓度，单位 µg/m³。', aggregation: 'avg', unit: 'µg/m³', format: 'decimal', supportedDimensions: ['date', 'station'] },
      { id: 'pm25Peak', label: 'PM2.5 日最高浓度', description: 'PM2.5 的日内最高观测值，单位 µg/m³。', aggregation: 'max', unit: 'µg/m³', format: 'decimal', supportedDimensions: ['date', 'station'] },
      { id: 'pm10Average', label: 'PM10 日均浓度', description: 'PM10 的日平均浓度，单位 µg/m³。', aggregation: 'avg', unit: 'µg/m³', format: 'decimal', supportedDimensions: ['date', 'station'] },
      { id: 'no2Average', label: 'NO₂ 日均浓度', description: '二氧化氮日平均浓度。', aggregation: 'avg', unit: 'µg/m³', format: 'decimal', supportedDimensions: ['date', 'station'] },
      { id: 'so2Average', label: 'SO₂ 日均浓度', description: '二氧化硫日平均浓度。', aggregation: 'avg', unit: 'µg/m³', format: 'decimal', supportedDimensions: ['date', 'station'] },
      { id: 'o3Average', label: 'O₃ 日均浓度', description: '臭氧日平均浓度。', aggregation: 'avg', unit: 'µg/m³', format: 'decimal', supportedDimensions: ['date', 'station'] },
      { id: 'temperatureAverage', label: '日均温度', description: '监测站日平均温度。', aggregation: 'avg', unit: '°C', format: 'decimal', supportedDimensions: ['date', 'station'] },
      { id: 'rainTotal', label: '日累计降雨', description: '监测站日累计降雨量。', aggregation: 'sum', unit: 'mm', format: 'decimal', supportedDimensions: ['date', 'station'] }
    ],
    relations: []
  },
  panelTemplates: [
    { id: 'aq-station-pm25-template', type: 'bar', title: '监测站 PM2.5 排名', description: '比较各监测站的 PM2.5 日均浓度。', query: { datasetId: 'beijing_air_quality_demo', metrics: [{ metricId: 'pm25Average' }], dimensions: [{ dimensionId: 'station' }], filters: [] }, visualization: { showLabels: true }, layout: { width: 6, minHeight: 300 } }
  ],
  panels: [
    { id: 'aq-pm25-average', type: 'metric', title: 'PM2.5 日均浓度', description: '当前日期范围内各监测站 PM2.5 日均浓度的平均值。', query: { datasetId: 'beijing_air_quality_demo', metrics: [{ metricId: 'pm25Average' }], dimensions: [], filters: [] }, layout: { width: 3, minHeight: 148 } },
    { id: 'aq-pm25-peak', type: 'metric', title: 'PM2.5 峰值', description: '当前日期范围内的 PM2.5 日最高浓度。', query: { datasetId: 'beijing_air_quality_demo', metrics: [{ metricId: 'pm25Peak' }], dimensions: [], filters: [] }, layout: { width: 3, minHeight: 148 } },
    { id: 'aq-observation-count', type: 'metric', title: '有效观测次数', description: '当前查询范围内保留的有效小时观测数。', query: { datasetId: 'beijing_air_quality_demo', metrics: [{ metricId: 'observationCount' }], dimensions: [], filters: [] }, layout: { width: 3, minHeight: 148 } },
    { id: 'aq-station-count', type: 'metric', title: '监测站数量', description: '当前查询范围内有观测记录的监测站数量。', query: { datasetId: 'beijing_air_quality_demo', metrics: [{ metricId: 'stationCount' }], dimensions: [], filters: [] }, layout: { width: 3, minHeight: 148 } },
    { id: 'aq-pm25-trend', type: 'line', title: 'PM2.5 日均趋势', description: '观察日期范围内 PM2.5 日均浓度变化。', query: { datasetId: 'beijing_air_quality_demo', metrics: [{ metricId: 'pm25Average' }], dimensions: [{ dimensionId: 'date' }], filters: [], limit: 100 }, visualization: { showLabels: false }, layout: { width: 8, minHeight: 330 } },
    { id: 'aq-station-ranking', type: 'bar', title: '监测站 PM2.5 排名', description: '比较当前日期范围内各监测站的 PM2.5 日均浓度。', query: { datasetId: 'beijing_air_quality_demo', metrics: [{ metricId: 'pm25Average' }], dimensions: [{ dimensionId: 'station' }], filters: [], limit: 20 }, visualization: { showLabels: true }, layout: { width: 4, minHeight: 330 } },
    { id: 'aq-pollutant-profile', type: 'bar', title: '主要污染物概览', description: '比较 PM2.5、PM10、NO₂、SO₂ 和 O₃ 的平均浓度。', query: { datasetId: 'beijing_air_quality_demo', metrics: [{ metricId: 'pm25Average' }, { metricId: 'pm10Average' }, { metricId: 'no2Average' }, { metricId: 'so2Average' }, { metricId: 'o3Average' }], dimensions: [], filters: [] }, layout: { width: 6, minHeight: 300 } },
    { id: 'aq-weather-context', type: 'line', title: '温度与降雨背景', description: '查看温度和降雨变化，为污染物波动提供气象背景。', query: { datasetId: 'beijing_air_quality_demo', metrics: [{ metricId: 'temperatureAverage' }, { metricId: 'rainTotal' }], dimensions: [{ dimensionId: 'date' }], filters: [], limit: 100 }, layout: { width: 6, minHeight: 300 } },
    { id: 'aq-observation-quality', type: 'table', title: '监测站观测覆盖', description: '检查各监测站在当前范围内的有效观测数量。', query: { datasetId: 'beijing_air_quality_demo', metrics: [{ metricId: 'observationCount' }, { metricId: 'pm25Average' }], dimensions: [{ dimensionId: 'station' }], filters: [], limit: 20 }, layout: { width: 12, minHeight: 340 } }
  ]
};
