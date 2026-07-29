# 14. OpenTelemetry 集成

## 1. 定位

EnchantForge 提供可选的 OpenTelemetry Adapter，用于观测 Agent 编排和 capability
执行。Adapter 位于独立入口 `@enchantforge/vue/otel`，Core、Enchant 和 Aura 不依赖
OpenTelemetry SDK。

应用负责：

- 初始化 OpenTelemetry Provider、Processor 和 Exporter；
- 决定采样、资源属性、OTLP 地址和认证方式；
- 决定是否启用 metrics；
- 决定是否采集可能包含业务数据的输入和输出。

Adapter 负责：

- 将一次 `forge.run()` 记录为 active span；
- 将 capability 执行记录为 run span 的子 span；
- 将默认 LLM Client 请求记录为 GenAI 语义子 span；
- 设置低基数运行属性、执行结果和错误状态；
- 可选记录运行次数和耗时 metrics；
- 在 Forge dispose 时注销 middleware。

## 2. 接入

~~~ts
import { metrics, trace } from '@opentelemetry/api';
import { createEnchantForge } from '@enchantforge/vue';
import { createEnchantOpenTelemetry } from '@enchantforge/vue/otel';

const forge = createEnchantForge().use(createEnchantOpenTelemetry({
  tracer: trace.getTracer('@enchantforge/vue', '0.1.0'),
  meter: metrics.getMeter('@enchantforge/vue', '0.1.0'),
  attributes: {
    'service.name': 'customer-console'
  }
}));

createApp(App).use(forge).mount('#app');
~~~

OpenTelemetry SDK 必须在创建 Vue app 前完成初始化。没有注册 SDK 时，官方 API
返回的 no-op Tracer/Meter 仍可安全传入，但不会导出遥测数据。

## 3. Spans

| Span | 边界 | 主要属性 |
| --- | --- | --- |
| `enchantforge.agent.run` | 完整 `forge.run()` | page、enchantment、agent、plan/result count、outcome |
| `enchantforge.capability.execute` | capability `execute()` | capability id/name/effect/owner/provider、page、outcome |
| `enchantforge.llm.request` | 默认 LLM Client 的一次请求 | model、tools、finish reason、token usage、outcome |

Adapter 使用 `startActiveSpan()`。因此 capability span 可以继承 Agent run span 的
active context，业务 API 内已经启用的 fetch、HTTP 或数据库 instrumentation 也可以
继续形成子 span。

## 4. Metrics

| Instrument | 类型 | 单位 |
| --- | --- | --- |
| `enchantforge.agent.run.count` | Counter | `{run}` |
| `enchantforge.agent.run.duration` | Histogram | `s` |
| `enchantforge.capability.execution.count` | Counter | `{execution}` |
| `enchantforge.capability.execution.duration` | Histogram | `s` |
| `enchantforge.llm.request.count` | Counter | `{request}` |
| `enchantforge.llm.request.duration` | Histogram | `s` |

Metrics 只在提供 `meter` 时创建。结果通过 `enchantforge.outcome` 区分
`success`、`failed`、`partial` 和 `error`。

## 5. 数据安全

默认不记录以下内容：

- 用户输入；
- capability input；
- LLM 回答；
- capability output。

应用可以显式配置：

~~~ts
createEnchantOpenTelemetry({
  tracer,
  captureInputs: true,
  captureOutputs: true,
  contentLimit: 2048
});
~~~

即使显式启用，内容也会按 `contentLimit` 截断。生产环境仍应通过采样器、Span
Processor 或 Collector 做进一步脱敏。API key 和请求认证头不属于 Adapter 的采集范围。

## 6. 边界

OpenTelemetry 是稳定的技术协议，因此映射逻辑属于 Adapter。业务 span、订单号、
客户身份、Dashboard 指标等领域属性仍由应用自己的 instrumentation 提供，不得进入
EnchantForge Adapter。

Adapter 为默认 LLM Client 创建 provider-neutral GenAI span，并继续允许 HTTP/fetch
instrumentation 记录真实网络请求。它不会根据 OpenAI-compatible 协议猜测
`gen_ai.provider.name`；自定义 LLM Client 应在自己的 Adapter 中提供更完整的 provider
属性和协议语义。
