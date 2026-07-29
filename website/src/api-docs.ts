export type ApiKind = 'component' | 'composable' | 'factory' | 'interface' | 'directive';

export interface ApiDocEntry {
  id: string;
  copy: string;
  name: string;
  kind: ApiKind;
  importCode: string;
  signature: string;
  example?: string;
}

export interface ApiDocGroup {
  id: string;
  entries: ApiDocEntry[];
}

export const installCommand = 'pnpm add @enchantforge/vue';

export const quickStartCode = `import { createApp } from 'vue';
import { createEnchantForge } from '@enchantforge/vue';
import '@enchantforge/vue/style.css';
import App from './App.vue';

const forge = createEnchantForge({
  llm: { model: 'your-model' }
});

createApp(App).use(forge).mount('#app');`;

export const apiDocGroups: ApiDocGroup[] = [
  {
    id: 'foundation',
    entries: [
      {
        id: 'create-enchant-forge',
        copy: 'createEnchantForge',
        name: 'createEnchantForge',
        kind: 'factory',
        importCode: `import { createEnchantForge } from '@enchantforge/vue';`,
        signature: `function createEnchantForge(options?: {
  llm?: LlmClientOptions;
  llmClient?: LlmClient;
  agent?: EnchantAgent;
  resolveAgent?: (agentId: string) => EnchantAgent | undefined;
  knowledge?: EnchantKnowledgeProvider;
  policy?: Partial<EnchantPolicy>;
  snapshots?: Partial<EnchantSnapshotConfig>;
  maxPlanCalls?: number;
  maxPlanRounds?: number;
  traceLimit?: number;
  onTrace?: (event: EnchantTraceEvent) => void;
}): EnchantForge`,
        example: `const forge = createEnchantForge({
  llm: {
    model: import.meta.env.VITE_LLM_MODEL
  },
  resolveAgent: (agentId) => agents[agentId]
});

createApp(App).use(forge).mount('#app');`
      },
      {
        id: 'enchant',
        copy: 'Enchant',
        name: '<Enchant>',
        kind: 'component',
        importCode: `import { Enchant } from '@enchantforge/vue';`,
        signature: `interface EnchantProps {
  id?: string;
  name?: string;
  page?: string;
  agentId?: string;
  route?: string;
  kind?: Enchantment['kind'];
  prompt?: string;
  spell?: string;
  state?: unknown | (() => unknown);
  scan?: 'none' | 'marked' | 'auto' | EnchantScanConfig;
  metadata?: EnchantMetadataNode[];
  capabilities?: EnchantCapabilityDefinition[];
  exposure?: 'aura' | 'local' | 'private';
  registerGlobal?: boolean;
  active?: boolean;
  visible?: boolean;
  enabled?: boolean;
  tags?: string[];
}`,
        example: `<Enchant
  name="shipping-form"
  page="checkout"
  prompt="填写草稿，但不要提交"
>
  <ShippingForm />
</Enchant>`
      },
      {
        id: 'aura',
        copy: 'Aura',
        name: '<Aura>',
        kind: 'component',
        importCode: `import { Aura, type AuraInstance } from '@enchantforge/vue';`,
        signature: `interface AuraProps {
  page?: string;
  agentId?: string;
  agent?: EnchantAgent;
  caster?: EnchantAgent;
  appearance?: 'orb' | 'dock' | 'inline';
  orb?: Component;
  title?: string;
  prompt?: string;
  placeholder?: string;
  markdown?: boolean;
  suggestions?: string[];
  progressMessages?: AuraProgressMessages;
  open?: boolean;
  defaultOpen?: boolean;
  initialMessages?: EnchantConversationMessage[];
  historyLimit?: number;
  clearOnPageChange?: boolean;
  confirm?: (request: EnchantConfirmationRequest) => boolean | Promise<boolean>;
}`,
        example: `<Aura
  page="checkout"
  title="订单助手"
  prompt="只修改草稿，不提交订单"
  :suggestions="['从客户留言填写表单']"
/>`
      }
    ]
  },
  {
    id: 'contribution',
    entries: [
      {
        id: 'use-enchant-form',
        copy: 'useEnchantForm',
        name: 'useEnchantForm',
        kind: 'composable',
        importCode: `import { useEnchantForm } from '@enchantforge/vue';`,
        signature: `function useEnchantForm<TModel extends Record<string, unknown>>(
  source: MaybeRef<TModel>,
  options?: {
    id?: string;
    label?: string;
    description?: string;
    provider?: string;
    fields?: (keyof TModel)[] | Partial<Record<keyof TModel, string>>;
    fieldSchemas?: Partial<Record<keyof TModel, JsonSchema>>;
    assign?: (values: Partial<TModel>, model: TModel) => void | Promise<void>;
  }
): EnchantActionRegistration`,
        example: `const form = defineModel<ShippingForm>({ required: true });

useEnchantForm(form, {
  fields: {
    recipient: '收件人',
    phone: '联系电话',
    address: '收件地址'
  }
});`
      },
      {
        id: 'use-enchant-action',
        copy: 'useEnchantAction',
        name: 'useEnchantAction',
        kind: 'composable',
        importCode: `import { useEnchantAction } from '@enchantforge/vue';`,
        signature: `function useEnchantAction<TInput, TResult>(options: {
  id?: string;
  name: string;
  label?: string;
  description: string;
  effect: CapabilityEffect;
  inputSchema?: JsonSchema;
  owner?: EnchantCapabilityOwner;
  provider?: string;
  target?: string;
  metadata?: EnchantMetadataNode[] | (() => EnchantMetadataNode[]);
  execute(input: TInput, context: EnchantExecutionContext):
    TResult | Promise<TResult>;
}): EnchantActionRegistration`,
        example: `useEnchantAction({
  name: 'ticket.prepare_refund',
  description: '填写退款草稿，不执行退款',
  effect: 'draft',
  inputSchema: refundSchema,
  execute: prepareRefundDraft
});`
      },
      {
        id: 'application-apis',
        copy: 'applicationApis',
        name: 'defineEnchantAction / defineEnchantApi',
        kind: 'factory',
        importCode: `import {
  defineEnchantAction,
  defineEnchantApi
} from '@enchantforge/vue';`,
        signature: `function defineEnchantAction<TInput, TResult>(
  definition: EnchantActionDefinition<TInput, TResult>
): EnchantActionDefinition<TInput, TResult>;

function defineEnchantApi(options: {
  id: string;
  label?: string;
  provider?: string;
  page?: string;
  actions: readonly EnchantActionDefinition[];
}): EnchantApi;`,
        example: `const orderApi = defineEnchantApi({
  id: 'orders',
  actions: [
    defineEnchantAction({
      name: 'order.get',
      description: '按订单号查询订单详情',
      effect: 'read',
      inputSchema: orderQuerySchema,
      execute: ({ orderId }) => orderService.get(orderId)
    })
  ]
});

forge.use(orderApi);`
      }
    ]
  },
  {
    id: 'runtime',
    entries: [
      {
        id: 'use-enchant',
        copy: 'useEnchant',
        name: 'useEnchant',
        kind: 'composable',
        importCode: `import { useEnchant } from '@enchantforge/vue';`,
        signature: `function useEnchant(): {
  enchantment: ComputedRef<Enchantment | undefined>;
  agentId: Readonly<Ref<string | undefined>>;
  capture(): EnchantSnapshot;
  captureContext<TTools = EnchantTool[]>(
    options?: LocalCaptureOptions<TTools>
  ): EnchantContextBundle<TTools>;
  executeTool: EnchantForge['executeTool'];
  run(input: string | EnchantRunOptions): Promise<EnchantRunResult>;
}`,
        example: `const enchant = useEnchant();

async function onOfflineTranscript(text: string) {
  await enchant.run({
    input: text,
    prompt: '提取明确事实并更新工单草稿'
  });
}`
      },
      {
        id: 'use-enchant-forge',
        copy: 'useEnchantForge',
        name: 'useEnchantForge',
        kind: 'composable',
        importCode: `import { useEnchantForge } from '@enchantforge/vue';`,
        signature: `interface EnchantForge {
  captureContext(options?: EnchantContextCaptureOptions): EnchantContextBundle;
  run(options: EnchantRunOptions | string): Promise<EnchantRunResult>;
  executeTool(call: EnchantPlanCall, options: EnchantExecuteOptions):
    Promise<EnchantExecutionResult>;
  retrieveKnowledge(query: EnchantKnowledgeQuery):
    Promise<EnchantKnowledgeResult>;
  registerExporter(exporter: EnchantCapabilityExporter): () => void;
  registerRunMiddleware(middleware: EnchantRunMiddleware): () => void;
  registerExecutionMiddleware(middleware: EnchantExecutionMiddleware): () => void;
  subscribeLlm(listener: EnchantLlmObserver): () => void;
  configurePolicy(policy: Partial<EnchantPolicy>): void;
  use(plugin: EnchantForgePlugin): EnchantForge;
}`,
        example: `const forge = useEnchantForge();
const bundle = forge.captureContext({
  scope: 'page',
  page: 'operations'
});

customAgent.run({
  context: bundle.context,
  tools: bundle.tools
});`
      },
      {
        id: 'runtime-middleware',
        copy: 'middleware',
        name: 'Run / Execution Middleware',
        kind: 'interface',
        importCode: `import type {
  EnchantRunMiddleware,
  EnchantExecutionMiddleware
} from '@enchantforge/vue';`,
        signature: `type EnchantRunMiddleware = (
  request: { options: EnchantRunOptions },
  next: () => Promise<EnchantRunResult>
) => EnchantRunResult | Promise<EnchantRunResult>;

type EnchantExecutionMiddleware = (
  request: EnchantExecutionMiddlewareRequest,
  next: () => Promise<unknown>
) => unknown | Promise<unknown>;`,
        example: `forge.registerExecutionMiddleware(async (request, next) => {
  const startedAt = performance.now();
  try {
    return await next();
  } finally {
    metrics.record(request.capability.name, performance.now() - startedAt);
  }
});`
      }
    ]
  },
  {
    id: 'agent',
    entries: [
      {
        id: 'enchant-agent',
        copy: 'EnchantAgent',
        name: 'EnchantAgent',
        kind: 'interface',
        importCode: `import type { EnchantAgent } from '@enchantforge/vue';`,
        signature: `interface EnchantAgent {
  plan(request: EnchantAgentRequest): Promise<EnchantPlan>;
  planNext?(
    request: EnchantAgentContinuationRequest
  ): Promise<EnchantAgentContinuation | undefined>;
  respond?(request: EnchantAgentResponseRequest): Promise<string>;
}`,
        example: `const agent: EnchantAgent = {
  async plan(request) {
    return backend.plan(request);
  },
  async planNext(request) {
    return backend.continue(request);
  },
  async respond(request) {
    return backend.respond(request);
  }
};`
      },
      {
        id: 'create-llm-client',
        copy: 'createLlmClient',
        name: 'createLlmClient',
        kind: 'factory',
        importCode: `import { createLlmClient } from '@enchantforge/vue';`,
        signature: `function createLlmClient(options?: {
  endpoint?: string;
  model?: string;
  apiKey?: string;
  headers?: HeadersInit;
  configError?: string;
  timeout?: number;
  maxTokens?: number;
  fetcher?: typeof fetch;
  onDebug?: (event: LlmClientDebugEvent) => void;
}): {
  run(request: LlmRunOptions): Promise<LlmResponse>;
  runJson<T>(request: LlmRunJsonOptions): Promise<T>;
}`,
        example: `const client = createLlmClient({
  endpoint: '/api/llm/chat/completions',
  model: import.meta.env.VITE_LLM_MODEL,
  timeout: 30_000
});`
      }
    ]
  },
  {
    id: 'knowledge',
    entries: [
      {
        id: 'knowledge-providers',
        copy: 'knowledgeProviders',
        name: 'Knowledge Providers',
        kind: 'factory',
        importCode: `import {
  createStaticKnowledgeProvider,
  createHttpKnowledgeProvider
} from '@enchantforge/vue';`,
        signature: `interface EnchantKnowledgeProvider {
  id: string;
  retrieve(query: {
    query: string;
    topK?: number;
    filters?: Record<string, string | number | boolean | string[]>;
    page?: string;
    enchantmentId?: string;
    signal?: AbortSignal;
  }): Promise<EnchantKnowledgeResult>;
}`,
        example: `const knowledge = createHttpKnowledgeProvider({
  id: 'support-rag',
  endpoint: '/api/knowledge/retrieve',
  headers: () => ({
    Authorization: getSessionToken()
  })
});

const forge = createEnchantForge({ knowledge });`
      }
    ]
  },
  {
    id: 'debug',
    entries: [
      {
        id: 'create-enchant-debug',
        copy: 'createEnchantDebug',
        name: 'createEnchantDebug',
        kind: 'factory',
        importCode: `import { createEnchantDebug } from '@enchantforge/vue';`,
        signature: `function createEnchantDebug(options?: {
  snapshots?: Partial<EnchantSnapshotConfig>;
  overlay?: boolean;
  title?: string;
  position?: 'bottom-right' | 'bottom-left';
}): EnchantForgePlugin`,
        example: `if (import.meta.env.DEV) {
  forge.use(createEnchantDebug({
    snapshots: { autoCapture: false },
    position: 'bottom-right'
  }));
}`
      },
      {
        id: 'dom-directives',
        copy: 'directives',
        name: 'v-enchant / v-enchant-ignore',
        kind: 'directive',
        importCode: `import { vEnchant, vEnchantIgnore } from '@enchantforge/vue';`,
        signature: `<Enchant scan="marked">
  <input v-enchant aria-label="Phone" />
  <section v-enchant-ignore>...</section>
</Enchant>`,
        example: `<Enchant name="legacy-form" scan="marked">
  <input
    v-enchant
    id="recipient"
    aria-label="收件人"
    v-model="form.recipient"
  />
</Enchant>`
      }
    ]
  },
  {
    id: 'observability',
    entries: [
      {
        id: 'open-telemetry',
        copy: 'openTelemetry',
        name: 'createEnchantOpenTelemetry',
        kind: 'factory',
        importCode: `import { createEnchantOpenTelemetry } from '@enchantforge/vue/otel';`,
        signature: `function createEnchantOpenTelemetry(options: {
  tracer: EnchantOpenTelemetryTracer;
  meter?: EnchantOpenTelemetryMeter;
  attributes?: EnchantOpenTelemetryAttributes;
  captureInputs?: boolean;
  captureOutputs?: boolean;
  contentLimit?: number;
}): EnchantForgePlugin`,
        example: `forge.use(createEnchantOpenTelemetry({
  tracer: trace.getTracer('enchantforge'),
  meter: metrics.getMeter('enchantforge'),
  attributes: {
    'service.name': 'support-console'
  }
}));`
      }
    ]
  }
];
