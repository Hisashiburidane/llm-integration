import type {
  EnchantExecutionMiddlewareRequest,
  EnchantForgePlugin,
  EnchantRunMiddlewareRequest
} from './forge';

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

      return () => {
        unregisterExecution();
        unregisterRun();
      };
    }
  };
}
