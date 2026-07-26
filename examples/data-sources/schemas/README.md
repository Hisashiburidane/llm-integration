# Data domain schemas

`dashboard-vue` 不包含专题查询逻辑。Node 服务扫描本目录，每个一级目录对应一个数据域：

```text
schemas/
├── aviation/
│   ├── domain.mjs
│   └── queries/
│       └── aviation_ontime_demo.mjs
├── air-quality/
├── nyc-taxi/
└── otel/
    ├── domain.mjs
    └── queries/
        ├── otel_service_demo.mjs
        ├── otel_edge_demo.mjs
        ├── otel_log_demo.mjs
        └── otel_metric_demo.mjs
```

服务不维护目录名或数据集 ID 列表。新增目录后，`schema-registry.mjs` 会加载其中的 `domain.mjs` 和 `queries/*.mjs`。

## Domain

`domain.mjs` 默认导出一个数据域，负责业务语义和初始化资产：

```js
export default {
  id: 'orders',
  topicId: 'commerce',
  title: 'Order Operations',
  description: '订单分析数据域。',
  sourceManifest: { provider: 'internal', sourceType: 'sqlite' },
  dataset: {
    id: 'orders',
    name: 'Orders',
    description: '订单语义模型。',
    sourceLabel: 'SQLite order_daily_rollup',
    entities: [],
    dimensions: [
      { id: 'date', label: '日期', field: 'order_date', dataType: 'date', semanticType: 'time', description: '下单日期。' }
    ],
    metrics: [
      { id: 'orderCount', label: '订单数', aggregation: 'sum', format: 'integer', supportedDimensions: ['date'], description: '订单数量。' }
    ],
    relations: []
  },
  filterDefinitions: [],
  evidenceGroups: [],
  assistantPrompt: '',
  suggestions: [],
  panelTemplates: [],
  panels: []
};
```

`dataset` 是给 Panel 编辑器、Dashboard 元数据和 LLM 使用的语义描述。`panels`、`panelTemplates` 只用于 `config:reset` 初始化 SQLite 中的可编辑资产，并不是平台内置只读 Dashboard。

## Query model

`queries/*.mjs` 每个文件默认导出一个查询模型。`id` 对应 QuerySpec 的 `datasetId`：

```js
export default {
  id: 'orders',
  title: 'Orders',
  sources: [
    {
      id: 'daily-rollup',
      table: 'order_daily_rollup',
      from: 'order_daily_rollup AS source',
      dimensions: {
        date: 'source.order_date',
        region: {
          sql: 'source.region_code',
          labelSql: 'source.region_name'
        }
      },
      metrics: {
        orderCount: 'SUM(source.order_count)',
        averageAmount: 'SUM(source.amount_sum) / NULLIF(SUM(source.order_count), 0)',
        p95Amount: {
          type: 'percentile',
          field: 'source.amount',
          percentile: 95
        }
      },
      rowCountSql: 'SUM(source.order_count)'
    }
  ],
  facets: [
    { id: 'regions', dimensionId: 'region' }
  ]
};
```

字段含义：

- `sources` 按顺序声明候选源，通常先写预聚合表，再写明细表。
- `table` 用于启动时检查表是否存在且有数据。
- `from` 是受信任的 schema SQL，可以写表、子查询和字典 `JOIN`；最外层别名必须是 `source`。
- `dimensions` 的字符串值是 SQL 表达式；对象形式的 `sql` 保留筛选代码，`labelSql` 返回可读名称。
- `metrics` 的字符串值是聚合表达式；对象形式目前支持通用 `percentile`。
- `rowCountSql` 计算筛选范围覆盖的明细或等价业务记录数。
- `facets` 通过维度声明筛选选项，不需要在服务中另写 SQL。

查询引擎按 `sources` 顺序选择第一个“表可用且包含请求全部指标、维度和筛选字段”的 source。预聚合表处理常用查询，需要明细字段或 P95 的请求自动落到兼容的明细 source。

## Query variables

客户端只提交结构化变量，不提交 SQL：

```json
{
  "datasetId": "orders",
  "metrics": [{ "metricId": "orderCount" }],
  "dimensions": [{ "dimensionId": "region" }],
  "filters": [
    { "dimensionId": "date", "operator": "between", "value": ["2026-01-01", "2026-01-31"] }
  ],
  "orderBy": { "fieldId": "orderCount", "direction": "desc" },
  "limit": 20
}
```

支持的筛选操作符为 `eq`、`neq`、`in`、`between`、`gte`、`lte`。`limit` 范围是 1-100。指标、维度、排序字段和结果 alias 必须在 schema 或查询结果中存在；过滤值由服务转义。SQL 表达式只能来自本地受信任 schema。

## Service API

- `GET /api/data-domains`：列出数据域摘要。
- `GET /api/data-domains/:id`：返回数据集语义、查询数据源、指标和筛选定义。
- `POST /api/dashboard/query`：执行一个 QuerySpec。
- `POST /api/dashboard/query-batch`：批量执行最多 24 个 QuerySpec。

默认扫描本目录。可通过 `DASHBOARD_SCHEMA_DIR=/absolute/path/to/schemas` 指向另一套 schema。
