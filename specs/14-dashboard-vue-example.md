# 14. Dashboard Vue 示例项目

## 1. 目标

`examples/dashboard-vue` 是独立的 Dashboard 产品示例，不把 Dashboard 业务模型加入 Core。它使用 Vue、Ant Design Vue、ECharts 和 EnchantForge，证明以下闭环：

```text
dataset semantic model
  -> constrained QuerySpec
  -> configured Panel
  -> Dashboard evidence groups
  -> Dashboard state and links
  -> Enchant capability
  -> Aura request and trace
```

当前包含航班运行、北京空气质量、NYC Taxi 和 OpenTelemetry 四个专题。示例优先展示当前页面中的 Panel 实例、筛选条件和能力如何被寻址；不允许模型生成 Vue 或 SQL。

## 2. 当前交付范围

当前增量包含：

- 四个专题的语义模型、指标、维度和关系定义；
- 受约束的服务端 QuerySpec 校验与 SQLite 聚合查询；
- 指标卡、折线图、柱状图、构成图、表格、时间线和拓扑图；
- 专题筛选和配置驱动的 Panel 编排；
- 面向分析问题的 Evidence Group 元数据；
- 独立的 Panel Library 和 Dashboard Library 管理页面；
- 通过 Text-to-Form 生成 PanelConfig 和 Dashboard 编排草稿；
- Dashboard 和 Panel 的显式 Enchant metadata/capability；
- `read`、筛选和多 Panel 高亮能力；
- Aura 助手、Debug trace、数据来源说明和本地运行配置。

业务数据由 `examples/data-sources` 统一下载或采集、清洗并写入 SQLite；页面不会使用前端模拟数据。

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
- Evidence Group 的领域含义和 Panel 组合；
- Panel/Dashboard CRUD、数据域约束和草稿保存；
- 业务 trace 摘要与数据来源展示。

### 3.3 EnchantForge 负责

- wrapper 生命周期和稳定 metadata capture；
- capability 注册、输入 schema、policy 和执行边界；
- Aura LLM workflow、进度和运行 trace。

snapshot 只作为 LLM 规划上下文和 Debug 记录。示例不把 registry version 当成 Dashboard 操作锁；执行阶段由 Core 重新检查目标 capability 合约，Panel 数据刷新不会触发 metadata version。

## 4. 数据与语义模型

专题数据模型至少包含：`flight`、`airport`、`airline`、`date`、`hour`、`direction`、`delayCause`。首个版本实现航班数、准点率、平均/P95 出港延误、取消率、严重延误数和延误原因分钟数等指标。

`QuerySpec` 只能引用已注册 dataset、metric、dimension 和允许的 operator。Node 查询服务将 QuerySpec 编译为受约束的 SQLite 查询；未来替换查询后端时，Panel 和 Enchant capability 契约不变。

## 5. 可演示路径

1. 选择 `JFK` 和 18:00-21:00，所有 Panel 联动更新。
2. 通过 Aura 提问当前机场或服务的异常指标。
3. Aura 从 Evidence Group 读取 2-4 个真实 Panel 结果并高亮同一组证据。
4. 在 Debug trace 中查看 read、继续规划、highlight 和最终回答。
5. 在 Panel Library 通过自然语言生成 Panel 草稿，检查后保存。
6. 在 Dashboard Library 选择数据域，通过自然语言或手动方式组合已有 Panel。

## 6. 验收标准

- QuerySpec 非法 metric/dimension/filter 会被拒绝；
- Panel 由配置生成，且每个实例拥有稳定 id；
- 业务数据和筛选变化不递增 registry version；
- Panel capability 只能作用于当前实例；
- 无关 Panel 挂载不会让已有计划因 snapshot version 失效；
- 主要分析结论可以追溯到当前 QueryResult 和 SQLite 数据来源；
- Evidence Group 引用的 Panel 必须存在，且只表达应用领域语义；
- 自定义 Dashboard 只保存 Panel 引用、顺序和布局，不复制 Panel 定义；
- Text-to-Form 只能更新草稿，保存仍经过应用 API 校验；
- 核心包和 Dashboard 示例均可通过定向 typecheck/build。
