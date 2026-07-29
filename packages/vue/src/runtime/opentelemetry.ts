import type {
  EnchantExecutionMiddlewareRequest,
  EnchantForgePlugin,
  EnchantRunMiddlewareRequest
} from './forge';
import type { LlmClientDebugEvent } from './llm-client';

export type EnchantOpenTelemetryAttributeValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | boolean[];

export type EnchantOpenTelemetryAttributes =
  Record<string, EnchantOpenTelemetryAttributeValue | undefined>;

export interface EnchantOpenTelemetrySpan {
  setAttribute(name: string, value: EnchantOpenTelemetryAttributeValue): this;
  setAttributes(attributes: EnchantOpenTelemetryAttributes): this;
  addEvent(name: string, attributes?: EnchantOpenTelemetryAttributes): this;
  setStatus(status: { code: number; message?: string }): this;
  recordException(error: Error | string): void;
  end(): void;
}

export interface EnchantOpenTelemetryTracer {
  startSpan(
    name: string,
    options: { attributes?: EnchantOpenTelemetryAttributes }
  ): EnchantOpenTelemetrySpan;
  startActiveSpan<T>(
    name: string,
    options: { attributes?: EnchantOpenTelemetryAttributes },
    callback: (span: EnchantOpenTelemetrySpan) => T
  ): T;
}

export interface EnchantOpenTelemetryCounter {
  add(value: number, attributes?: EnchantOpenTelemetryAttributes): void;
}

export interface EnchantOpenTelemetryHistogram {
  record(value: number, attributes?: EnchantOpenTelemetryAttributes): void;
}

export interface EnchantOpenTelemetryMeter {
  createCounter(
    name: string,
    options?: { description?: string; unit?: string }
  ): EnchantOpenTelemetryCounter;
  createHistogram(
    name: string,
    options?: { description?: string; unit?: string }
  ): EnchantOpenTelemetryHistogram;
}

export interface EnchantOpenTelemetryOptions {
  tracer: EnchantOpenTelemetryTracer;
  meter?: EnchantOpenTelemetryMeter;
  attributes?: EnchantOpenTelemetryAttributes;
  captureInputs?: boolean;
  captureOutputs?: boolean;
  contentLimit?: number;
}

const SPAN_STATUS_OK = 1;
const SPAN_STATUS_ERROR = 2;

function compact(attributes: EnchantOpenTelemetryAttributes) {
  return Object.fromEntries(
    Object.entries(attributes).filter((entry): entry is [string, EnchantOpenTelemetryAttributeValue] =>
      entry[1] !== undefined)
  );
}

function serialize(value: unknown, limit: number) {
  let serialized: string;
  try {
    serialized = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    serialized = String(value);
  }
  return serialized.length <= limit
    ? serialized
    : `${serialized.slice(0, limit)}...`;
}

function errorValue(error: unknown) {
  return error instanceof Error ? error : String(error);
}

function record(value: unknown): Record<string, any> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : undefined;
}

function numeric(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function capabilityAttributes(
  request: EnchantExecutionMiddlewareRequest,
  common: EnchantOpenTelemetryAttributes
) {
  return compact({
    ...common,
    'enchantforge.operation.name': 'capability.execute',
    'enchantforge.page': request.enchantment.page,
    'enchantforge.enchantment.id': request.enchantment.id,
    'enchantforge.capability.id': request.capability.id,
    'enchantforge.capability.name': request.capability.name,
    'enchantforge.capability.effect': request.capability.effect,
    'enchantforge.capability.owner': request.capability.owner,
    'enchantforge.capability.provider': request.capability.provider
  });
}

function runAttributes(
  request: EnchantRunMiddlewareRequest,
  common: EnchantOpenTelemetryAttributes
) {
  return compact({
    ...common,
    'enchantforge.operation.name': 'agent.run',
    'enchantforge.page': request.options.page,
    'enchantforge.enchantment.id': request.options.enchantmentId,
    'enchantforge.agent.id': request.options.agentId
  });
}

export function createEnchantOpenTelemetry(
  options: EnchantOpenTelemetryOptions
): EnchantForgePlugin {
  const contentLimit = Math.max(128, options.contentLimit ?? 4096);

  return {
    name: 'enchant-opentelemetry',
    setup(forge) {
      const runCount = options.meter?.createCounter('enchantforge.agent.run.count', {
        description: 'Completed EnchantForge Agent runs',
        unit: '{run}'
      });
      const runDuration = options.meter?.createHistogram('enchantforge.agent.run.duration', {
        description: 'EnchantForge Agent run duration',
        unit: 's'
      });
      const capabilityCount = options.meter?.createCounter('enchantforge.capability.execution.count', {
        description: 'Completed EnchantForge capability executions',
        unit: '{execution}'
      });
      const capabilityDuration = options.meter?.createHistogram('enchantforge.capability.execution.duration', {
        description: 'EnchantForge capability execution duration',
        unit: 's'
      });
      const llmRequestCount = options.meter?.createCounter('enchantforge.llm.request.count', {
        description: 'Completed EnchantForge LLM requests',
        unit: '{request}'
      });
      const llmRequestDuration = options.meter?.createHistogram('enchantforge.llm.request.duration', {
        description: 'EnchantForge LLM request duration',
        unit: 's'
      });
      const llmSpans = new Map<string, {
        span: EnchantOpenTelemetrySpan;
        attributes: EnchantOpenTelemetryAttributes;
        startedAt: number;
      }>();

      const unregisterRun = forge.registerRunMiddleware((request, next) => {
        const attributes = runAttributes(request, options.attributes ?? {});
        if (options.captureInputs) {
          attributes['enchantforge.input'] = serialize(request.options.input, contentLimit);
        }
        return options.tracer.startActiveSpan(
          'enchantforge.agent.run',
          { attributes },
          async (span) => {
            const startedAt = performance.now();
            let outcome = 'success';
            try {
              const result = await next();
              const failedResults = result.results.filter((item) => !item.ok).length;
              outcome = failedResults ? 'failed' : 'success';
              span.setAttributes(compact({
                'enchantforge.run.id': result.runId,
                'enchantforge.plan.call.count': result.plan.calls.length,
                'enchantforge.result.count': result.results.length,
                'enchantforge.result.failed.count': failedResults
              }));
              if (options.captureOutputs) {
                span.setAttribute('enchantforge.output', serialize({
                  message: result.message,
                  results: result.results
                }, contentLimit));
              }
              span.setStatus({
                code: failedResults ? SPAN_STATUS_ERROR : SPAN_STATUS_OK,
                ...(failedResults ? { message: `${failedResults} capability executions failed` } : {})
              });
              return result;
            } catch (error) {
              outcome = 'error';
              span.recordException(errorValue(error));
              span.setStatus({
                code: SPAN_STATUS_ERROR,
                message: error instanceof Error ? error.message : String(error)
              });
              throw error;
            } finally {
              const duration = (performance.now() - startedAt) / 1000;
              const metricAttributes = compact({ ...attributes, 'enchantforge.outcome': outcome });
              runCount?.add(1, metricAttributes);
              runDuration?.record(duration, metricAttributes);
              span.end();
            }
          }
        );
      });

      const unregisterExecution = forge.registerExecutionMiddleware((request, next) => {
        const attributes = capabilityAttributes(request, options.attributes ?? {});
        if (options.captureInputs) {
          attributes['enchantforge.capability.input'] = serialize(request.input, contentLimit);
        }
        return options.tracer.startActiveSpan(
          'enchantforge.capability.execute',
          { attributes },
          async (span) => {
            const startedAt = performance.now();
            let outcome = 'success';
            try {
              const result = await next();
              const status = result && typeof result === 'object' && 'status' in result
                ? String(result.status)
                : 'success';
              outcome = status === 'failed' ? 'failed' : status;
              span.setAttribute('enchantforge.capability.status', status);
              if (options.captureOutputs) {
                span.setAttribute('enchantforge.capability.output', serialize(result, contentLimit));
              }
              span.setStatus({
                code: status === 'failed' ? SPAN_STATUS_ERROR : SPAN_STATUS_OK,
                ...(status === 'failed' ? { message: 'Capability returned failed status' } : {})
              });
              return result;
            } catch (error) {
              outcome = 'error';
              span.recordException(errorValue(error));
              span.setStatus({
                code: SPAN_STATUS_ERROR,
                message: error instanceof Error ? error.message : String(error)
              });
              throw error;
            } finally {
              const duration = (performance.now() - startedAt) / 1000;
              const metricAttributes = compact({ ...attributes, 'enchantforge.outcome': outcome });
              capabilityCount?.add(1, metricAttributes);
              capabilityDuration?.record(duration, metricAttributes);
              span.end();
            }
          }
        );
      });

      const unsubscribeLlm = forge.subscribeLlm((event: LlmClientDebugEvent) => {
        const detail = record(event.detail);
        if (event.phase === 'request') {
          const body = record(detail?.body);
          const model = typeof body?.model === 'string' ? body.model : undefined;
          const attributes = compact({
            ...(options.attributes ?? {}),
            'enchantforge.operation.name': 'llm.request',
            'gen_ai.operation.name': 'chat',
            'gen_ai.request.model': model,
            'gen_ai.request.max_tokens': numeric(body?.max_tokens),
            'enchantforge.llm.tool.count': Array.isArray(body?.tools) ? body.tools.length : 0,
            'enchantforge.llm.tool_choice': typeof body?.tool_choice === 'string'
              ? body.tool_choice
              : undefined
          });
          if (options.captureInputs && body?.messages !== undefined) {
            attributes['gen_ai.input.messages'] = serialize(body.messages, contentLimit);
          }
          const span = options.tracer.startSpan('enchantforge.llm.request', { attributes });
          llmSpans.set(event.requestId, {
            span,
            attributes,
            startedAt: performance.now()
          });
          return;
        }

        const active = llmSpans.get(event.requestId);
        if (!active) return;
        llmSpans.delete(event.requestId);
        const duration = (event.durationMs ?? (performance.now() - active.startedAt)) / 1000;
        let outcome = 'success';

        if (event.phase === 'response') {
          const payload = record(detail?.payload);
          const choice = record(Array.isArray(payload?.choices) ? payload.choices[0] : undefined);
          const message = record(choice?.message);
          const usage = record(detail?.usage) ?? record(payload?.usage);
          const status = numeric(detail?.status);
          const failed = status !== undefined && status >= 400;
          outcome = failed ? 'failed' : 'success';
          active.span.setAttributes(compact({
            'gen_ai.response.model': typeof payload?.model === 'string' ? payload.model : undefined,
            'gen_ai.response.finish_reasons': typeof detail?.finishReason === 'string'
              ? [detail.finishReason]
              : undefined,
            'gen_ai.usage.input_tokens': numeric(usage?.prompt_tokens) ?? numeric(usage?.input_tokens),
            'gen_ai.usage.output_tokens': numeric(usage?.completion_tokens) ?? numeric(usage?.output_tokens),
            'http.response.status_code': status,
            'enchantforge.llm.tool_call.count': Array.isArray(message?.tool_calls)
              ? message.tool_calls.length
              : 0
          }));
          if (options.captureOutputs && message !== undefined) {
            active.span.setAttribute('gen_ai.output.messages', serialize([message], contentLimit));
          }
          active.span.setStatus({
            code: failed ? SPAN_STATUS_ERROR : SPAN_STATUS_OK,
            ...(failed ? { message: `LLM request failed with HTTP ${status}` } : {})
          });
        } else {
          outcome = 'error';
          const error = typeof event.detail === 'string'
            ? event.detail
            : serialize(event.detail, contentLimit);
          active.span.recordException(error);
          active.span.setStatus({ code: SPAN_STATUS_ERROR, message: error });
        }

        const metricAttributes = compact({
          ...active.attributes,
          'enchantforge.outcome': outcome
        });
        llmRequestCount?.add(1, metricAttributes);
        llmRequestDuration?.record(duration, metricAttributes);
        active.span.end();
      });

      return () => {
        unsubscribeLlm();
        llmSpans.forEach(({ span }) => {
          span.setStatus({ code: SPAN_STATUS_ERROR, message: 'EnchantForge disposed before LLM response' });
          span.end();
        });
        llmSpans.clear();
        unregisterExecution();
        unregisterRun();
      };
    }
  };
}
