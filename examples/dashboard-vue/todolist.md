# Dashboard Vue TODO

## 已完成

- [x] 建立独立 `examples/dashboard-vue` Vue/Vite 项目。
- [x] 定义航班专题 Dataset、Metric、Dimension、QuerySpec 和 PanelConfig 类型。
- [x] 实现受约束的本地 QuerySpec 校验与聚合查询。
- [x] 实现指标卡、折线、柱状、构成、表格、时间线和机场状态 Panel。
- [x] 实现全局筛选、Panel 选择联动和视图保存/恢复。
- [x] 为 Dashboard 与 Panel 注册 Enchant metadata/capability。
- [x] 接入 Aura、Debug overlay 和页面内 Trace 抽屉。
- [x] 提供固定、可审计的航班演示 fixture 与来源说明。
- [x] 生成 BTS 月度原始数据地址清单、目标目录和数据治理 manifest 模板。

## 下一步

- [ ] 手动下载并固化一份 BTS/公开航班准点数据，补充真实 checksum、许可和清洗脚本。
- [ ] 将 QuerySpec 编译到 DuckDB 或轻量 FastAPI 查询服务；保留本地 fixture fallback。
- [ ] 增加航班明细抽屉、航线下钻和可逆的 Panel 删除/撤销操作。
- [ ] 增加操作 Trace 的 state before/after、耗时、失败码和撤销入口。
- [ ] 为 AI 创建 Panel 增加 QuerySpec/PanelConfig 双重校验和模板白名单。
- [ ] 增加完整的“JFK 晚高峰延误调查”预设分析脚本和证据链展示。
- [ ] 增加第二个跨行业专题，优先选择 Online Retail II 或空气质量。
- [ ] 为 Dashboard runtime、QuerySpec、能力寻址和保存恢复补充自动化测试。
- [ ] 增加地图、拓扑等需要外部数据的 Panel adapter，并保持领域逻辑在专题目录。
- [ ] 将示例加入 website 的专题入口，不把示例业务代码移动到 `packages/vue`。

## 明确不做

- [ ] 不在示例中生成或执行任意 SQL/JavaScript。
- [ ] 不把固定 fixture 描述为实时生产数据。
- [ ] 不在 Core 中加入 Dataset、Panel、Dashboard 或航班判断。
- [ ] 不在首个增量实现完整 BI 权限、多租户、拖拽低代码和实时流处理。
