# 11. 功能归属与框架边界

## 1. 目的

本文规定 EnchantForge Core、官方 Adapter、应用代码和示例代码之间的功能归属。新增 capability、executor、metadata scanner、结果文案或 UI 操作前，必须先确定所有者，再决定代码位置。

本规范解决以下问题：

- 防止业务操作持续进入框架核心；
- 防止自动扫描生成实际上无法可靠执行的 tools；
- 防止示例为了展示效果而改变公共抽象；
- 保证简单接入路径不因高级场景不断增加配置；
- 明确 capability 的实现、测试和维护责任。

本文使用以下约束词：

- **必须**：合并代码前必须满足；
- **不得**：明确禁止；
- **应**：默认选择，偏离时需要说明理由；
- **可以**：不影响边界的可选实现。

## 2. 总原则

~~~text
EnchantForge owns discovery, description, tool contracts and constraints.
Capability owners own semantics and effects.
~~~

中文定义：

> EnchantForge 负责发现、描述、工具契约和约束；能力所有者负责定义语义和产生效果。

Core 可以提供可复用的默认 Agent Client 和有界 Tool Loop，但它们是便利机制。应用仍拥有触发时机、Agent 后端、协议路由、会话和业务流程。

执行层面的约束：

> Metadata 可以自动推断，Effect 必须有明确的实现所有者。

扫描到 DOM、Vue 组件、字段或图表，只能证明这些对象存在。它不能证明应用支持组合、导出、保存、提交、审批或其他操作。

## 3. 四类代码所有者

### 3.1 Core

Core 提供与业务领域无关的稳定机制：

- Enchantment 和 registration 生命周期；
- metadata capture、registry、snapshot 和 digest；
- capability 描述、tool schema 和调用协议；
- provider-neutral Context/Tool 导出、安全 executor 和可选的有界 Tool Loop；
- policy、authorization、progress、trace 和 debug；
- 可替换的默认 LLM client、Agent Client 契约和 `agentId` resolver；
- 后端无关的 Knowledge Provider 查询/结果契约与 HTTP 适配机制；
- Adapter 和应用 capability 的扩展接口。

Core 中的行为必须能够在不知道页面业务类型的情况下定义和测试。监控、快递、工单、审批等领域名词不得成为 Core 行为的前提。

Core 不拥有文档切分、embedding 模型、索引 mapping、hybrid score 融合、reranker、ACL 或知识更新流程。这些属于应用后端或独立知识平台。静态 provider 只能用于测试、示例和少量本地规则。

### 3.2 Official Adapter

Adapter 基于稳定的外部技术契约提供集成能力：

- DOM：文本、可见性、定位、滚动和高亮；
- Vue Router：读取当前路由和受约束导航；
- Ant Design Vue：字段模型、校验状态和标准组件事件；
- ECharts：读取 option、tooltip、legend 和 dataZoom；
- Pinia：读取明确暴露的 state 和调用明确授权的 action。

Adapter 必须满足：

- 依赖对象有公开、稳定且可测试的 API；
- 不包含业务字段、业务路由或业务状态分支；
- 缺少对应依赖或契约时可以停用；
- 不改变未接入 Adapter 的 Core 默认语义；
- capability 的效果可以由 Adapter 独立验证。

Adapter 可以暂时与 @enchantforge/vue 位于同一 package，但代码必须保持逻辑隔离。runtime 机制不得反向依赖具体 Adapter 的业务动作。

### 3.3 Application

以下能力属于应用或业务页面：

- 依赖业务 store、接口、权限或领域模型；
- 创建或修改应用拥有的持久状态；
- 结果含义由业务规则决定；
- 换一个应用后需要修改条件、参数或执行流程；
- 需要应用决定确认、回滚、幂等或异常处理。

典型能力：

- 组合 Dashboard；
- 保存自定义视图；
- 创建工单；
- 提交快递订单；
- 审批、支付和删除；
- 根据业务状态决定字段是否允许修改。

应用能力可以注册到 EnchantForge，由 Aura、应用自有 Agent Client 或后端 Agent 发现和调用，但其实现不得因此移动到 Core。

### 3.4 Example Incubation

尚未形成稳定技术契约、目前仅为演示服务的能力必须保留在 examples/vue。

示例实现只有满足以下条件后才能提升为 Adapter：

- 已在至少两个无业务关联的场景中复用；
- 两个场景使用相同输入、输出和失败语义；
- 实现中没有按页面或业务类型分支；
- 可以在独立 fixture 中测试；
- 提升后确实减少接入代码，而不是把示例复杂度隐藏进 Core。

## 4. Metadata 与 Capability 的关系

Metadata 不是 capability，capability 也不是权限。

可执行 tool 必须同时具备：

~~~text
metadata
  + capability provider
  + executor implementation
  + current policy decision
  = executable tool
~~~

只有 metadata 时，Forge 可以：

- 向 agent 描述对象；
- 支持检索、解释和页面理解；
- 通过已安装的通用 Adapter 提供读取或视觉定位。

Forge 不得仅根据名称、label、DOM selector 或组件类型推断业务 effect。

例如：

~~~text
chart: node-cpu
title: Node CPU Usage
~~~

不能自动推出：

~~~text
dashboard.compose
dashboard.save
report.export
~~~

只有 Dashboard 所有者提供组合契约后，Forge 才能公开 dashboard.compose(panelIds)。

## 5. Capability 所有权

每个可执行 capability 必须能够回答以下问题：

- 谁定义它的业务或技术语义？
- 谁拥有被修改的状态？
- 谁负责参数校验和失败语义？
- 谁负责测试和兼容性？
- 没有 provider 时是否仍会被生成为 tool？

建议 capability 模型保留以下归属信息：

~~~ts
type CapabilityOwner = 'core' | 'adapter' | 'application';

interface CapabilityOwnership {
  owner: CapabilityOwner;
  provider: string;
  effect: 'read' | 'visual' | 'draft' | 'commit';
}
~~~

该字段首先用于设计、debug 和审查，不代表必须立即作为稳定公共 API 发布。

## 6. 功能归属判定

新增功能时按顺序判断：

1. 是否只依赖 Vue、DOM 或 EnchantForge 自身协议？
2. 在不同业务系统中，输入、语义、效果和失败方式是否一致？
3. 是否需要业务 store、后端接口、权限或领域模型？
4. 是否基于一个公开且稳定的第三方组件 API？
5. EnchantForge 是否能在独立环境中完整测试它？
6. 换一个项目后，是否需要增加业务条件或映射？
7. capability 不存在时，Forge 能否停止公开对应 tool？

决策：

| 条件 | 归属 |
|---|---|
| 只依赖框架机制，语义稳定 | Core |
| 依赖标准第三方技术契约 | Official Adapter |
| 依赖业务状态、接口或领域语义 | Application |
| 尚未证明可复用 | Example Incubation |

风险等级不能单独决定代码归属。“组合视图”风险较低，但它修改 Dashboard 拥有的状态，因此仍属于 Application。

## 7. Core 准入条件

功能进入 Core 前必须同时满足：

- 无业务领域词汇；
- 无页面 ID、路由名、字段名或应用 store 依赖；
- 有稳定的输入、输出和错误协议；
- 不要求安装特定业务组件；
- 未配置时不会增加持续扫描、watch 或 snapshot 成本；
- 可以通过单元或最小 fixture 测试；
- 不使首个 wrapper 示例增加新概念；
- 不能通过 Adapter 或应用 capability 更合理地实现。

仅仅“多个页面可能用到”不足以进入 Core。

## 8. Adapter 准入条件

功能进入官方 Adapter 前必须满足：

- 外部对象有稳定 API，而不是依赖 DOM class 或私有实例字段；
- capability 与业务名称无关；
- Adapter 可以明确检测支持状态；
- 不支持时不生成 tool，而不是尝试猜测执行；
- Adapter 失败不会绕过组件原有校验和事件流程；
- 版本兼容范围和降级行为可以定义；
- 依赖保持可选或被限制在明确的 UI 模块中。

如果实现必须读取业务变量才能工作，它不是 Adapter。

## 9. Application 能力接入要求

应用 capability 应通过统一协议接入，而不是修改 Forge：

~~~ts
forge.registerCapability({
  id: 'dashboard.compose',
  owner: 'application',
  description: '组合指定 Dashboard 面板',
  inputSchema,
  execute
});
~~~

未来高层 API 可以减少上述样板代码，但不得把 execute 的业务语义移入 Core。

应用可以在页面、store、composable 或业务 Adapter 中实现 capability。代码位置由状态所有权决定。

应用中跨页面复用的 API 应集中定义，再通过应用级插件一次安装：

~~~ts
export const getOrder = defineEnchantAction({
  name: 'orders.get',
  description: '根据完整订单号查询订单详情',
  effect: 'read',
  inputSchema: orderQuerySchema,
  execute: ({ orderNo }, context) => orderService.get(orderNo, context.signal)
});

export const ordersApi = defineEnchantApi({
  id: 'orders',
  page: 'customer-service',
  actions: [getOrder]
});

createApp(App).use(createEnchantForge().use(ordersApi));
~~~

`defineEnchantAction` 负责让契约只声明一次；同一个定义也可以传给
`useEnchantAction`，绑定到局部 `<Enchant>` 生命周期。`defineEnchantApi` 只负责把应用
拥有的 actions 注册为应用级 capabilities，不接管其业务实现、权限或错误语义。应用级
capability 会自动合并进局部 Enchant context；设置 `page` 后只对该页面生效，避免向
无关 Agent 暴露 tools。

不得使用“仅 import 即修改全局注册表”的模块副作用。该方式无法明确绑定 Forge
实例，在多 Vue app、SSR、测试隔离和 tree shaking 场景中行为不可靠。全局安装必须
保留一次显式的 `forge.use(api)`。

## 10. 文案所有权

文案必须跟随产生该事实的所有者：

- runtime 阶段文案，如 capture、planning、authorizing、executing，由 Core 提供默认值并允许统一覆盖；
- capability 结果摘要由 capability provider 返回；
- Adapter 错误由 Adapter 返回；
- 业务结果和确认文案由 Application 返回；
- Aura 只负责展示，不应重新解释业务执行结果。

Core 只允许保留无业务含义的回退文案，例如：

~~~text
操作已完成。
操作未完成。
当前页面没有可执行的匹配操作。
~~~

以下文案不得出现在 Core：

~~~text
已将 node-cpu 加入组合视图。
工单已创建。
订单已提交。
审批已通过。
~~~

批量 capability 的结果聚合由 capability owner 或可配置 result formatter 完成。Core 不应通过字符串分析业务摘要。

## 11. 当前功能归属

| 功能 | 应属位置 |
|---|---|
| registry、capture、snapshot、digest | Core |
| capability protocol、policy、progress、trace | Core |
| DOM 文本读取、滚动、高亮 | DOM Adapter |
| Ant Design Vue 表单字段读写 | Ant Design Vue Adapter |
| ECharts tooltip、legend、dataZoom | ECharts Adapter |
| Vue Router 导航 | Vue Router Adapter |
| Dashboard 组合视图 | Application |
| Dashboard 详情 Modal/Drawer | Application 或 Dashboard Adapter |
| 创建工单、提交表单、审批 | Application |
| capability 结果格式化扩展点 | Core |
| Aura 消息展示 | Framework UI |

## 12. 边界迁移记录

首次边界审计已完成以下迁移：

- Focus View 的高亮、详情和组合状态已移到 examples/vue；
- Dashboard 使用一个应用级批量 capability provider，不再为每个 panel 生成 Core 业务动作；
- Core 已移除 page-focus、visual state 和组合视图结果文案；
- 默认 agent prompt 不包含特定业务操作的禁止列表，也不包含 panel、highlight 或组合视图的领域完成规则；
- DOM scanner 已移除 Ant Design Vue 私有 class 选择器，改用标准 label、ARIA 和通用结构推断；
- 已移除从 metadata 直接生成无 provider tools 的 legacy helper，以及映射字段动作并持有全局 DOM handle 的 legacy scope facade。

保留在 Core 的 DOM field fill 具有明确的 DOM Adapter provider，并通过原生 input、change 和 blur 事件执行。后续 Ant Design Vue 等组件实例级写入应进入独立 Adapter，不得再次向 generic DOM scanner 添加私有 class 或实例协议。

出现跨应用的稳定 Dashboard 技术契约后，可以重新评估 Dashboard Adapter；在此之前，Dashboard effect 继续由应用所有。

## 13. Code Review Gate

任何新增 capability、executor 或自动 tool 生成逻辑的变更必须在说明中回答：

1. capability owner 是谁？
2. 被读取或修改的状态由谁拥有？
3. 为什么它属于 Core、Adapter 或 Application？
4. provider 不存在时是否还会生成 tool？
5. 是否依赖业务词汇、路由、字段或 store？
6. 是否绕过组件原有事件和校验？
7. 结果和错误文案由谁产生？
8. 能否独立测试？
9. 是否增加默认扫描、watch 或 snapshot 成本？
10. 是否让最短接入示例变复杂？

无法明确回答 owner 的功能不得合并。

## 14. 最终约束

~~~text
Core owns mechanisms.
Adapters own technical integration.
Applications own meaning and effects.
Examples do not define framework contracts.
~~~

便捷 API 的目标是减少协议接入样板代码，不是把应用语义吸收到 Core。任何“为了让示例自动工作”而进入 Core 的逻辑，都必须先通过本文的归属判定。
