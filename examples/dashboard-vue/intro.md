# EnchantForge AI 原生 Dashboard 示例系统开发指引

## 1. Agent 角色

你负责设计并实现一套简易但结构完整的数据可视化 Dashboard 系统，并将其与 EnchantForge 集成。

EnchantForge 是一个面向 Vue 应用的人工智能交互运行时。它使模型能够读取当前页面的结构化语义和运行状态，并在明确约束下操作当前页面中的组件实例。

本项目不是为了开发完整的商业智能产品，也不是为了单纯展示若干漂亮图表。项目的核心目标是通过多个跨行业专题证明以下设计思想：

1. 人工智能可以理解当前页面，而不只是读取页面截图或文档对象模型。
2. 人工智能可以操作当前运行中的组件实例，而不只是调用几个与页面无关的后端函数。
3. 人工智能可以完成多步骤数据分析，并将分析过程反映到当前页面。
4. 人工智能可以创建、修改、组合和保存 Panel 与 Dashboard。
5. 所有操作均受到能力白名单、参数校验、状态约束和操作记录机制的控制。
6. 同一套框架可以迁移到不同数据模型、行业和可视化组件中。

---

# 2. 项目目标

实现一套可运行的单页应用，至少具备以下内容：

* 一套可配置的数据集语义模型；
* 一套统一的查询描述模型；
* 一组标准可视化 Panel；
* 一套 Dashboard 布局与状态管理机制；
* 一套 Panel 与 Dashboard 能力注册机制；
* 一套 EnchantForge 页面上下文暴露机制；
* 一套人工智能操作记录和状态变化展示机制；
* 至少两个完整专题；
* 至少一个能够证明复杂分析能力的技术专题；
* 使用真实开放数据、研究数据或从开源系统实际采集的数据。

首个完整专题应优先实现“航班运行与延误分析”。后续专题根据开发成本依次考虑：

1. 电商用户转化或零售交易分析；
2. 云原生微服务故障调查；
3. 城市空气质量分析；
4. 城市出行分析；
5. 设备健康与预测性维护；
6. 网络安全事件调查。

不得同时粗略开发大量专题。应先完成一个从数据、语义、查询、Panel、Dashboard 到 EnchantForge 操作的完整闭环，再复用架构扩展其他专题。

---

# 3. 项目非目标

本项目首版不要求实现以下内容：

* 完整的数据仓库；
* 完整的企业权限系统；
* 多租户管理；
* 复杂报表设计器；
* 大规模实时流计算；
* 完整的拖拽式低代码平台；
* 任意第三方组件在线上传和执行；
* 完整自然语言转结构化查询产品；
* 复杂商业智能计算语言；
* 精细的移动端适配；
* 大量装饰性动画；
* 生产级高可用部署；
* 覆盖所有 ECharts 图表类型。

首版应优先证明架构和交互模型，不应将主要开发时间消耗在视觉装饰、账户系统和外围管理功能上。

---

# 4. 核心设计原则

## 4.1 页面必须具有语义

模型不能只知道页面中存在一个折线图或柱状图。

每个 Panel 必须提供：

* Panel 标识；
* Panel 名称；
* 业务描述；
* 当前指标；
* 当前维度；
* 当前筛选条件；
* 当前时间范围；
* 当前查询结果摘要；
* 当前选择状态；
* 当前异常状态；
* 可调用能力；
* 能力参数定义；
* 与其他 Panel 的联动关系。

示例：

```typescript
interface PanelSemanticContext {
  panelId: string
  title: string
  description: string

  datasetId: string
  metrics: string[]
  dimensions: string[]

  filters: FilterCondition[]
  timeRange?: TimeRange

  selectedEntities: EntityReference[]
  resultSummary: ResultSummary

  capabilities: CapabilityDescription[]
  relations: PanelRelation[]
}
```

模型应看到：

```text
当前 Panel 用于展示各机场每小时出港准点率。

当前日期：2025-07-01
当前机场：JFK
当前方向：出港
当前时间粒度：小时

检测到的异常：
18:00 至 21:00 的准点率低于当日基线。

可用操作：
- 修改时间范围
- 选择机场
- 修改航班方向
- 切换指标
- 按航空公司下钻
- 高亮异常时间段
```

模型不应只看到：

```text
当前存在一个 ECharts 折线图。
```

---

## 4.2 模型操作的是当前组件实例

Panel 中注册的能力必须绑定到当前运行实例。

例如页面存在两个航班趋势 Panel：

```text
panel: airport-delay-trend
panel: airline-delay-trend
```

模型调用能力时必须明确寻址：

```typescript
invokeCapability({
  targetId: "airport-delay-trend",
  capability: "setTimeRange",
  arguments: {
    start: "18:00",
    end: "21:00"
  }
})
```

禁止使用无法确定目标实例的模糊调用：

```typescript
setTimeRange("18:00", "21:00")
```

---

## 4.3 模型不得直接执行任意代码

模型不得：

* 执行 `eval`；
* 生成并执行任意 JavaScript；
* 直接连接数据库；
* 直接提交未经校验的原始查询；
* 修改未注册的组件状态；
* 绕过权限或业务校验；
* 修改系统内部配置；
* 动态加载未审核的第三方脚本。

模型只能：

1. 读取允许暴露的语义上下文；
2. 调用注册过的能力；
3. 提交结构化参数；
4. 由运行时校验参数；
5. 由业务组件实际执行操作。

---

## 4.4 数据结论必须可追溯

模型生成分析结论时，应引用：

* 数据集；
* Panel；
* 指标；
* 时间范围；
* 维度；
* 筛选条件；
* 查询结果；
* 具体数据对象。

例如：

```text
根据“机场出港准点率趋势”Panel，
JFK 在 18:00 至 21:00 的平均准点率为 61.4%，
低于当日其他时段的 78.7%。

“滑出时间趋势”Panel 显示，
同一时间段平均滑出时间由 18.2 分钟增加到 32.6 分钟。
```

不得生成缺乏数据依据的原因判断。

如数据只能证明相关性，应使用：

* 同期发生；
* 具有明显相关性；
* 可能有关；
* 需要进一步验证。

不得将相关性描述成确定因果关系。

---

# 5. 推荐技术架构

## 5.1 前端

默认采用：

* Vue 3；
* TypeScript；
* Vite；
* ECharts；
* Vue Router；
* Pinia 或等价的集中状态管理方案；
* CSS Grid 作为 Dashboard 布局基础。

前端主要负责：

* Dashboard 渲染；
* Panel 生命周期；
* Panel 状态；
* 联动交互；
* 能力注册；
* 页面语义生成；
* EnchantForge 集成；
* Trace 展示。

除非现有项目已使用其他方案，不应为了功能简单而引入大型前端组件库。

---

## 5.2 数据处理

建议使用：

* Python 进行原始数据下载和预处理；
* DuckDB 进行本地分析查询；
* Parquet 作为主要分析数据文件格式；
* FastAPI 提供轻量查询服务。

Structured Query Language（结构化查询语言，SQL，用于执行结构化数据的筛选、聚合和排序）只能由后端查询编译器生成。

模型和前端不应直接提交任意 SQL。

查询流程：

```text
Panel QuerySpec
→ 参数校验
→ 语义字段解析
→ SQL 编译
→ DuckDB 执行
→ 标准结果返回
```

---

## 5.3 推荐目录结构

```text
project/
├─ apps/
│  ├─ dashboard-web/
│  └─ query-service/
│
├─ packages/
│  ├─ dashboard-core/
│  ├─ panel-runtime/
│  ├─ semantic-model/
│  ├─ query-model/
│  ├─ enchantforge-adapter/
│  └─ topic-sdk/
│
├─ topics/
│  ├─ aviation/
│  ├─ ecommerce/
│  ├─ cloud-observability/
│  └─ air-quality/
│
├─ data/
│  ├─ raw/
│  ├─ processed/
│  ├─ manifests/
│  └─ scripts/
│
├─ docs/
│  ├─ architecture.md
│  ├─ semantic-model.md
│  ├─ capability-model.md
│  ├─ data-sources.md
│  ├─ demo-scenarios.md
│  └─ decisions/
│
└─ tests/
```

如果当前仓库已有合理结构，应在现有结构上集成，不得仅为了匹配本文而进行大规模迁移。

---

# 6. 数据来源和数据治理

## 6.1 允许的数据来源

专题数据只能来自以下来源：

1. 政府或公共机构开放数据；
2. 公开研究数据集；
3. 具有明确许可的开源数据集；
4. 运行开源系统后实际采集的数据；
5. 根据公开原始数据确定性计算出的衍生数据；
6. 明确标注为模拟或合成的数据。

不得将随机生成的数据伪装成真实业务数据。

---

## 6.2 数据清单

每个专题必须包含一个数据来源清单：

```yaml
dataset_id: aviation_ontime
name: US Airline On-Time Performance
source_type: public_open_data
provider: Bureau of Transportation Statistics
license: public-domain-or-provider-terms
retrieved_at: 2026-07-01

original_files:
  - name: ontime_2025_07.zip
    checksum: ...

transformations:
  - normalize_airport_code
  - derive_departure_hour
  - derive_on_time_flag
  - derive_delay_bucket

limitations:
  - data does not represent live operations
  - delay causes may be missing for some flights
  - historical data is used for demonstration
```

数据清单至少应记录：

* 数据集名称；
* 数据提供方；
* 数据下载时间；
* 数据许可；
* 原始文件；
* 文件校验值；
* 清洗脚本；
* 衍生字段；
* 数据时间范围；
* 已知限制；
* 是否为真实、实验、仿真或合成数据。

---

## 6.3 衍生字段

允许根据原始数据计算：

* 日期；
* 小时；
* 工作日；
* 时间区间；
* 准点标记；
* 延误等级；
* 转化率；
* 环比；
* 同比；
* 滚动平均；
* 百分位数；
* 异常分数；
* 排名；
* 对比基线。

所有衍生字段必须在语义模型中说明计算逻辑。

示例：

```typescript
{
  id: "onTimeRate",
  label: "准点率",
  description: "实际出港延误不超过 15 分钟的航班占比",
  type: "ratio",
  numerator: "onTimeFlightCount",
  denominator: "departureFlightCount",
  format: "percentage"
}
```

---

# 7. 统一语义模型

## 7.1 数据集定义

```typescript
interface DatasetDefinition {
  id: string
  name: string
  description: string

  timeField?: string

  entities: EntityDefinition[]
  dimensions: DimensionDefinition[]
  metrics: MetricDefinition[]
  relations: RelationDefinition[]

  defaultTimeRange?: TimeRange
  supportedGranularities?: TimeGranularity[]
}
```

---

## 7.2 实体

实体用于表示具有独立身份、可以被选择和下钻的业务对象。

例如：

* 航班；
* 机场；
* 航空公司；
* 商品；
* 用户；
* 服务；
* Pod；
* 城市；
* 监测站。

```typescript
interface EntityDefinition {
  id: string
  label: string
  description: string

  idField: string
  displayField: string

  attributes: EntityAttribute[]
  capabilities?: string[]
}
```

---

## 7.3 维度

维度用于分组、筛选和切分指标。

```typescript
interface DimensionDefinition {
  id: string
  label: string
  description: string

  field: string
  dataType: "string" | "number" | "date" | "datetime" | "boolean"

  semanticType?:
    | "category"
    | "time"
    | "geo"
    | "entity"
    | "status"
}
```

---

## 7.4 指标

```typescript
interface MetricDefinition {
  id: string
  label: string
  description: string

  sourceField?: string
  expression?: string

  aggregation:
    | "sum"
    | "avg"
    | "min"
    | "max"
    | "count"
    | "countDistinct"
    | "p50"
    | "p95"
    | "p99"
    | "ratio"

  unit?: string
  format?: string

  supportedDimensions: string[]
}
```

指标必须声明允许使用的维度，防止模型生成无意义的查询组合。

---

## 7.5 关系

```typescript
interface RelationDefinition {
  id: string
  label: string
  description: string

  sourceEntity: string
  targetEntity: string

  sourceField: string
  targetField: string

  relationType:
    | "one-to-one"
    | "one-to-many"
    | "many-to-many"
    | "directed-network"
}
```

关系用于支持：

* 地图流向；
* 服务拓扑；
* 航线网络；
* 用户与设备关系；
* 商品共同购买；
* 站点邻接关系。

---

# 8. 统一查询模型

Domain-Specific Language（领域专用语言，DSL，用于用受约束的结构描述查询和可视化配置）应采用 JSON 兼容的数据结构。

```typescript
interface QuerySpec {
  datasetId: string

  metrics: MetricQuery[]
  dimensions: DimensionQuery[]

  filters: FilterCondition[]
  timeRange?: TimeRange
  timeGranularity?: TimeGranularity

  orderBy?: OrderBy[]
  limit?: number

  comparison?: ComparisonSpec
}
```

示例：

```typescript
const query: QuerySpec = {
  datasetId: "aviation_ontime",

  metrics: [
    {
      metricId: "averageDepartureDelay",
      alias: "avgDelay"
    }
  ],

  dimensions: [
    {
      dimensionId: "airline"
    }
  ],

  filters: [
    {
      dimensionId: "airport",
      operator: "eq",
      value: "JFK"
    },
    {
      dimensionId: "departureHour",
      operator: "between",
      value: [18, 21]
    }
  ],

  orderBy: [
    {
      field: "avgDelay",
      direction: "desc"
    }
  ],

  limit: 10
}
```

后端必须校验：

* 数据集是否存在；
* 指标是否存在；
* 维度是否存在；
* 指标与维度是否兼容；
* 操作符是否适用于字段类型；
* 查询数量限制；
* 时间范围限制；
* 排序字段是否合法。

---

# 9. Panel 系统

## 9.1 首版 Panel 类型

首版只实现以下类型：

1. 指标卡；
2. 折线图；
3. 柱状图；
4. 构成图；
5. 数据表格；
6. 地图；
7. 漏斗；
8. 拓扑图；
9. 事件时间线。

并非所有专题都必须使用全部类型。

不得为了增加图表数量而实现缺乏明确业务用途的图表。

---

## 9.2 Panel 配置

```typescript
interface PanelConfig {
  id: string
  type: PanelType

  title: string
  description: string

  query: QuerySpec
  visualization: VisualizationConfig

  interactions: InteractionConfig[]
  capabilities: CapabilityConfig[]

  layout: PanelLayout
}
```

---

## 9.3 标准 Panel 能力

所有适用的 Panel 应尽量提供统一能力：

```typescript
interface StandardPanelCapabilities {
  setMetric?: Capability
  setDimension?: Capability
  setFilters?: Capability
  setTimeRange?: Capability
  setSort?: Capability
  setLimit?: Capability

  select?: Capability
  clearSelection?: Capability
  highlight?: Capability
  drillDown?: Capability

  changeVisualization?: Capability
  refresh?: Capability
  exportData?: Capability
}
```

地图可以扩展：

```typescript
interface MapCapabilities {
  selectRegion: Capability
  focusRegion: Capability
  toggleLayer: Capability
  fitBounds: Capability
}
```

拓扑图可以扩展：

```typescript
interface TopologyCapabilities {
  selectNode: Capability
  selectEdge: Capability
  expandDependencies: Capability
  isolatePath: Capability
  resetGraph: Capability
}
```

表格可以扩展：

```typescript
interface TableCapabilities {
  selectRow: Capability
  openDetail: Capability
  setVisibleColumns: Capability
}
```

---

# 10. Dashboard 系统

## 10.1 Dashboard 配置

```typescript
interface DashboardConfig {
  id: string
  topicId: string

  title: string
  description: string

  globalFilters: GlobalFilter[]
  panels: PanelConfig[]
  layout: DashboardLayout

  panelLinks: PanelLink[]
}
```

---

## 10.2 Dashboard 能力

```typescript
interface DashboardCapabilities {
  addPanel: Capability
  removePanel: Capability
  duplicatePanel: Capability

  movePanel: Capability
  resizePanel: Capability

  setGlobalFilter: Capability
  clearGlobalFilter: Capability

  linkPanels: Capability
  unlinkPanels: Capability

  saveView: Capability
  restoreView: Capability
  resetView: Capability
}
```

对于删除 Panel、重置 Dashboard 等操作，应支持撤销。

---

## 10.3 Panel 联动

至少支持以下联动方式：

* 地图选择区域后更新趋势和排名；
* 趋势选择时间范围后更新所有关联 Panel；
* 排名选择对象后更新明细；
* 拓扑选择节点后更新指标、日志和事件；
* 漏斗选择阶段后更新用户或订单列表。

联动关系必须通过配置描述，不得完全写死在组件内部。

```typescript
interface PanelLink {
  sourcePanelId: string
  sourceEvent: string

  targetPanelId: string
  targetAction: string

  parameterMapping: Record<string, string>
}
```

---

# 11. EnchantForge 集成

## 11.1 页面上下文

EnchantForge 应能够读取：

* 当前专题；
* 当前 Dashboard；
* 当前全局筛选；
* 当前时间范围；
* 当前 Panel 列表；
* 每个 Panel 的语义；
* 每个 Panel 的当前状态；
* 当前选择对象；
* 当前异常摘要；
* 可调用能力；
* 最近操作记录。

上下文应根据当前状态动态生成，不得在页面加载时生成一次后长期不更新。

---

## 11.2 能力描述

Application Programming Interface（应用程序编程接口，API，用于统一描述和调用组件能力）应以结构化方式暴露。

```typescript
interface CapabilityDescription {
  name: string
  targetId: string

  title: string
  description: string

  inputSchema: JsonSchema

  riskLevel:
    | "read"
    | "reversible-write"
    | "destructive-write"

  requiresConfirmation: boolean
}
```

示例：

```typescript
{
  name: "setTimeRange",
  targetId: "airport-delay-trend",

  title: "修改趋势图时间范围",
  description: "将机场延误趋势图缩放到指定时间范围",

  inputSchema: {
    type: "object",
    properties: {
      startHour: {
        type: "integer",
        minimum: 0,
        maximum: 23
      },
      endHour: {
        type: "integer",
        minimum: 0,
        maximum: 23
      }
    },
    required: ["startHour", "endHour"]
  },

  riskLevel: "reversible-write",
  requiresConfirmation: false
}
```

---

## 11.3 能力执行流程

```text
模型生成操作意图
→ EnchantForge 解析目标实例
→ 查找能力定义
→ 校验输入参数
→ 校验当前状态
→ 校验操作风险
→ 执行组件能力
→ 获取状态变化
→ 记录 Trace
→ 更新页面上下文
```

能力调用失败时，必须返回结构化错误：

```typescript
interface CapabilityError {
  code:
    | "TARGET_NOT_FOUND"
    | "CAPABILITY_NOT_FOUND"
    | "INVALID_ARGUMENT"
    | "STATE_CONFLICT"
    | "PERMISSION_DENIED"
    | "CONFIRMATION_REQUIRED"
    | "EXECUTION_FAILED"

  message: string
  details?: unknown
}
```

---

## 11.4 多步骤分析

模型应能够生成由多个能力调用组成的计划。

示例：

```typescript
interface AnalysisPlan {
  goal: string

  steps: AnalysisStep[]

  expectedEvidence: string[]
  completionCriteria: string[]
}
```

```typescript
const plan: AnalysisPlan = {
  goal: "分析 JFK 晚高峰出港延误原因",

  steps: [
    {
      targetId: "global-time-filter",
      capability: "setTimeRange",
      arguments: {
        startHour: 18,
        endHour: 21
      }
    },
    {
      targetId: "direction-filter",
      capability: "select",
      arguments: {
        value: "departure"
      }
    },
    {
      targetId: "airline-delay-ranking",
      capability: "setSort",
      arguments: {
        metric: "averageDepartureDelay",
        direction: "desc"
      }
    },
    {
      targetId: "delay-cause-panel",
      capability: "setFilters",
      arguments: {
        airport: "JFK"
      }
    }
  ],

  expectedEvidence: [
    "晚高峰准点率",
    "平均滑出时间",
    "不同航空公司延误贡献",
    "延误原因构成"
  ],

  completionCriteria: [
    "定位主要异常时间",
    "定位主要贡献对象",
    "形成有数据依据的结论"
  ]
}
```

---

## 11.5 AI 创建 Panel

模型创建 Panel 时，不得直接生成任意 Vue 代码。

模型应生成受约束的 `PanelConfig`：

```typescript
{
  id: "generated-airline-delay-ranking",
  type: "bar",

  title: "晚高峰航空公司平均出港延误",
  description: "比较 JFK 在 18:00 至 21:00 各航空公司的平均出港延误",

  query: {
    datasetId: "aviation_ontime",
    metrics: [
      {
        metricId: "averageDepartureDelay"
      }
    ],
    dimensions: [
      {
        dimensionId: "airline"
      }
    ],
    filters: [
      {
        dimensionId: "airport",
        operator: "eq",
        value: "JFK"
      },
      {
        dimensionId: "departureHour",
        operator: "between",
        value: [18, 21]
      }
    ],
    orderBy: [
      {
        field: "averageDepartureDelay",
        direction: "desc"
      }
    ],
    limit: 10
  },

  visualization: {
    orientation: "horizontal",
    showLabels: true
  },

  layout: {
    x: 0,
    y: 8,
    width: 6,
    height: 4
  }
}
```

系统负责：

* 校验配置；
* 查询数据；
* 选择组件；
* 创建实例；
* 注册能力；
* 加入 Dashboard。

---

# 12. 操作 Trace

Trace 必须作为可见功能存在，不应只写入浏览器控制台。

```typescript
interface EnchantTraceRecord {
  id: string
  timestamp: number

  userIntent?: string
  planId?: string
  stepIndex?: number

  targetId: string
  capability: string
  arguments: unknown

  stateBefore: unknown
  stateAfter: unknown

  validationResult: {
    passed: boolean
    message?: string
  }

  executionResult:
    | "success"
    | "failed"
    | "rejected"
    | "cancelled"

  durationMs: number
}
```

Trace 页面至少展示：

* 用户原始请求；
* 模型生成的分析计划；
* 每一步操作；
* 操作目标；
* 操作参数；
* 参数校验结果；
* 执行结果；
* 状态变化；
* 操作耗时；
* 失败原因；
* 撤销入口。

---

# 13. 专题实现规范

每个专题必须包含以下内容。

## 13.1 专题说明

```typescript
interface TopicDefinition {
  id: string
  title: string
  description: string

  audienceDescription: string
  businessQuestions: string[]

  datasets: string[]
  defaultDashboardId: string
}
```

---

## 13.2 专题必须回答的问题

每个专题至少定义五个可由页面数据回答的问题。

问题必须覆盖：

* 状态总览；
* 异常发现；
* 对象排名；
* 时间变化；
* 维度分解；
* 具体明细；
* 对比分析。

例如航班专题：

1. 哪些机场准点率最低？
2. 某机场哪个时间段延误最严重？
3. 延误主要集中在哪些航空公司？
4. 延误主要由哪些原因构成？
5. 哪些航班对异常贡献最大？
6. 出港延误是否在到港阶段得到恢复？
7. 工作日与周末是否存在差异？

---

## 13.3 专题演示脚本

每个专题至少提供三个完整演示脚本：

### 脚本 A：操作现有 Dashboard

展示：

* 修改筛选；
* 选择对象；
* 面板联动；
* 下钻明细。

### 脚本 B：多步骤分析

展示：

* 识别异常；
* 分解问题；
* 收集证据；
* 形成结论。

### 脚本 C：创建新分析页面

展示：

* 新建 Panel；
* 修改指标和维度；
* 调整布局；
* 建立联动；
* 保存 Dashboard。

---

# 14. 首个专题：航班运行与延误分析

## 14.1 数据来源

优先使用美国运输统计局航班准点数据。

应选择一个规模适中的时间范围，例如：

* 一个月；
* 三个月；
* 一个季度。

首版不需要加载全部历史数据。

---

## 14.2 数据实体

* 航班；
* 机场；
* 航空公司；
* 航线；
* 日期；
* 时间区间；
* 延误原因。

---

## 14.3 指标

至少实现：

* 航班数量；
* 出港航班数量；
* 到港航班数量；
* 准点航班数量；
* 准点率；
* 平均出港延误；
* P95 出港延误；
* 平均到港延误；
* 平均滑出时间；
* 取消率；
* 备降率；
* 严重延误航班数量；
* 各类延误原因分钟数。

---

## 14.4 维度

至少实现：

* 日期；
* 小时；
* 星期；
* 机场；
* 航空公司；
* 出发机场；
* 到达机场；
* 航线；
* 航班方向；
* 延误等级；
* 延误原因；
* 是否取消；
* 是否备降。

---

## 14.5 默认 Dashboard

建议布局：

### 第一行

* 总航班数；
* 准点率；
* 平均出港延误；
* 取消率。

### 第二行

* 机场运行地图；
* 每小时准点率趋势。

### 第三行

* 延误最严重机场排名；
* 延误原因构成；
* 航空公司准点率排名。

### 第四行

* 航班明细表；
* 延误事件时间线。

---

## 14.6 必须支持的交互

* 点击地图机场筛选其他 Panel；
* 选择趋势时间范围；
* 点击排名对象；
* 在机场、航空公司和航线之间下钻；
* 打开具体航班明细；
* 切换出港和到港；
* 切换平均值、P95 和严重延误数量；
* 保存当前调查视图。

---

# 15. 第二专题建议

第二专题优先选择电商转化分析。

原因：

* 数据准备难度较低；
* 与航班专题的数据组织方式明显不同；
* 适合展示 Panel 自动创建；
* 适合展示漏斗和用户分群；
* 普通观众容易理解。

应明确选择以下一种模式，不得将缺失字段强行补成完整业务链：

## 模式 A：淘宝用户行为

可分析：

* 浏览；
* 收藏；
* 加购；
* 购买；
* 用户路径；
* 商品和品类转化。

不可声称分析：

* 销售收入；
* 毛利润；
* 库存；
* 物流；
* 退款。

## 模式 B：Online Retail II

可分析：

* 销售额；
* 订单；
* 商品；
* 客户；
* 国家；
* 取消；
* 复购。

不可声称分析：

* 浏览；
* 收藏；
* 加购；
* 广告曝光。

---

# 16. 技术专题建议

云原生故障调查专题应在基础架构稳定后实施。

推荐方式：

1. 部署 OpenTelemetry Demo；
2. 启用内置负载生成；
3. 采集指标、日志和分布式调用链；
4. 注入可复现故障；
5. 记录故障开始和结束时间；
6. 将采集结果固化为演示数据；
7. Dashboard 按历史时间回放。

Representational State Transfer（表述性状态转移，REST，用于提供基于 HTTP 的服务接口）或 gRPC 调用本身不是展示重点。重点是：

* 服务关系；
* 请求延迟；
* 错误率；
* 实例状态；
* 节点资源；
* 发布和配置事件；
* 故障时间线；
* 异常调用链；
* 日志证据。

不得使用与 Kubernetes 语义不对应的数据，伪装成 Pod、Deployment 或 Service 数据。

---

# 17. 用户界面要求

## 17.1 设计方向

界面应：

* 信息清晰；
* 布局稳定；
* 使用统一间距；
* 使用统一状态色；
* 保持足够数据密度；
* 支持宽屏展示；
* 支持基本响应式变化；
* 保证图表标题、单位和筛选条件可见。

界面不应：

* 使用大量渐变；
* 使用发光描边；
* 使用无业务含义的动态背景；
* 使用频繁动画；
* 将核心数据隐藏在悬浮交互中；
* 为了视觉效果牺牲坐标、单位和标签；
* 模仿传统“大屏驾驶舱”的装饰性边框。

---

## 17.2 Dashboard 页面区域

建议固定分为：

```text
顶部：专题名称、时间范围、全局筛选、AI 入口
左侧或主区域：Dashboard Panel
右侧可选区域：AI 对话、分析计划、执行状态
底部或抽屉：操作 Trace、数据来源、当前上下文
```

AI 面板不应遮挡主要数据区域。

---

# 18. 开发阶段

## 阶段 0：仓库检查和方案确认

Agent 必须先：

1. 检查已有代码；
2. 检查已有 EnchantForge 接口；
3. 识别可以复用的组件；
4. 输出当前架构摘要；
5. 记录与本文不一致的技术约束；
6. 制定增量开发顺序。

不得在未检查仓库的情况下重建整个项目。

---

## 阶段 1：语义和查询模型

完成：

* 数据集定义；
* 实体定义；
* 指标定义；
* 维度定义；
* 关系定义；
* QuerySpec；
* 查询校验；
* DuckDB 查询编译；
* 标准结果格式。

验收条件：

* 同一个查询可以被不同 Panel 复用；
* 非法指标和维度组合会被拒绝；
* 模型不需要生成 SQL；
* 查询结果包含字段语义。

---

## 阶段 2：基础 Panel

完成：

* 指标卡；
* 折线图；
* 柱状图；
* 构成图；
* 表格；
* 地图。

验收条件：

* Panel 完全由配置生成；
* Panel 能读取 QuerySpec；
* Panel 能暴露语义；
* Panel 能注册能力；
* Panel 状态变化可观测。

---

## 阶段 3：Dashboard Runtime

完成：

* Panel 加载；
* Panel 删除；
* Panel 复制；
* Panel 移动；
* Panel 调整大小；
* 全局筛选；
* Panel 联动；
* Dashboard 保存和恢复。

验收条件：

* Dashboard 配置可序列化；
* 页面刷新后可以恢复；
* Panel 不依赖固定页面位置；
* 联动关系通过配置定义。

---

## 阶段 4：航班专题

完成：

* 数据下载脚本；
* 数据清洗脚本；
* 数据来源清单；
* 航班语义模型；
* 默认 Dashboard；
* 五个以上分析问题；
* 三个演示脚本。

验收条件：

* 所有主要图表使用真实公开数据；
* 页面支持机场、时间、航空公司和航线筛选；
* 至少支持一条完整延误调查链。

---

## 阶段 5：EnchantForge 集成

完成：

* 页面上下文；
* Panel 语义；
* 能力注册；
* 实例寻址；
* 参数校验；
* 多步骤计划；
* 操作 Trace；
* 撤销；
* 错误处理。

验收条件：

* 模型可以操作当前 Panel；
* 模型不能操作未注册对象；
* 非法参数会被拒绝；
* 每一步操作都产生 Trace；
* 页面状态与上下文保持同步。

---

## 阶段 6：AI 创建 Panel

完成：

* 从自然语言生成 QuerySpec；
* 从自然语言生成 PanelConfig；
* 校验指标和维度；
* 创建 Panel；
* 调整布局；
* 保存新 Dashboard。

验收条件：

* 模型不生成任意组件代码；
* 错误配置不会进入页面；
* 创建的 Panel 可以继续被模型操作；
* 新 Panel 自动注册语义和能力。

---

## 阶段 7：第二专题

复用已有架构实现电商或空气质量专题。

验收重点：

* 不修改 Dashboard 核心代码即可接入新专题；
* 新专题主要通过数据集、语义模型和 Panel 配置完成；
* 不在核心模块中写入航班专用判断；
* EnchantForge 能力保持统一。

---

## 阶段 8：云原生技术专题

在前述功能稳定后开发。

不得为了赶进度使用随机数字模拟完整故障链。可以使用实际采集的数据进行离线回放。

---

# 19. 测试要求

## 19.1 单元测试

至少覆盖：

* QuerySpec 校验；
* 指标和维度兼容性；
* 过滤条件编译；
* 能力参数校验；
* 实例寻址；
* Panel 状态变更；
* Dashboard 保存和恢复；
* Trace 记录；
* 撤销操作。

---

## 19.2 集成测试

至少覆盖：

```text
选择地图机场
→ 更新全局筛选
→ 趋势图重新查询
→ 排名重新查询
→ 表格重新查询
→ 上下文更新
→ 产生 Trace
```

以及：

```text
AI 创建 Panel
→ 校验 PanelConfig
→ 执行查询
→ 加入 Dashboard
→ 注册能力
→ 更新页面上下文
→ 保存 Dashboard
```

---

## 19.3 演示测试

每个预设演示问题必须在固定数据集上得到稳定结果。

不得依赖模型临场偶然生成正确分析路径。

应为演示问题提供：

* 推荐分析计划；
* 可接受的替代步骤；
* 预期证据；
* 预期页面状态；
* 预期结论边界；
* 异常恢复方案。

模型可以动态执行，但系统必须保证数据、能力和关键路径可复现。

---

# 20. 完成标准

项目完成至少需要满足以下条件：

## Dashboard

* [ ] 支持配置化创建 Dashboard；
* [ ] 支持至少六种 Panel；
* [ ] 支持全局筛选；
* [ ] 支持 Panel 联动；
* [ ] 支持 Panel 创建、删除、移动和调整大小；
* [ ] 支持 Dashboard 保存和恢复。

## 数据

* [ ] 至少两个专题使用公开或真实采集数据；
* [ ] 每个专题具有数据来源清单；
* [ ] 每个衍生字段具有定义；
* [ ] 不存在未标明的随机业务数据；
* [ ] 数据限制在页面或文档中可查。

## EnchantForge

* [ ] 能读取当前页面语义；
* [ ] 能读取当前筛选和选择状态；
* [ ] 能调用当前组件实例能力；
* [ ] 能执行多步骤分析；
* [ ] 能创建和修改 Panel；
* [ ] 能保存分析 Dashboard；
* [ ] 能展示完整操作 Trace；
* [ ] 非法能力调用会被拒绝；
* [ ] 可逆操作能够撤销。

## 演示

* [ ] 航班专题具有完整调查脚本；
* [ ] 第二专题能够证明跨行业复用；
* [ ] 至少演示一次从现有 Dashboard 开始的分析；
* [ ] 至少演示一次 AI 创建 Panel；
* [ ] 至少演示一次 AI 组合并保存 Dashboard；
* [ ] 至少演示一次能力调用被约束或拒绝；
* [ ] 所有主要结论可以追溯到页面数据。

---

# 21. Agent 工作规范

Agent 在开发过程中必须遵守以下规则：

1. 每次修改前先读取相关代码，不得根据文件名猜测实现。
2. 优先增量修改，不得无理由重写现有模块。
3. 每完成一个阶段，更新对应文档。
4. 所有重要架构决策写入 `docs/decisions`。
5. 所有公开数据处理必须保留脚本。
6. 不得手工修改处理后的数据以制造演示结果。
7. 测试失败时不得删除测试绕过问题。
8. 不得使用 `any` 作为核心语义模型的长期类型方案。
9. 不得让领域专题直接依赖模型供应商接口。
10. 不得让模型生成的文字成为页面状态的唯一来源。
11. 不得在核心 Dashboard 模块中加入具体行业判断。
12. 发现本文要求与已有实现冲突时，应记录冲突并选择改动范围较小、架构更稳定的方案。
13. 任何无法完成或存在不确定性的部分必须明确记录，不得通过伪造数据或空实现宣称完成。
14. 每次提交应具有明确、单一的改动目标。
15. 项目始终保持可运行状态。

---

# 22. 最终交付物

最终至少交付：

```text
1. 可运行的 Dashboard Web 应用
2. 轻量数据查询服务
3. 航班运行专题
4. 至少一个跨行业专题
5. EnchantForge 页面上下文集成
6. 能力注册和调用系统
7. 操作 Trace 页面
8. 数据下载和处理脚本
9. 数据来源及许可说明
10. 系统架构文档
11. 语义模型文档
12. 能力模型文档
13. 演示脚本文档
14. 自动化测试
15. 本地运行和构建说明
```

最终演示需要明确表达：

> 该系统并不是在传统 Dashboard 旁增加一个聊天窗口。

> EnchantForge 将当前运行中的 Vue 页面转换为模型可理解、可寻址、可操作且受约束的语义环境。

> 模型操作的不是抽象工具列表，而是当前页面中已经实例化的业务组件、数据对象、筛选条件和分析状态。

