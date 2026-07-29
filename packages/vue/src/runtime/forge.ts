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
import {
  buildEnchantLlmContext,
  createDefaultEnchantAgent,
  type EnchantAgent,
  type EnchantConversationMessage,
  type EnchantLlmContext
} from './agent';
import { vEnchant, vEnchantIgnore } from './dom-directives';
import type {
  EnchantCapability,
  EnchantCapabilityResult,
  EnchantContribution,
  EnchantExecutionContext,
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
import type {
  EnchantKnowledgeProvider,
  EnchantKnowledgeQuery,
  EnchantKnowledgeResult
} from './knowledge';
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
  agentId?: string;
  agent?: EnchantAgent;
  history?: readonly EnchantConversationMessage[];
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
  resolveAgent?: EnchantAgentResolver;
  knowledge?: EnchantKnowledgeProvider;
  policy?: Partial<EnchantPolicy>;
  snapshots?: Partial<EnchantSnapshotConfig>;
  maxPlanCalls?: number;
  maxPlanRounds?: number;
  traceLimit?: number;
  onTrace?: (event: EnchantTraceEvent) => void;
}

export interface EnchantCapabilityExporter<T = unknown> {
  name: string;
  export(snapshot: EnchantSnapshot, options?: EnchantSnapshotOptions): T;
}

export type EnchantAgentResolver = (agentId: string) => EnchantAgent | undefined;

export type EnchantContextScope = 'local' | 'page' | 'app';

export type EnchantModelContext = EnchantLlmContext;

export interface EnchantContextCaptureOptions<TTools = EnchantTool[]> extends EnchantSnapshotOptions {
  scope?: EnchantContextScope;
  enchantmentId?: string;
  exporter?: string | EnchantCapabilityExporter<TTools>;
}

export interface EnchantContextInstruction {
  enchantmentId: string;
  name?: string;
  instruction: string;
}

export interface EnchantContextBundle<TTools = EnchantTool[]> {
  /** Control provenance for safe execution. Do not send this object to a model by default. */
  snapshot: EnchantSnapshot;
  /** Provider-neutral, policy-filtered page semantics. */
  context: EnchantModelContext;
  /** Protocol-neutral tools, or an exporter-specific representation. */
  tools: TTools;
  /** Application and boundary rules kept separate from structural context. */
  instructions: EnchantContextInstruction[];
}

export interface EnchantForgePlugin {
  name: string;
  setup(forge: EnchantForge): void | (() => void);
  install?(forge: EnchantForge, app: App): void | (() => void);
}

export interface EnchantExecutionMiddlewareRequest {
  call: EnchantPlanCall;
  capability: EnchantCapability;
  enchantment: Enchantment;
  snapshot: EnchantSnapshot;
  input: unknown;
  context: EnchantExecutionContext;
}

export type EnchantExecutionMiddlewareNext = () => Promise<unknown>;

export type EnchantExecutionMiddleware = (
  request: EnchantExecutionMiddlewareRequest,
  next: EnchantExecutionMiddlewareNext
) => unknown | Promise<unknown>;

export interface EnchantRunMiddlewareRequest {
  options: EnchantRunOptions;
}

export type EnchantRunMiddlewareNext = () => Promise<EnchantRunResult>;

export type EnchantRunMiddleware = (
  request: EnchantRunMiddlewareRequest,
  next: EnchantRunMiddlewareNext
) => EnchantRunResult | Promise<EnchantRunResult>;

export interface EnchantDebugConfig {
  enabled: boolean;
  title: string;
  position: 'bottom-right' | 'bottom-left';
}

export interface EnchantContext {
  id: string;
  agentId: Readonly<Ref<string | undefined>>;
  enchantment: Ref<Enchantment | undefined>;
  refresh(): EnchantSnapshot;
  registerContribution(contribution: EnchantContribution): () => void;
}

export type EnchantForge = Plugin & {
  readonly registry: EnchantRegistry;
  readonly policy: EnchantPolicy;
  readonly agent: EnchantAgent;
  readonly knowledge?: EnchantKnowledgeProvider;
  readonly events: readonly EnchantTraceEvent[];
  readonly snapshots: readonly EnchantSnapshot[];
  readonly observationEnabled: Readonly<Ref<boolean>>;
  readonly debug: Readonly<EnchantDebugConfig>;
  readonly navigation: Readonly<EnchantNavigationState>;
  readonly exporters: readonly string[];
  digest(options?: Pick<EnchantSnapshotOptions, 'page' | 'route' | 'tab' | 'tags' | 'includeLocal' | 'includeHidden'>): EnchantRegistryDigest;
  capture(options?: EnchantSnapshotOptions): EnchantSnapshot;
  snapshot(options?: EnchantSnapshotOptions): EnchantSnapshot;
  captureContext<TTools = EnchantTool[]>(options?: EnchantContextCaptureOptions<TTools>): EnchantContextBundle<TTools>;
  run(options: EnchantRunOptions | string): Promise<EnchantRunResult>;
  execute(call: EnchantPlanCall, options: EnchantExecuteOptions): Promise<EnchantExecutionResult>;
  executeTool(call: EnchantPlanCall, options: EnchantExecuteOptions): Promise<EnchantExecutionResult>;
  resolveAgent(agentId?: string): EnchantAgent;
  retrieveKnowledge(query: EnchantKnowledgeQuery): Promise<EnchantKnowledgeResult>;
  exportSnapshot<T = EnchantTool[]>(
    snapshot: EnchantSnapshot,
    exporter?: string | EnchantCapabilityExporter<T>,
    options?: EnchantSnapshotOptions
  ): T;
  exportCapabilities<T = EnchantTool[]>(
    exporter?: string | EnchantCapabilityExporter<T>,
    options?: EnchantSnapshotOptions
  ): T;
  registerExporter<T>(exporter: EnchantCapabilityExporter<T>): () => void;
  registerExecutionMiddleware(middleware: EnchantExecutionMiddleware): () => void;
  registerRunMiddleware(middleware: EnchantRunMiddleware): () => void;
  configurePolicy(config: Partial<EnchantPolicy>): void;
  syncNavigation(input: EnchantNavigationInput): void;
  bindNavigation(source: EnchantNavigationSource): () => void;
  dispose(): void;
  configureSnapshots(config: Partial<EnchantSnapshotConfig>): void;
  configureDebug(config: Partial<EnchantDebugConfig>): void;
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

function capabilityContract(value: Pick<EnchantCapability, 'id' | 'enchantmentId' | 'owner' | 'provider' | 'name' | 'label' | 'description' | 'target' | 'effect' | 'inputSchema'> | Pick<EnchantTool, 'id' | 'capabilityId' | 'enchantmentId' | 'owner' | 'provider' | 'name' | 'label' | 'description' | 'target' | 'effect' | 'inputSchema'>) {
  return JSON.stringify({
    id: 'capabilityId' in value ? value.capabilityId : value.id,
    enchantmentId: value.enchantmentId,
    owner: value.owner,
    provider: value.provider,
    name: value.name,
    label: value.label,
    description: value.description,
    target: value.target,
    effect: value.effect,
    inputSchema: value.inputSchema
  });
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

function planCallKey(call: EnchantPlanCall) {
  return `${call.capabilityId}:${JSON.stringify(call.input ?? {})}`;
}

function combinePlans(plans: readonly EnchantPlan[]): EnchantPlan {
  return {
    message: [...plans].reverse().find((plan) => plan.message.trim())?.message ?? '',
    calls: plans.flatMap((plan) => plan.calls)
  };
}

export function createEnchantForge(options: EnchantForgeOptions = {}): EnchantForge {
  const registry = createEnchantRegistry();
  const policyState = shallowReactive(resolveEnchantPolicy(options.policy));
  const policy = readonly(policyState) as unknown as EnchantPolicy;
  const events = shallowReactive<EnchantTraceEvent[]>([]);
  const retainedSnapshots = shallowReactive<EnchantSnapshot[]>([]);
  const observationEnabled = ref(Boolean(options.snapshots?.autoCapture));
  const debugState = shallowReactive<EnchantDebugConfig>({
    enabled: false,
    title: 'Enchant Debug',
    position: 'bottom-right'
  });
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
  const maxPlanRounds = Math.max(0, options.maxPlanRounds ?? 3);
  const pluginCleanups: Array<() => void> = [];
  const plugins: EnchantForgePlugin[] = [];
  const executionMiddlewares: EnchantExecutionMiddleware[] = [];
  const runMiddlewares: EnchantRunMiddleware[] = [];
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

  const agent = options.agent ?? createDefaultEnchantAgent({
    ...options.llm,
    onDebug(event) {
      options.llm?.onDebug?.(event);
      if (!debugState.enabled) return;
      trace({
        source: event.requestId,
        kind: 'llm',
        title: `LLM ${event.phase}`,
        detail: event
      });
    }
  }, options.llmClient);

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

  function finalizeSnapshot(
    raw: EnchantSnapshot,
    snapshotOptions: EnchantSnapshotOptions,
    title = 'Snapshot captured'
  ) {
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
      title,
      detail: { id: value.id, version: value.version, enchantments: value.enchantments.length, tools: value.tools.length }
    });
    return value;
  }

  function capture(snapshotOptions: EnchantSnapshotOptions = {}) {
    const resolvedOptions = resolveSnapshotOptions(snapshotOptions);
    return finalizeSnapshot(registry.capture(resolvedOptions), snapshotOptions);
  }

  function exportSnapshot<T = EnchantTool[]>(
    snapshot: EnchantSnapshot,
    exporter: string | EnchantCapabilityExporter<T> = 'tools',
    snapshotOptions: EnchantSnapshotOptions = {}
  ): T {
    const resolved = typeof exporter === 'string' ? exporters.get(exporter) : exporter;
    if (!resolved) throw new Error(`未注册 capability exporter：${exporter}。`);
    return resolved.export(snapshot, snapshotOptions) as T;
  }

  function toModelContext(snapshot: EnchantSnapshot): EnchantModelContext {
    return buildEnchantLlmContext(snapshot);
  }

  function captureContext<TTools = EnchantTool[]>(
    contextOptions: EnchantContextCaptureOptions<TTools> = {}
  ): EnchantContextBundle<TTools> {
    const {
      scope = contextOptions.enchantmentId ? 'local' : 'page',
      enchantmentId,
      exporter = 'tools',
      ...snapshotOptions
    } = contextOptions;
    if (scope === 'local' && !enchantmentId) {
      throw new Error('local context 必须提供 enchantmentId。');
    }

    let snapshot: EnchantSnapshot;
    if (scope === 'app') {
      const raw = registry.capture({
        ...snapshotOptions,
        app: snapshotOptions.app ?? navigation.app,
        page: undefined,
        route: undefined,
        tab: undefined,
        tags: undefined
      });
      const appId = snapshotOptions.app ?? navigation.app ?? 'application';
      snapshot = finalizeSnapshot({
        ...raw,
        id: `${appId}:${raw.version}:${raw.createdAt}`,
        pageId: appId,
        metadataTree: { ...raw.metadataTree, id: appId, label: appId }
      }, snapshotOptions, 'Application context captured');
    } else {
      snapshot = capture({
        ...snapshotOptions,
        enchantmentIds: scope === 'local' ? [enchantmentId as string] : snapshotOptions.enchantmentIds,
        includeLocal: scope === 'local' ? true : snapshotOptions.includeLocal
      });
    }

    return {
      snapshot,
      context: toModelContext(snapshot),
      tools: exportSnapshot(snapshot, exporter, snapshotOptions),
      instructions: snapshot.enchantments
        .filter((enchantment) => enchantment.instruction)
        .map((enchantment) => ({
          enchantmentId: enchantment.id,
          name: enchantment.name,
          instruction: enchantment.instruction as string
        }))
    };
  }

  function configurePolicy(config: Partial<EnchantPolicy>) {
    const next = resolveEnchantPolicy({ ...policy, ...config });
    Object.assign(policyState, next);
    registry.touch();
    trace({ source: 'policy', kind: 'policy', title: 'Policy updated', detail: { mode: policy.mode } });
  }

  function syncNavigation(input: EnchantNavigationInput) {
    const has = (key: keyof EnchantNavigationInput) => Object.prototype.hasOwnProperty.call(input, key);
    const next = {
      app: has('app') ? input.app : navigation.app,
      page: has('page') ? input.page : navigation.page,
      route: has('route') ? input.route : navigation.route,
      tab: has('tab') ? input.tab : navigation.tab,
      tags: has('tags') ? [...(input.tags ?? [])] : navigation.tags
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
      syncNavigation(value ?? {
        app: undefined,
        page: undefined,
        route: undefined,
        tab: undefined,
        tags: []
      });
    }, { immediate: true, deep: true });
    return stop;
  }

  function exportCapabilities<T = EnchantTool[]>(
    exporter: string | EnchantCapabilityExporter<T> = 'tools',
    snapshotOptions: EnchantSnapshotOptions = {}
  ): T {
    const snapshot = capture(snapshotOptions);
    return exportSnapshot(snapshot, exporter, snapshotOptions);
  }

  function resolveAgent(agentId?: string) {
    if (!agentId) return agent;
    const resolved = options.resolveAgent?.(agentId);
    if (!resolved) throw new Error(`未解析到 Agent Client：${agentId}。`);
    return resolved;
  }

  async function retrieveKnowledge(query: EnchantKnowledgeQuery) {
    const provider = options.knowledge;
    if (!provider) throw new Error('当前 Forge 未配置 Knowledge Provider。');
    trace({
      source: provider.id,
      kind: 'request',
      title: 'Knowledge retrieval',
      detail: { query: query.query, topK: query.topK, filters: query.filters }
    });
    const result = await provider.retrieve(query);
    trace({
      source: provider.id,
      kind: 'result',
      title: 'Knowledge retrieved',
      detail: {
        query: result.query,
        chunks: result.chunks.map((chunk) => ({
          id: chunk.id,
          title: chunk.title,
          source: chunk.source,
          score: chunk.score
        }))
      }
    });
    return result;
  }

  function registerExporter<T>(exporter: EnchantCapabilityExporter<T>) {
    if (!exporter.name.trim()) throw new Error('Capability exporter 必须提供 name。');
    if (exporters.has(exporter.name)) throw new Error(`Capability exporter 已存在：${exporter.name}。`);
    exporters.set(exporter.name, exporter as EnchantCapabilityExporter<unknown>);
    return () => {
      if (exporters.get(exporter.name) === exporter) exporters.delete(exporter.name);
    };
  }

  function waitForRegistryStable(signal: AbortSignal | undefined, quietMs = 80, maxMs = 1000) {
    return new Promise<void>((resolve, reject) => {
      let quietTimer: ReturnType<typeof setTimeout> | undefined;
      let maxTimer: ReturnType<typeof setTimeout> | undefined;
      let settled = false;

      const cleanup = () => {
        if (quietTimer) clearTimeout(quietTimer);
        if (maxTimer) clearTimeout(maxTimer);
        unsubscribe();
        signal?.removeEventListener('abort', onAbort);
      };
      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const onAbort = () => {
        if (settled) return;
        settled = true;
        cleanup();
        try {
          throwIfAborted(signal);
        } catch (error) {
          reject(error);
        }
      };
      const scheduleQuietFinish = () => {
        if (quietTimer) clearTimeout(quietTimer);
        quietTimer = setTimeout(finish, quietMs);
      };
      const unsubscribe = registry.subscribe(scheduleQuietFinish);

      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener('abort', onAbort, { once: true });
      maxTimer = setTimeout(finish, maxMs);
      scheduleQuietFinish();
    });
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

  function invokeCapability(request: EnchantExecutionMiddlewareRequest) {
    let activeIndex = -1;
    const dispatch = async (index: number): Promise<unknown> => {
      if (index <= activeIndex) throw new Error('Execution middleware 的 next() 不能重复调用。');
      activeIndex = index;
      const middleware = executionMiddlewares[index];
      if (middleware) return middleware(request, () => dispatch(index + 1));
      return request.capability.execute(request.input, request.context);
    };
    return dispatch(0);
  }

  async function execute(call: EnchantPlanCall, executeOptions: EnchantExecuteOptions): Promise<EnchantExecutionResult> {
    const runId = executeOptions.runId ?? `execute-${Date.now()}`;
    if (executeOptions.signal?.aborted) {
      const error = '操作已取消。';
      trace({ source: call.capabilityId, kind: 'error', title: 'Capability cancelled', detail: error });
      return { capabilityId: call.capabilityId, ok: false, status: 'failed', error };
    }
    const plannedTool = executeOptions.snapshot.tools.find((tool) => tool.capabilityId === call.capabilityId);
    const capability = registry.getCapability(call.capabilityId);
    const snapshotEnchantment = plannedTool && capability
      ? executeOptions.snapshot.enchantments.find((item) => item.id === capability.enchantmentId)
      : undefined;
    const registration = capability ? registry.getRegistration(capability.enchantmentId) : undefined;
    const enchantment = snapshotEnchantment && registration
      ? { ...snapshotEnchantment, status: registration.getStatus() }
      : undefined;
    const contractMatches = Boolean(plannedTool && capability && capabilityContract(plannedTool) === capabilityContract(capability));

    if (!capability || !plannedTool || !enchantment || !contractMatches) {
      const error = 'Capability 当前未注册、未暴露或合约已变化，拒绝执行。';
      trace({ source: call.capabilityId, kind: 'error', title: 'Capability contract rejected', detail: error });
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
      const input = call.input ?? {};
      const context: EnchantExecutionContext = {
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
      };
      const value = await invokeCapability({
        call,
        capability,
        enchantment,
        snapshot: executeOptions.snapshot,
        input,
        context
      });
      const normalized = isCapabilityResult(value) ? value : undefined;
      const result: EnchantExecutionResult = {
        capabilityId: call.capabilityId,
        ok: normalized?.status !== 'failed',
        status: normalized?.status ?? 'success',
        summary: normalized?.summary,
        value: normalized?.data ?? value,
        warning: normalized?.warnings?.join('\n')
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

  async function performRun(request: EnchantRunOptions): Promise<EnchantRunResult> {
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      throwIfAborted(request.signal);
      emitProgress(runId, 'capturing', request.onProgress);
      await waitForRegistryStable(request.signal);
      throwIfAborted(request.signal);
      const captureOptions = {
        page: request.page,
        enchantmentIds: request.enchantmentId ? [request.enchantmentId] : undefined,
        includeLocal: Boolean(request.enchantmentId)
      };
      let current = capture(captureOptions);
      const selectedAgent = request.agent ?? resolveAgent(request.agentId);
      trace({ source: current.pageId, kind: 'request', title: 'Agent request', detail: { input: request.input, snapshotId: current.id } });
      emitProgress(runId, 'planning', request.onProgress);
      const initialPlan = await selectedAgent.plan({
        input: request.input,
        snapshot: current,
        instruction: request.prompt,
        history: request.history,
        signal: request.signal
      });
      throwIfAborted(request.signal);
      const plans: EnchantPlan[] = [];
      const results: EnchantExecutionResult[] = [];
      const executedCalls = new Set<string>();

      async function executePlan(plan: EnchantPlan, title: string) {
        const calls = plan.calls.filter((call) => {
          const key = planCallKey(call);
          if (executedCalls.has(key)) {
            trace({ source: current.pageId, kind: 'info', title: 'Duplicate capability call skipped', detail: call });
            return false;
          }
          executedCalls.add(key);
          return true;
        });
        if (!calls.length && plan.calls.length) return [];
        if (executedCalls.size > maxPlanCalls) {
          throw new Error(`Agent 计划累计包含 ${executedCalls.size} 个调用，超过上限 ${maxPlanCalls}。`);
        }
        const acceptedPlan = calls.length === plan.calls.length ? plan : { ...plan, calls };
        plans.push(acceptedPlan);
        trace({ source: current.pageId, kind: 'plan', title, detail: acceptedPlan });
        const roundResults: EnchantExecutionResult[] = [];
        for (const call of calls) {
          throwIfAborted(request.signal);
          const result = await execute(call, {
            snapshot: current,
            runId,
            confirmed: request.confirmed,
            confirm: request.confirm,
            signal: request.signal,
            onProgress: request.onProgress
          });
          results.push(result);
          roundResults.push(result);
        }
        return roundResults;
      }

      const initialResults = await executePlan(initialPlan, 'Agent plan');
      let continuationMessage = '';
      if (selectedAgent.planNext && initialResults.length) {
        for (let round = 1; round <= maxPlanRounds; round += 1) {
          throwIfAborted(request.signal);
          emitProgress(runId, 'planning', request.onProgress);
          const continuation = await selectedAgent.planNext({
            input: request.input,
            snapshot: current,
            plans,
            results,
            instruction: request.prompt,
            history: request.history,
            signal: request.signal
          });
          throwIfAborted(request.signal);
          if (!continuation?.plan?.calls.length) {
            continuationMessage = continuation?.message?.trim() ?? '';
            break;
          }
          const roundResults = await executePlan(continuation.plan, `Agent continuation ${round}`);
          if (!roundResults.length) break;
        }
      }

      const plan = combinePlans(plans);
      let message = continuationMessage || createFinalMessage(plan, results);
      const responder = selectedAgent.respond;
      if (!continuationMessage && responder && results.length) {
        emitProgress(runId, 'responding', request.onProgress);
        try {
          message = await responder({
            input: request.input,
            snapshot: current,
            plan,
            results,
            instruction: request.prompt,
            history: request.history,
            signal: request.signal
          });
        } catch (error) {
          const detail = error instanceof Error ? error.message : 'LLM 最终回答生成失败。';
          trace({ source: current.pageId, kind: 'error', title: 'Response synthesis failed', detail });
          message = `操作已执行，但无法生成最终回答：${detail}`;
        }
      }
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

  function invokeRun(request: EnchantRunMiddlewareRequest) {
    let activeIndex = -1;
    const dispatch = async (index: number): Promise<EnchantRunResult> => {
      if (index <= activeIndex) throw new Error('Run middleware 的 next() 不能重复调用。');
      activeIndex = index;
      const middleware = runMiddlewares[index];
      if (middleware) return middleware(request, () => dispatch(index + 1));
      return performRun(request.options);
    };
    return dispatch(0);
  }

  function run(value: EnchantRunOptions | string) {
    const options = typeof value === 'string' ? { input: value } : value;
    return invokeRun({ options });
  }

  function scheduleAutoCapture() {
    if (!snapshotConfig.autoCapture) return;
    if (autoCaptureTimer) clearTimeout(autoCaptureTimer);
    autoCaptureTimer = setTimeout(() => capture({ retain: true }), snapshotConfig.throttle);
  }

  const stopRegistrySubscription = registry.subscribe(scheduleAutoCapture);

  function digest(digestOptions: Pick<EnchantSnapshotOptions, 'page' | 'route' | 'tab' | 'tags' | 'includeLocal' | 'includeHidden'> = {}) {
    return registry.digest(resolveSnapshotOptions(digestOptions));
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (autoCaptureTimer) clearTimeout(autoCaptureTimer);
    stopRegistrySubscription();
    while (pluginCleanups.length) pluginCleanups.pop()?.();
    executionMiddlewares.splice(0);
    runMiddlewares.splice(0);
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
      plugins.forEach((plugin) => {
        const cleanup = plugin.install?.(forge, app);
        if (cleanup) pluginCleanups.push(cleanup);
      });
    },
    registry,
    policy,
    agent,
    knowledge: options.knowledge,
    debug: readonly(debugState) as Readonly<EnchantDebugConfig>,
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
    captureContext,
    run,
    execute,
    executeTool: execute,
    resolveAgent,
    retrieveKnowledge,
    exportSnapshot,
    exportCapabilities,
    registerExporter,
    registerExecutionMiddleware(middleware) {
      executionMiddlewares.push(middleware);
      return () => {
        const index = executionMiddlewares.indexOf(middleware);
        if (index >= 0) executionMiddlewares.splice(index, 1);
      };
    },
    registerRunMiddleware(middleware) {
      runMiddlewares.push(middleware);
      return () => {
        const index = runMiddlewares.indexOf(middleware);
        if (index >= 0) runMiddlewares.splice(index, 1);
      };
    },
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
    configureDebug(config) {
      Object.assign(debugState, config);
    },
    use(plugin) {
      plugins.push(plugin);
      const cleanup = plugin.setup(forge);
      if (cleanup) pluginCleanups.push(cleanup);
      if (installedApp) {
        const installCleanup = plugin.install?.(forge, installedApp);
        if (installCleanup) pluginCleanups.push(installCleanup);
      }
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
    agentId: context.agentId,
    capture: context.refresh,
    refresh: context.refresh,
    captureContext: <TTools = EnchantTool[]>(
      options: Omit<EnchantContextCaptureOptions<TTools>, 'scope' | 'enchantmentId'> = {}
    ) => forge.captureContext<TTools>({
      ...options,
      scope: 'local',
      enchantmentId: context.id
    }),
    executeTool: forge.executeTool,
    run: (value: string | Omit<EnchantRunOptions, 'enchantmentId'>) => forge.run({
      ...(typeof value === 'string' ? { input: value } : value),
      agentId: typeof value === 'string' ? context.agentId.value : (value.agentId ?? context.agentId.value),
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
