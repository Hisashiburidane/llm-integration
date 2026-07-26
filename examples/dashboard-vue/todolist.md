# Dashboard Vue TODO

## 已完成

- [x] 建立独立 `examples/dashboard-vue` Vue/Vite 项目。
- [x] 定义航班专题 Dataset、Metric、Dimension、QuerySpec 和 PanelConfig 类型。
- [x] 实现受约束的本地 QuerySpec 校验与聚合查询。
- [x] 实现指标卡、折线、柱状、构成、表格、时间线和机场状态 Panel。
- [x] 实现全局筛选、Panel 选择联动和视图保存/恢复。
- [x] 为 Dashboard 与 Panel 注册 Enchant metadata/capability。
- [x] 接入 Aura、Debug overlay 和页面内 Trace 抽屉。
- [x] 提供可审计的航班数据来源、清洗结果和来源说明。
- [x] 在统一 `examples/data-sources` 中登记 BTS 月度地址、目标目录和数据治理 manifest 模板。
- [x] 通过统一数据源下载器下载 BTS 原始压缩包并生成 SHA-256 manifest。
- [x] 使用 uv/Typer 清洗 BTS 航班数据并写入 SQLite `aviation_flights`。
- [x] 通过 Node 开发服务从 SQLite 提供 Dashboard 配置、Panel、QuerySpec 和聚合查询结果。
- [x] 完成 NYC Taxi 数据清洗、区域字典关联、物化聚合表和配置驱动 Dashboard。
- [x] 让 Taxi Panel 复用通用渲染器，根据 Dataset 元数据显示指标标签、单位和区域名称。

## 下一步

- [ ] 补充更多月份的 BTS 数据并完善真实 checksum、许可和清洗覆盖范围。
- [ ] 将 Node 查询服务扩展为可替换的生产查询适配器；不回退到本地 fixture。
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
- [x] 不把清洗后的快照描述为实时生产数据。
- [ ] 不在 Core 中加入 Dataset、Panel、Dashboard 或航班判断。
- [ ] 不在首个增量实现完整 BI 权限、多租户、拖拽低代码和实时流处理。
