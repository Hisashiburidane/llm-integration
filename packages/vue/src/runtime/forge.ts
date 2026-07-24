import {
  computed,
  inject,
  onScopeDispose,
  reactive,
  readonly,
  ref,
  shallowRef,
  shallowReactive,
  watch,
  type App,
  type ComputedRef,
  type InjectionKey,
  type Plugin,
  type Ref
} from 'vue';
import { createDefaultEnchantAgent, type EnchantAgent } from './agent';
import { vEnchant, vEnchantIgnore } from './dom-directives';
import type {
  EnchantCapability,
  EnchantCapabilityResult,
  EnchantContribution,
  EnchantExecutionResult,
  Enchantment,
  EnchantMetadataNode,
  EnchantPlan,
  EnchantPlanCall,
  EnchantProgressEvent,
  EnchantRegistration,
  EnchantRegistryDigest,
  EnchantRunResult,
  EnchantSnapshot,
  EnchantTool,
  EnchantTraceEvent
} from './enchantment';
import type { LlmClient, LlmClientOptions } from './llm-client';
import {
  evaluateEnchantPolicy,
  resolveEnchantPolicy,
  type EnchantPolicy,
  type EnchantPolicyDecision
} from './policy';
import type { EnchantNavigationInput, EnchantNavigationSource, EnchantNavigationState } from './navigation';
import { createEnchantRegistry, type EnchantRegistry, type EnchantSnapshotOptions } from './registry';

export interface EnchantSnapshotConfig {
  autoCapture: boolean;
  retention: number;
  throttle: number;
}

export interface EnchantRunOptions {
  input: string;
  page?: string;
  enchantmentId?: string;
  prompt?: string;
  agent?: EnchantAgent;
  signal?: AbortSignal;
  confirmed?: boolean;
  confirm?: (request: EnchantConfirmationRequest) => boolean | Promise<boolean>;
  onProgress?: (event: EnchantProgressEvent) => void;
}

export interface EnchantConfirmationRequest {
  runId: string;
  call: EnchantPlanCall;
  snapshot: EnchantSnapshot;
  capability: EnchantCapability;
  decision: EnchantPolicyDecision;
}

export interface EnchantExecuteOptions {
  snapshot: EnchantSnapshot;
  runId?: string;
  confirmed?: boolean;
  confirm?: (request: EnchantConfirmationRequest) => boolean | Promise<boolean>;
  signal?: AbortSignal;
  onProgress?: (event: EnchantProgressEvent) => void;
}

export interface EnchantForgeOptions {
  llm?: LlmClientOptions;
  llmClient?: LlmClient;
  agent?: EnchantAgent;
  policy?: Partial<EnchantPolicy>;
  snapshots?: Partial<EnchantSnapshotConfig>;
  maxPlanCalls?: number;
  traceLimit?: number;
  onTrace?: (event: EnchantTraceEvent) => void;
}

export interface EnchantCapabilityExporter<T = unknown> {
  name: string;
  export(snapshot: EnchantSnapshot, options?: EnchantSnapshotOptions): T;
}

export interface EnchantForgePlugin {
  name: string;
  setup(forge: EnchantForge): void | (() => void);
}

export interface EnchantContext {
  id: string;
  enchantment: Ref<Enchantment | undefined>;
  refresh(): EnchantSnapshot;
  registerContribution(contribution: EnchantContribution): () => void;
}

export type EnchantForge = Plugin & {
  readonly registry: EnchantRegistry;
  readonly policy: EnchantPolicy;
  readonly agent: EnchantAgent;
  readonly events: readonly EnchantTraceEvent[];
  readonly snapshots: readonly EnchantSnapshot[];
  readonly observationEnabled: Readonly<Ref<boolean>>;
  readonly navigation: Readonly<EnchantNavigationState>;
  readonly exporters: readonly string[];
  digest(options?: Pick<EnchantSnapshotOptions, 'page' | 'includeLocal' | 'includeHidden'>): EnchantRegistryDigest;
  capture(options?: EnchantSnapshotOptions): EnchantSnapshot;
  snapshot(options?: EnchantSnapshotOptions): EnchantSnapshot;
  run(options: EnchantRunOptions | string): Promise<EnchantRunResult>;
  execute(call: EnchantPlanCall, options: EnchantExecuteOptions): Promise<EnchantExecutionResult>;
  exportCapabilities<T = EnchantTool[]>(
    exporter?: string | EnchantCapabilityExporter<T>,
    options?: EnchantSnapshotOptions
  ): T;
  registerExporter<T>(exporter: EnchantCapabilityExporter<T>): () => void;
  configurePolicy(config: Partial<EnchantPolicy>): void;
  syncNavigation(input: EnchantNavigationInput): void;
  bindNavigation(source: EnchantNavigationSource): () => void;
  dispose(): void;
  configureSnapshots(config: Partial<EnchantSnapshotConfig>): void;
  use(plugin: EnchantForgePlugin): EnchantForge;
  trace(event: Omit<EnchantTraceEvent, 'id' | 'timestamp'>): EnchantTraceEvent;
  clearTrace(sourcePrefix?: string): void;
  clearSnapshots(): void;
};

export const enchantForgeKey: InjectionKey<EnchantForge> = Symbol('enchant-forge');
export const enchantContextKey: InjectionKey<EnchantContext> = Symbol('enchant-context');

let latestInstalledForge: EnchantForge | undefined;

function throwIfAborted(signal: AbortSignal | undefined) {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw new Error('操作已取消。');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function matchesSchemaType(type: string, value: unknown) {
  if (type === 'null') return value === null;
  if (type === 'object') return isRecord(value);
  if (type === 'array') return Array.isArray(value);
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

function validateInput(schema: Record<string, unknown> | undefined, input: unknown, path = 'input') {
  if (!schema) return;

  const enumValues = Array.isArray(schema.enum) ? schema.enum : undefined;
  if (enumValues && !enumValues.some((value) => Object.is(value, input))) {
    throw new Error(`${path} 不在允许的枚举值中。`);
  }

  if (typeof schema.type === 'string' && !matchesSchemaType(schema.type, input)) {
    throw new Error(`${path} 类型无效，应为 ${schema.type}。`);
  }

  if (typeof input === 'string') {
    if (typeof schema.minLength === 'number' && input.length < schema.minLength) {
      throw new Error(`${path} 长度不能小于 ${schema.minLength}。`);
    }
    if (typeof schema.maxLength === 'number' && input.length > schema.maxLength) {
      throw new Error(`${path} 长度不能超过 ${schema.maxLength}。`);
    }
  }

  if (Array.isArray(input)) {
    if (typeof schema.minItems === 'number' && input.length < schema.minItems) {
      throw new Error(`${path} 至少需要 ${schema.minItems} 项。`);
    }
    if (typeof schema.maxItems === 'number' && input.length > schema.maxItems) {
      throw new Error(`${path} 最多允许 ${schema.maxItems} 项。`);
    }
    if (isRecord(schema.items)) {
      input.forEach((item, index) => validateInput(schema.items as Record<string, unknown>, item, `${path}[${index}]`));
    }
    return;
  }

  const properties = isRecord(schema.properties) ? schema.properties : undefined;
  if (!isRecord(input) || (!properties && schema.type !== 'object')) return;

  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const key of required) {
    if (typeof key === 'string' && !Object.prototype.hasOwnProperty.call(input, key)) {
      throw new Error(`${path}.${key} 为必填项。`);
    }
  }

  if (schema.additionalProperties === false) {
    const known = new Set(Object.keys(properties ?? {}));
    const unknown = Object.keys(input).filter((key) => !known.has(key));
    if (unknown.length) throw new Error(`${path} 包含未声明字段：${unknown.join(', ')}。`);
  }

  Object.entries(properties ?? {}).forEach(([key, value]) => {
    if (Object.prototype.hasOwnProperty.call(input, key) && isRecord(value)) {
      validateInput(value, input[key], `${path}.${key}`);
    }
  });
}

function maskValue(value: unknown) {
  const text = value == null ? '' : String(value);
  if (text.length <= 2) return '*'.repeat(text.length);
  return `${text.slice(0, 1)}${'*'.repeat(Math.min(8, text.length - 2))}${text.slice(-1)}`;
}

function redactMetadata(nodes: EnchantMetadataNode[], policy: EnchantPolicy): EnchantMetadataNode[] {
  return nodes.map((node) => {
    if ((node.kind === 'region' || node.kind === 'panel' || node.kind === 'dialog') && 'children' in node) {
      return { ...node, children: redactMetadata(node.children, policy) };
    }
    if (node.kind !== 'field') return { ...node };
    const field = node as Extract<EnchantMetadataNode, { kind: 'field' }>;
    const rule = policy.valuePolicy[field.id]
      ?? (field.semanticType ? policy.valuePolicy[field.semanticType] : undefined)
      ?? 'expose';
    if (rule === 'omit') return { ...field, value: undefined };
    if (rule === 'mask') return { ...field, value: maskValue(field.value) };
    return { ...field };
  });
}

function isCapabilityResult(value: unknown): value is EnchantCapabilityResult {
  if (!value || typeof value !== 'object') return false;
  return ['success', 'partial', 'failed'].includes(String((value as EnchantCapabilityResult).status));
}

function createFinalMessage(plan: EnchantPlan, results: EnchantExecutionResult[]) {
  const failures = results.filter((result) => !result.ok);
  if (failures.length) {
    const detail = failures.map((result) => result.error).filter(Boolean).join('\n');
    return [plan.message.trim(), detail].filter(Boolean).join('\n') || '操作未完成。';
  }
  const summaries = results.map((result) => result.summary?.trim()).filter(Boolean);
  return plan.message.trim()
    || summaries.join('\n')
    || (results.length ? `已完成 ${results.length} 项操作。` : '当前页面没有可执行的匹配操作。');
}

export function createEnchantForge(options: EnchantForgeOptions = {}): EnchantForge {
  const registry = createEnchantRegistry();
  const policy = shallowReactive(resolveEnchantPolicy(options.policy)) as EnchantPolicy;
  const agent = options.agent ?? createDefaultEnchantAgent(options.llm, options.llmClient);
  const events = shallowReactive<EnchantTraceEvent[]>([]);
  const retainedSnapshots = shallowReactive<EnchantSnapshot[]>([]);
  const observationEnabled = ref(Boolean(options.snapshots?.autoCapture));
  const navigation = reactive<EnchantNavigationState>({
    app: undefined,
    page: undefined,
    route: undefined,
    tab: undefined,
    tags: []
  });
  const snapshotConfig: EnchantSnapshotConfig = {
    autoCapture: options.snapshots?.autoCapture ?? false,
    retention: Math.max(0, options.snapshots?.retention ?? 0),
    throttle: Math.max(0, options.snapshots?.throttle ?? 120)
  };
  const traceLimit = Math.max(20, options.traceLimit ?? 200);
  const maxPlanCalls = Math.max(1, options.maxPlanCalls ?? 20);
  const pluginCleanups: Array<() => void> = [];
  let autoCaptureTimer: ReturnType<typeof setTimeout> | undefined;
  let installedApp: App | undefined;
  let disposed = false;
  const exporters = new Map<string, EnchantCapabilityExporter<unknown>>();

  exporters.set('tools', {
    name: 'tools',
    export(snapshot) {
      return snapshot.tools;
    }
  });

  function trace(event: Omit<EnchantTraceEvent, 'id' | 'timestamp'>) {
    const complete: EnchantTraceEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      ...event
    };
    events.unshift(complete);
    if (events.length > traceLimit) events.splice(traceLimit);
    options.onTrace?.(complete);
    return complete;
  }

  function retainSnapshot(snapshot: EnchantSnapshot) {
    if (snapshotConfig.retention <= 0) return;
    retainedSnapshots.unshift(snapshot);
    if (retainedSnapshots.length > snapshotConfig.retention) retainedSnapshots.splice(snapshotConfig.retention);
  }

  function resolveSnapshotOptions(snapshotOptions: EnchantSnapshotOptions = {}): EnchantSnapshotOptions {
    return {
      ...snapshotOptions,
      app: snapshotOptions.app ?? navigation.app,
      page: snapshotOptions.page ?? navigation.page,
      route: snapshotOptions.route ?? navigation.route,
      tab: snapshotOptions.tab ?? navigation.tab,
      tags: snapshotOptions.tags ?? navigation.tags
    };
  }

  function capture(snapshotOptions: EnchantSnapshotOptions = {}) {
    const resolvedOptions = resolveSnapshotOptions(snapshotOptions);
    const raw = registry.capture(resolvedOptions);
    const enchantments = raw.enchantments.map((enchantment) => ({
      ...enchantment,
      metadata: redactMetadata(enchantment.metadata, policy)
    }));
    const allowedIds = new Set(raw.tools.filter((tool) => {
      const capability = registry.getCapability(tool.capabilityId);
      const enchantment = raw.enchantments.find((item) => item.id === tool.enchantmentId);
      return Boolean(capability && enchantment && evaluateEnchantPolicy(policy, capability, enchantment).allowed);
    }).map((tool) => tool.capabilityId));
    const value: EnchantSnapshot = {
      ...raw,
      enchantments,
      tools: raw.tools.filter((tool) => allowedIds.has(tool.capabilityId))
    };
    if (snapshotOptions.retain ?? snapshotConfig.retention > 0) retainSnapshot(value);
    trace({
      source: value.pageId,
      kind: 'snapshot',
      title: 'Snapshot captured',
      detail: { id: value.id, version: value.version, enchantments: value.enchantments.length, tools: value.tools.length }
    });
    return value;
  }

  function configurePolicy(config: Partial<EnchantPolicy>) {
    const next = resolveEnchantPolicy({ ...policy, ...config });
    Object.assign(policy, next);
    registry.touch();
    trace({ source: 'policy', kind: 'policy', title: 'Policy updated', detail: { mode: policy.mode } });
  }

  function syncNavigation(input: EnchantNavigationInput) {
    const next = {
      app: input.app ?? navigation.app,
      page: input.page ?? navigation.page,
      route: input.route ?? navigation.route,
      tab: input.tab ?? navigation.tab,
      tags: input.tags ? [...input.tags] : navigation.tags
    };
    const changed = next.app !== navigation.app
      || next.page !== navigation.page
      || next.route !== navigation.route
      || next.tab !== navigation.tab
      || next.tags.length !== navigation.tags.length
      || next.tags.some((tag, index) => tag !== navigation.tags[index]);
    if (!changed) return;
    Object.assign(navigation, next);
    registry.touch();
    trace({ source: 'navigation', kind: 'info', title: 'Navigation synchronized', detail: next });
  }

  function bindNavigation(source: EnchantNavigationSource) {
    const read = typeof source === 'function' ? source : () => source.value;
    const stop = watch(read, (value) => {
      if (value) syncNavigation(value);
    }, { immediate: true, deep: true });
    return stop;
  }

  function exportCapabilities<T = EnchantTool[]>(
    exporter: string | EnchantCapabilityExporter<T> = 'tools',
    snapshotOptions: EnchantSnapshotOptions = {}
  ): T {
    const snapshot = capture(snapshotOptions);
    const resolved = typeof exporter === 'string' ? exporters.get(exporter) : exporter;
    if (!resolved) throw new Error(`未注册 capability exporter：${exporter}。`);
    return resolved.export(snapshot, snapshotOptions) as T;
  }

  function registerExporter<T>(exporter: EnchantCapabilityExporter<T>) {
    if (!exporter.name.trim()) throw new Error('Capability exporter 必须提供 name。');
    if (exporters.has(exporter.name)) throw new Error(`Capability exporter 已存在：${exporter.name}。`);
    exporters.set(exporter.name, exporter as EnchantCapabilityExporter<unknown>);
    return () => {
      if (exporters.get(exporter.name) === exporter) exporters.delete(exporter.name);
    };
  }

  function emitProgress(
    runId: string,
    phase: EnchantProgressEvent['phase'],
    listener?: (event: EnchantProgressEvent) => void,
    detail: Partial<Omit<EnchantProgressEvent, 'id' | 'runId' | 'phase' | 'timestamp'>> = {}
  ) {
    const event: EnchantProgressEvent = {
      id: `${runId}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      runId,
      phase,
      timestamp: new Date().toISOString(),
      ...detail
    };
    listener?.(event);
    trace({ source: detail.capabilityId ?? runId, kind: 'progress', title: phase, detail: event });
  }

  async function execute(call: EnchantPlanCall, executeOptions: EnchantExecuteOptions): Promise<EnchantExecutionResult> {
    const runId = executeOptions.runId ?? `execute-${Date.now()}`;
    if (executeOptions.signal?.aborted) {
      const error = '操作已取消。';
      trace({ source: call.capabilityId, kind: 'error', title: 'Capability cancelled', detail: error });
      return { capabilityId: call.capabilityId, ok: false, status: 'failed', error };
    }
    if (registry.version.value !== executeOptions.snapshot.version) {
      const error = `Snapshot 已失效（${executeOptions.snapshot.version} -> ${registry.version.value}），拒绝执行。`;
      trace({ source: call.capabilityId, kind: 'error', title: 'Stale snapshot rejected', detail: error });
      return { capabilityId: call.capabilityId, ok: false, status: 'failed', error };
    }
    const capability = registry.getCapability(call.capabilityId);
    const snapshotEnchantment = capability
      ? executeOptions.snapshot.enchantments.find((item) => item.id === capability.enchantmentId)
      : undefined;
    const registration = capability ? registry.getRegistration(capability.enchantmentId) : undefined;
    const enchantment = snapshotEnchantment && registration
      ? { ...snapshotEnchantment, status: registration.getStatus() }
      : undefined;
    const exposed = executeOptions.snapshot.tools.some((tool) => tool.capabilityId === call.capabilityId);

    if (!capability || !enchantment || !exposed) {
      const error = 'Capability 不属于本次 snapshot 或已失效。';
      trace({ source: call.capabilityId, kind: 'error', title: 'Capability rejected', detail: error });
      return { capabilityId: call.capabilityId, ok: false, status: 'failed', error };
    }

    emitProgress(runId, 'authorizing', executeOptions.onProgress, {
      capabilityId: capability.id,
      capabilityLabel: capability.label
    });
    const decision = evaluateEnchantPolicy(policy, capability, enchantment);
    trace({ source: call.capabilityId, kind: 'policy', title: decision.allowed ? 'Policy allowed' : 'Policy blocked', detail: decision });
    if (!decision.allowed) return { capabilityId: call.capabilityId, ok: false, status: 'failed', error: decision.reason };
    try {
      let confirmed = Boolean(executeOptions.confirmed);
      if (decision.requiresConfirmation && !confirmed && executeOptions.confirm) {
        confirmed = await executeOptions.confirm({
          runId,
          call,
          snapshot: executeOptions.snapshot,
          capability,
          decision
        });
      }
      if (decision.requiresConfirmation && !confirmed) {
        return { capabilityId: call.capabilityId, ok: false, status: 'failed', error: '该操作需要用户确认。' };
      }
      validateInput(capability.inputSchema, call.input ?? {});
      emitProgress(runId, 'executing', executeOptions.onProgress, {
        capabilityId: capability.id,
        capabilityLabel: capability.label
      });
      trace({ source: call.capabilityId, kind: 'action', title: capability.label, detail: call.input });
      const value = await capability.execute(call.input ?? {}, {
        enchantment,
        snapshotVersion: executeOptions.snapshot.version,
        signal: executeOptions.signal,
        reportProgress(detail) {
          emitProgress(runId, 'executing', executeOptions.onProgress, {
            capabilityId: capability.id,
            capabilityLabel: capability.label,
            current: detail.current,
            total: detail.total,
            detail: detail.label
          });
        }
      });
      const normalized = isCapabilityResult(value) ? value : undefined;
      const warning = registry.version.value !== executeOptions.snapshot.version
        ? '执行期间页面 registry 已变化；结果基于调用时仍有效的 capability。'
        : undefined;
      const result: EnchantExecutionResult = {
        capabilityId: call.capabilityId,
        ok: normalized?.status !== 'failed',
        status: normalized?.status ?? 'success',
        summary: normalized?.summary,
        value: normalized?.data ?? value,
        warning: normalized?.warnings?.join('\n') || warning
      };
      trace({
        source: call.capabilityId,
        kind: 'result',
        title: result.ok ? 'Capability completed' : 'Capability returned failure',
        detail: result
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Capability 执行失败。';
      trace({ source: call.capabilityId, kind: 'error', title: 'Capability failed', detail: message });
      return { capabilityId: call.capabilityId, ok: false, status: 'failed', error: message };
    }
  }

  async function run(value: EnchantRunOptions | string): Promise<EnchantRunResult> {
    const request = typeof value === 'string' ? { input: value } : value;
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      throwIfAborted(request.signal);
      emitProgress(runId, 'capturing', request.onProgress);
      const current = capture({
        page: request.page,
        enchantmentIds: request.enchantmentId ? [request.enchantmentId] : undefined,
        includeLocal: Boolean(request.enchantmentId)
      });
      trace({ source: current.pageId, kind: 'request', title: 'Agent request', detail: { input: request.input, snapshotId: current.id } });
      emitProgress(runId, 'planning', request.onProgress);
      const plan = await (request.agent ?? agent).plan({
        input: request.input,
        snapshot: current,
        instruction: request.prompt,
        signal: request.signal
      });
      throwIfAborted(request.signal);
      if (plan.snapshotVersion !== current.version) {
        throw new Error(`Agent 计划的 snapshot version 无效，应为 ${current.version}。`);
      }
      if (plan.calls.length > maxPlanCalls) {
        throw new Error(`Agent 计划包含 ${plan.calls.length} 个调用，超过上限 ${maxPlanCalls}。`);
      }
      trace({ source: current.pageId, kind: 'plan', title: 'Agent plan', detail: plan });

      const results: EnchantExecutionResult[] = [];
      for (const call of plan.calls) {
        throwIfAborted(request.signal);
        results.push(await execute(call, {
          snapshot: current,
          runId,
          confirmed: request.confirmed,
          confirm: request.confirm,
          signal: request.signal,
          onProgress: request.onProgress
        }));
      }
      const message = createFinalMessage(plan, results);
      emitProgress(
        runId,
        results.some((result) => !result.ok) ? 'failed' : 'completed',
        request.onProgress,
        { detail: message }
      );
      return { runId, message, plan, results };
    } catch (error) {
      emitProgress(runId, 'failed', request.onProgress, {
        detail: error instanceof Error ? error.message : '执行失败。'
      });
      throw error;
    }
  }

  function scheduleAutoCapture() {
    if (!snapshotConfig.autoCapture) return;
    if (autoCaptureTimer) clearTimeout(autoCaptureTimer);
    autoCaptureTimer = setTimeout(() => capture({ retain: true }), snapshotConfig.throttle);
  }

  registry.subscribe(scheduleAutoCapture);

  function digest(digestOptions: Pick<EnchantSnapshotOptions, 'page' | 'includeLocal' | 'includeHidden'> = {}) {
    return registry.digest(resolveSnapshotOptions(digestOptions));
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (autoCaptureTimer) clearTimeout(autoCaptureTimer);
    while (pluginCleanups.length) pluginCleanups.pop()?.();
    registry.clear();
    if (latestInstalledForge === forge) latestInstalledForge = undefined;
  }

  const forge: EnchantForge = {
    install(app: App) {
      if (installedApp && installedApp !== app) throw new Error('同一个 EnchantForge 实例不能安装到多个 Vue app。');
      installedApp = app;
      latestInstalledForge = forge;
      app.provide(enchantForgeKey, forge);
      app.directive('enchant', vEnchant);
      app.directive('enchant-ignore', vEnchantIgnore);
    },
    registry,
    policy,
    agent,
    navigation: readonly(navigation) as Readonly<EnchantNavigationState>,
    get exporters() {
      return Array.from(exporters.keys());
    },
    get events() {
      return readonly(events) as unknown as readonly EnchantTraceEvent[];
    },
    get snapshots() {
      return readonly(retainedSnapshots) as unknown as readonly EnchantSnapshot[];
    },
    observationEnabled: readonly(observationEnabled),
    digest,
    capture,
    snapshot: capture,
    run,
    execute,
    exportCapabilities,
    registerExporter,
    configurePolicy,
    syncNavigation,
    bindNavigation,
    dispose,
    configureSnapshots(config) {
      if (config.autoCapture !== undefined) snapshotConfig.autoCapture = config.autoCapture;
      if (config.retention !== undefined) snapshotConfig.retention = Math.max(0, config.retention);
      if (config.throttle !== undefined) snapshotConfig.throttle = Math.max(0, config.throttle);
      observationEnabled.value = snapshotConfig.autoCapture;
      if (retainedSnapshots.length > snapshotConfig.retention) retainedSnapshots.splice(snapshotConfig.retention);
      if (snapshotConfig.autoCapture) scheduleAutoCapture();
    },
    use(plugin) {
      const cleanup = plugin.setup(forge);
      if (cleanup) pluginCleanups.push(cleanup);
      return forge;
    },
    trace,
    clearTrace(sourcePrefix?: string) {
      if (!sourcePrefix) {
        events.splice(0, events.length);
        return;
      }
      for (let index = events.length - 1; index >= 0; index -= 1) {
        if (events[index]?.source.startsWith(sourcePrefix)) events.splice(index, 1);
      }
    },
    clearSnapshots: () => retainedSnapshots.splice(0, retainedSnapshots.length)
  };

  return forge;
}

export function useEnchantForge(): EnchantForge;
export function useEnchantForge(required: true): EnchantForge;
export function useEnchantForge(required: false): EnchantForge | undefined;
export function useEnchantForge(required = true): EnchantForge | undefined {
  const forge = inject(enchantForgeKey, undefined);
  if (!forge && required) throw new Error('未安装 EnchantForge。请在 createApp 后调用 app.use(createEnchantForge(...))。');
  return forge;
}

export function useEnchant() {
  const forge = useEnchantForge();
  const context = inject(enchantContextKey, undefined);
  if (!context) throw new Error('useEnchant() 必须在 <Enchant> 内调用。');

  return {
    enchantment: computed(() => context.enchantment.value),
    capture: context.refresh,
    refresh: context.refresh,
    run: (value: string | Omit<EnchantRunOptions, 'enchantmentId'>) => forge.run({
      ...(typeof value === 'string' ? { input: value } : value),
      enchantmentId: context.id
    })
  };
}

export function useEnchantPage(page?: Ref<string | undefined> | ComputedRef<string | undefined>) {
  const forge = useEnchantForge();
  const activePage = page ?? computed(() => forge.navigation.page);
  const snapshot = shallowRef(forge.capture({ page: activePage.value, retain: true }));
  const stop = watch(
    [() => forge.registry.version.value, activePage],
    () => {
      snapshot.value = forge.capture({ page: activePage.value, retain: true });
    },
    { flush: 'post' }
  );
  onScopeDispose(stop);
  return readonly(snapshot);
}

export function useEnchantRegistry() {
  return useEnchantForge().registry;
}

export function getLatestEnchantForge() {
  return latestInstalledForge;
}
