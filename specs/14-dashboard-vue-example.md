# 14. Dashboard Vue 示例项目

## 1. 目标

`examples/dashboard-vue` 是独立的 Dashboard 产品示例，不把 Dashboard 业务模型加入 Core。它使用 Vue、Ant Design Vue、ECharts 和 EnchantForge，证明以下闭环：

```text
dataset semantic model
  -> constrained QuerySpec
  -> configured Panel
  -> Dashboard state and links
  -> Enchant capability
  -> Aura request and trace
```

首个专题是航班运行与延误分析。示例优先展示当前页面中的 Panel 实例、筛选条件和能力如何被寻址；不实现通用 BI 平台，也不允许模型生成 Vue 或 SQL。

## 2. 当前交付范围

首个增量包含：

- 航班专题语义模型、指标、维度和关系定义；
- 受约束的本地 QuerySpec 校验与聚合查询；
- 指标卡、折线图、柱状图、构成图、表格、时间线和机场状态 Panel；
- 全局机场、航空公司、方向和小时范围筛选；
- Panel 选择联动和 Dashboard 视图保存/恢复；
- Dashboard 和 Panel 的显式 Enchant metadata/capability；
- `read`、筛选、时间范围、选择、高亮、添加模板 Panel、保存视图等能力；
- Aura 助手、Debug trace、数据来源说明和本地运行配置。

业务数据使用固定、可审计的演示 fixture，明确标注为非实时数据。数据下载脚本和 BTS 原始数据接入属于后续任务，不能把 fixture 描述为实时运行数据。

## 3. 边界

### 3.1 Core 不负责

- QuerySpec、DatasetDefinition 和 PanelConfig 的领域语义；
- 航班字段、指标表达式和筛选业务规则；
- Dashboard 布局、保存视图和撤销实现；
- ECharts option 生成；
- 航班数据查询或数据来源治理。

### 3.2 示例应用负责

- 领域数据与 QuerySpec 校验；
- 当前 Dashboard 状态和 Panel 实例；
- 能力 owner/provider 及实际执行效果；
- Panel 渲染和联动；
- 业务 trace 摘要与数据来源展示。

### 3.3 EnchantForge 负责

- wrapper 生命周期和稳定 metadata capture；
- capability 注册、输入 schema、policy 和执行边界；
- Aura LLM workflow、进度和运行 trace。

snapshot 只作为 LLM 规划上下文和 Debug 记录。示例不把 registry version 当成 Dashboard 操作锁；执行阶段由 Core 重新检查目标 capability 合约，Panel 数据刷新不会触发 metadata version。

## 4. 数据与语义模型

专题数据模型至少包含：`flight`、`airport`、`airline`、`date`、`hour`、`direction`、`delayCause`。首个版本实现航班数、准点率、平均/P95 出港延误、取消率、严重延误数和延误原因分钟数等指标。

`QuerySpec` 只能引用已注册 dataset、metric、dimension 和允许的 operator。前端本地查询引擎是可替换的演示实现；未来可将同一 QuerySpec 交给 DuckDB/FastAPI 服务，Panel 和 Enchant capability 契约不变。

## 5. 可演示路径

1. 选择 `JFK` 和 18:00-21:00，所有 Panel 联动更新。
2. 在机场状态或排名 Panel 选择对象，页面高亮关联 Panel。
3. 通过 Aura 请求读取当前航班延误数据、切换时间范围或高亮异常 Panel。
4. 通过 Aura 请求添加受约束的航空公司排名模板 Panel，并保存当前视图。
5. 在 Debug trace 中查看 capture、tool、policy、action 和 result 事件。

## 6. 验收标准

- QuerySpec 非法 metric/dimension/filter 会被拒绝；
- Panel 由配置生成，且每个实例拥有稳定 id；
- 业务数据和筛选变化不递增 registry version；
- Panel capability 只能作用于当前实例；
- 无关 Panel 挂载不会让已有计划因 snapshot version 失效；
- 所有主要航班结论可以追溯到当前 QueryResult 和 fixture 来源；
- 核心包和 Dashboard 示例均可通过定向 typecheck/build。
