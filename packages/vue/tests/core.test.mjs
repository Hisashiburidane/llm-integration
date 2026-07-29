import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRenderer, defineComponent, h, nextTick, ref } from 'vue';
import {
  Aura,
  Enchant,
  createEnchantForge,
  createEnchantDebug,
  createEnchantRegistry,
  createHttpKnowledgeProvider,
  createLlmClient,
  createStaticKnowledgeProvider,
  defineEnchantAction,
  defineEnchantApi,
  evaluateEnchantPolicy,
  renderAuraMarkdown,
  useEnchantForm
} from '../dist/enchantforge-vue.js';
import {
  buildEnchantLlmDebugRows,
  buildEnchantDebugScopeTree,
  flattenEnchantDebugMetadata
} from '../dist/debug.js';
import { createEnchantOpenTelemetry } from '../dist/otel.js';

function status(overrides = {}) {
  return { alive: true, active: true, visible: true, enabled: true, ...overrides };
}

function createRegistration({ effect = 'visual', execute = () => ({ status: 'success' }) } = {}) {
  return {
    id: 'scope:test',
    name: 'test-scope',
    page: 'test-page',
    exposure: 'aura',
    getStatus: () => status(),
    capture: () => ({
      enchantment: {
        id: 'scope:test',
        name: 'test-scope',
        page: 'test-page',
        kind: 'form',
        exposure: 'aura',
        status: status(),
        metadata: [{
          id: 'region:test',
          scopeId: 'scope:test',
          kind: 'region',
          label: 'Test region',
          visible: true,
          enabled: true,
          source: 'registered',
          children: [{
            id: 'field:test',
            scopeId: 'scope:test',
            kind: 'field',
            label: 'Test field',
            value: 'initial',
            visible: true,
            enabled: true,
            source: 'registered'
          }]
        }],
        capabilities: ['capability:test'],
        source: { scopeId: 'scope:test' },
        version: 1
      },
      capabilities: [{
        id: 'capability:test',
        enchantmentId: 'scope:test',
        owner: 'application',
        provider: 'test',
        name: 'test.action',
        label: 'Test action',
        description: 'Test action',
        effect,
        inputSchema: {
          type: 'object',
          required: ['value'],
          additionalProperties: false,
          properties: { value: { type: 'string', minLength: 2 } }
        },
        execute
      }]
    })
  };
}

function createToolLoopRegistration(executions) {
  return {
    id: 'scope:analysis',
    name: 'analysis',
    page: 'test-page',
    exposure: 'aura',
    getStatus: () => status(),
    capture: () => ({
      enchantment: {
        id: 'scope:analysis',
        name: 'analysis',
        page: 'test-page',
        kind: 'panel',
        exposure: 'aura',
        status: status(),
        metadata: [{
          id: 'panel:latency',
          scopeId: 'scope:analysis',
          kind: 'panel',
          label: 'P95 latency ranking',
          visible: true,
          enabled: true,
          source: 'registered',
          children: []
        }],
        capabilities: ['capability:read', 'capability:highlight'],
        source: { scopeId: 'scope:analysis' },
        version: 1
      },
      capabilities: [
        {
          id: 'capability:read',
          enchantmentId: 'scope:analysis',
          owner: 'application',
          provider: 'test',
          name: 'dashboard.read_data',
          label: 'Read latency',
          description: 'Read P95 latency data.',
          effect: 'read',
          execute() {
            executions.push('read');
            return { status: 'success', data: { service: 'checkout', p95: 320 } };
          }
        },
        {
          id: 'capability:highlight',
          enchantmentId: 'scope:analysis',
          owner: 'application',
          provider: 'test',
          name: 'dashboard.highlight',
          label: 'Highlight latency',
          description: 'Highlight the evidence panel.',
          effect: 'visual',
          execute() {
            executions.push('highlight');
            return { status: 'success', summary: 'Evidence highlighted.' };
          }
        }
      ]
    })
  };
}

function createTestForge(options = {}) {
  let executionCount = 0;
  const forge = createEnchantForge({
    agent: options.agent ?? {
      async plan(snapshotRequest) {
        return {
          message: 'planned',
          snapshotVersion: snapshotRequest.snapshot.version,
          calls: [{ capabilityId: 'capability:test', input: { value: 'valid' } }]
        };
      }
    },
    policy: options.policy,
    maxPlanCalls: options.maxPlanCalls
  });
  forge.registry.register(createRegistration({
    effect: options.effect ?? 'visual',
    execute(input) {
      executionCount += 1;
      return { status: 'success', data: input };
    }
  }));
  return { forge, getExecutionCount: () => executionCount };
}

test('Aura preserves undefined open state for uncontrolled usage', () => {
  assert.equal(Object.hasOwn(Aura.props.open, 'default'), true);
  assert.equal(Aura.props.open.default, undefined);
  assert.ok(Aura.props.agentId);
  assert.ok(Enchant.props.agentId);
});

test('registry preserves nested metadata tree nodes', () => {
  const registry = createEnchantRegistry();
  registry.register(createRegistration());

  const snapshot = registry.capture();
  const region = snapshot.metadataTree.children[0].children[0];

  assert.equal(region.id, 'region:test');
  assert.equal(region.children[0].id, 'field:test');
});

test('registry ignores equivalent registration updates', () => {
  const registry = createEnchantRegistry();
  const registration = createRegistration();
  registry.register(registration);
  registry.capture();
  const initialVersion = registry.version.value;

  registry.update(createRegistration());
  assert.equal(registry.version.value, initialVersion);
  assert.ok(registry.getCapability('capability:test'));

  registry.update({ ...createRegistration(), tags: ['changed'] });
  assert.equal(registry.version.value, initialVersion + 1);
});

test('policy blocks hidden enchantments and configured provider effects', () => {
  const capability = {
    id: 'dom:fill',
    enchantmentId: 'scope:test',
    owner: 'adapter',
    provider: 'dom',
    name: 'field.fill',
    label: 'Fill',
    description: 'Fill',
    effect: 'draft'
  };
  const hiddenDecision = evaluateEnchantPolicy(
    { mode: 'draft-only', defaultExposure: 'aura', allowedEffects: ['draft'], requireConfirmationFor: [], blockedCapabilities: [], blockedProviderEffects: {}, valuePolicy: {} },
    capability,
    { id: 'scope:test', exposure: 'aura', kind: 'form', status: status({ visible: false }) }
  );
  const domDecision = evaluateEnchantPolicy(
    { mode: 'draft-only', defaultExposure: 'aura', allowedEffects: ['draft'], requireConfirmationFor: [], blockedCapabilities: [], blockedProviderEffects: { dom: ['draft'] }, valuePolicy: {} },
    capability,
    { id: 'scope:test', exposure: 'aura', kind: 'form', status: status() }
  );
  const adapterDecision = evaluateEnchantPolicy(
    { mode: 'draft-only', defaultExposure: 'aura', allowedEffects: ['draft'], requireConfirmationFor: [], blockedCapabilities: [], blockedProviderEffects: { dom: ['draft'] }, valuePolicy: {} },
    { ...capability, provider: 'vue-model' },
    { id: 'scope:test', exposure: 'aura', kind: 'form', status: status() }
  );

  assert.equal(hiddenDecision.allowed, false);
  assert.equal(domDecision.allowed, false);
  assert.equal(adapterDecision.allowed, true);
});

test('LLM client normalizes timeout and caller abort', async () => {
  const pendingFetcher = (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
  });
  const timeoutClient = createLlmClient({ model: 'test', timeout: 10, fetcher: pendingFetcher });
  await assert.rejects(timeoutClient.run({ input: 'timeout' }), /超时/);

  const controller = new AbortController();
  const abortClient = createLlmClient({ model: 'test', fetcher: pendingFetcher });
  const request = abortClient.run({ input: 'abort', signal: controller.signal });
  controller.abort();
  await assert.rejects(request, /取消/);
});

test('LLM client sends native function tools and normalizes tool calls', async () => {
  let body;
  const debugEvents = [];
  const client = createLlmClient({
    model: 'test',
    maxTokens: 1024,
    onDebug: (event) => debugEvents.push(event),
    fetcher: async (_url, init) => {
      body = JSON.parse(init.body);
      return new Response(JSON.stringify({
        choices: [{
          finish_reason: 'tool_calls',
          message: { content: '', tool_calls: [{ id: 'call-1', function: { name: 'enchant_tool_0', arguments: '{"value":"ok"}' } }] }
        }],
        usage: { completion_tokens: 12 }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  });
  const result = await client.runJson({
    prompt: 'plan',
    input: 'run',
    tools: [{ type: 'function', function: { name: 'enchant_tool_0', parameters: { type: 'object' } } }]
  });

  assert.equal(body.tools[0].function.name, 'enchant_tool_0');
  assert.equal(body.tool_choice, 'auto');
  assert.equal(body.max_tokens, 1024);
  assert.doesNotMatch(body.messages[0].content, /只返回 JSON/);
  assert.deepEqual(result.toolCalls[0], { id: 'call-1', name: 'enchant_tool_0', arguments: '{"value":"ok"}' });
  assert.equal(debugEvents[0].phase, 'request');
  assert.equal(debugEvents[0].detail.body.tools[0].function.name, 'enchant_tool_0');
  assert.equal(debugEvents[1].phase, 'response');
  assert.equal(debugEvents[1].detail.finishReason, 'tool_calls');
  assert.equal(debugEvents[1].detail.usage.completion_tokens, 12);
});

test('forge rejects a capability removed after planning', async () => {
  const { forge, getExecutionCount } = createTestForge();
  const snapshot = forge.capture();
  forge.registry.invalidate('scope:test');

  const result = await forge.execute(
    { capabilityId: 'capability:test', input: { value: 'valid' } },
    { snapshot }
  );

  assert.equal(result.ok, false);
  assert.match(result.error, /未注册、未暴露或合约已变化/);
  assert.equal(getExecutionCount(), 0);
});

test('forge validates nested capability input and confirmation', async () => {
  const { forge, getExecutionCount } = createTestForge({
    effect: 'draft',
    policy: { requireConfirmationFor: ['draft'] }
  });
  const snapshot = forge.capture();

  const invalid = await forge.execute(
    { capabilityId: 'capability:test', input: { value: 'x' } },
    { snapshot, confirmed: true }
  );
  assert.equal(invalid.ok, false);
  assert.match(invalid.error, /长度不能小于/);

  const denied = await forge.execute(
    { capabilityId: 'capability:test', input: { value: 'valid' } },
    { snapshot }
  );
  assert.equal(denied.ok, false);
  assert.match(denied.error, /需要用户确认/);

  const allowed = await forge.execute(
    { capabilityId: 'capability:test', input: { value: 'valid' } },
    { snapshot, confirm: async () => true }
  );
  assert.equal(allowed.ok, true);
  assert.equal(getExecutionCount(), 1);
});

test('forge reports failed progress when a capability result fails', async () => {
  const progress = [];
  const forge = createEnchantForge({
    agent: {
      async plan({ snapshot }) {
        return {
          message: '',
          snapshotVersion: snapshot.version,
          calls: [{ capabilityId: 'capability:test', input: { value: 'valid' } }]
        };
      }
    }
  });
  forge.registry.register(createRegistration({ execute: () => ({ status: 'failed', summary: 'rejected' }) }));

  const result = await forge.run({ input: 'run', onProgress: (event) => progress.push(event) });

  assert.equal(result.results[0].ok, false);
  assert.equal(progress.at(-1).phase, 'failed');
});

test('forge instances keep registry, navigation and policy state isolated', () => {
  const first = createEnchantForge();
  const second = createEnchantForge();
  first.registry.register(createRegistration());

  assert.equal(first.digest().activeEnchantments, 1);
  assert.equal(second.digest().activeEnchantments, 0);

  first.syncNavigation({ app: 'console', page: 'focus', route: '/focus', tab: 'nodes', tags: ['ops'] });
  assert.deepEqual(first.navigation, {
    app: 'console',
    page: 'focus',
    route: '/focus',
    tab: 'nodes',
    tags: ['ops']
  });
  assert.equal(second.navigation.page, undefined);
  const snapshot = first.capture();
  assert.equal(snapshot.pageId, 'focus');
  assert.equal(snapshot.route, '/focus');
  assert.equal(snapshot.tab, 'nodes');
  assert.deepEqual(snapshot.tags, ['ops']);
});

test('forge policy modes can be changed without replacing the runtime', async () => {
  const { forge, getExecutionCount } = createTestForge({ effect: 'draft' });
  const snapshot = forge.capture();
  forge.configurePolicy({ mode: 'read-only' });
  const readOnly = await forge.execute(
    { capabilityId: 'capability:test', input: { value: 'valid' } },
    { snapshot, confirmed: true }
  );
  assert.equal(readOnly.ok, false);
  assert.match(readOnly.error, /read-only 模式/);

  forge.configurePolicy({ mode: 'draft-only' });
  const draft = await forge.execute(
    { capabilityId: 'capability:test', input: { value: 'valid' } },
    { snapshot, confirmed: true }
  );
  assert.equal(draft.ok, true);
  assert.equal(getExecutionCount(), 1);
});

test('forge exports tools through built-in and custom capability exporters', () => {
  const { forge } = createTestForge();
  const custom = {
    name: 'names',
    export(snapshot) {
      return snapshot.tools.map((tool) => tool.name);
    }
  };
  const unregister = forge.registerExporter(custom);

  assert.deepEqual(forge.exportCapabilities().map((tool) => tool.name), ['test.action']);
  assert.deepEqual(forge.exportCapabilities('names'), ['test.action']);
  unregister();
  assert.throws(() => forge.exportCapabilities('names'), /未注册/);
});

test('forge captures protocol-neutral context and tools from one snapshot', async () => {
  const { forge, getExecutionCount } = createTestForge();
  const registration = forge.registry.getRegistration('scope:test');
  registration.agentId = 'call-center';
  const originalCapture = registration.capture;
  registration.capture = () => {
    const result = originalCapture();
    result.enchantment.agentId = 'call-center';
    result.enchantment.instruction = '只填写草稿，不要提交。';
    return result;
  };
  forge.registry.update(registration);

  const bundle = forge.captureContext({
    scope: 'local',
    enchantmentId: 'scope:test'
  });

  assert.equal(bundle.snapshot.enchantments[0].metadata[0].children[0].value, 'initial');
  assert.equal(bundle.context.structure.children[0].children[0].label, 'Test region');
  assert.doesNotMatch(JSON.stringify(bundle.context), /initial|call-center|version/);
  assert.deepEqual(bundle.instructions, [{
    enchantmentId: 'scope:test',
    name: 'test-scope',
    instruction: '只填写草稿，不要提交。'
  }]);
  assert.equal(bundle.tools[0].capabilityId, bundle.snapshot.tools[0].capabilityId);

  const result = await forge.executeTool(
    { capabilityId: bundle.tools[0].capabilityId, input: { value: 'external client' } },
    { snapshot: bundle.snapshot, confirmed: true }
  );
  assert.equal(result.ok, true);
  assert.equal(getExecutionCount(), 1);
});

test('context capture supports page and application scopes', () => {
  const forge = createEnchantForge();
  forge.registry.register(createRegistration());
  forge.registry.register({
    id: 'scope:other',
    name: 'other-scope',
    page: 'other-page',
    exposure: 'aura',
    getStatus: () => status(),
    capture: () => ({
      enchantment: {
        id: 'scope:other',
        name: 'other-scope',
        page: 'other-page',
        kind: 'panel',
        exposure: 'aura',
        status: status(),
        metadata: [],
        capabilities: [],
        source: { scopeId: 'scope:other' },
        version: 1
      },
      capabilities: []
    })
  });

  const page = forge.captureContext({ scope: 'page', page: 'test-page' });
  const app = forge.captureContext({ scope: 'app', app: 'operations' });

  assert.deepEqual(page.context.structure.children.map((item) => item.id), ['scope:test']);
  assert.deepEqual(app.context.structure.children.map((item) => item.id), ['scope:test', 'scope:other']);
  assert.equal(app.context.pageId, 'operations');
});

test('exportSnapshot projects an existing snapshot without recapturing', () => {
  const { forge } = createTestForge();
  const snapshot = forge.capture();
  forge.registry.unregister('scope:test');

  assert.deepEqual(
    forge.exportSnapshot(snapshot).map((tool) => tool.name),
    ['test.action']
  );
});

test('forge resolves named Agent Clients without binding the context runtime to one backend', async () => {
  const selected = [];
  const namedAgent = {
    async plan() {
      selected.push('support');
      return { message: 'routed', calls: [] };
    }
  };
  const forge = createEnchantForge({
    resolveAgent(agentId) {
      return agentId === 'support' ? namedAgent : undefined;
    }
  });

  const result = await forge.run({ input: 'inspect', agentId: 'support' });

  assert.equal(result.message, 'routed');
  assert.deepEqual(selected, ['support']);
  assert.equal(forge.resolveAgent('support'), namedAgent);
  assert.throws(() => forge.resolveAgent('missing'), /未解析到 Agent Client/);
});

test('static knowledge provider returns filtered lexical results through forge', async () => {
  const knowledge = createStaticKnowledgeProvider({
    id: 'support-policy',
    documents: [
      {
        id: 'damaged-model',
        title: '模型破损处理',
        content: '外包装或模型破损时，应记录照片凭证并创建换货草稿。',
        source: 'support/manual',
        metadata: { domain: 'shipping' }
      },
      {
        id: 'battery',
        title: '电池故障排查',
        content: '灯具单侧不亮时，先检查电池极性和触点。',
        source: 'support/manual',
        metadata: { domain: 'electronics' }
      }
    ]
  });
  const forge = createEnchantForge({ knowledge });

  const result = await forge.retrieveKnowledge({
    query: '模型外包装破损',
    filters: { domain: 'shipping' },
    topK: 1
  });

  assert.equal(result.providerId, 'support-policy');
  assert.deepEqual(result.chunks.map((chunk) => chunk.id), ['damaged-model']);
  assert.ok(forge.events.some((event) => event.title === 'Knowledge retrieved'));
});

test('HTTP knowledge provider uses a backend-neutral request and response contract', async () => {
  let request;
  const provider = createHttpKnowledgeProvider({
    endpoint: '/api/knowledge/retrieve',
    headers: new Headers({ Authorization: 'Bearer test-token' }),
    fetch: async (input, init) => {
      request = { input, init };
      return new Response(JSON.stringify({
        chunks: [{ id: 'policy-1', content: '需要人工确认。' }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  });

  const result = await provider.retrieve({
    query: '换新规则',
    topK: 3,
    filters: { channel: 'hotline' }
  });

  assert.equal(request.input, '/api/knowledge/retrieve');
  assert.equal(request.init.headers.get('Authorization'), 'Bearer test-token');
  assert.equal(request.init.headers.get('Content-Type'), 'application/json');
  assert.deepEqual(JSON.parse(request.init.body), {
    query: '换新规则',
    topK: 3,
    filters: { channel: 'hotline' }
  });
  assert.equal(result.chunks[0].id, 'policy-1');
});

test('default agent can use an injected LLM client', async () => {
  let request;
  const forge = createEnchantForge({
    llmClient: {
      async run() {
        throw new Error('not used');
      },
      async runJson(value) {
        request = value;
        return {
          message: 'custom client',
          calls: []
        };
      }
    }
  });
  forge.registry.register(createRegistration());
  const result = await forge.run({ input: 'inspect' });

  assert.equal(result.message, 'custom client');
  assert.equal(request.input, 'inspect');
  assert.doesNotMatch(request.prompt, /snapshotVersion/);
  assert.equal(request.context.version, undefined);
  assert.equal(request.context.structure.children[0].children[0].label, 'Test region');
  assert.equal(request.tools[0].function.name, 'enchant_tool_0');
  assert.match(request.tools[0].function.description, /Test action/);
  assert.equal(request.tools[0].function.parameters.properties.value.type, 'string');
  assert.doesNotMatch(JSON.stringify(request.context), /initial/);
});

test('default agent forwards conversation history without mixing it into the snapshot', async () => {
  let request;
  const forge = createEnchantForge({
    llmClient: {
      async run() {
        throw new Error('not used');
      },
      async runJson(value) {
        request = value;
        return { message: 'continued', calls: [] };
      }
    }
  });
  forge.registry.register(createRegistration());
  const history = [
    { role: 'user', content: '哪个机场延误最高？' },
    { role: 'assistant', content: '首都机场。' }
  ];

  await forge.run({ input: '它的准点率呢？', history });

  assert.deepEqual(request.messages.slice(1, 3), history);
  assert.equal(request.messages.at(-1).role, 'user');
  assert.match(request.messages.at(-1).content, /它的准点率呢？/);
  assert.equal(request.context.structure.children[0].children[0].label, 'Test region');
  assert.doesNotMatch(JSON.stringify(request.context), /首都机场/);
});

test('default agent continues from read results to visual tools and a final answer', async () => {
  const executions = [];
  const continuationRequests = [];
  let continuationRound = 0;
  const forge = createEnchantForge({
    llmClient: {
      async runJson() {
        return {
          content: '',
          toolCalls: [{ name: 'enchant_tool_0', arguments: '{}' }]
        };
      },
      async run(request) {
        continuationRequests.push(request);
        continuationRound += 1;
        if (continuationRound === 1) {
          return {
            content: '',
            payload: {},
            toolCalls: [{ name: 'enchant_tool_1', arguments: '{}' }]
          };
        }
        return {
          content: '**checkout** 的 P95 延迟最高，已高亮对应 Panel。',
          payload: {}
        };
      }
    }
  });
  forge.registry.register(createToolLoopRegistration(executions));

  const result = await forge.run({
    input: '当前哪个服务的 P95 延迟最高？',
    prompt: '读取真实数据并高亮主要证据。'
  });

  assert.deepEqual(executions, ['read', 'highlight']);
  assert.deepEqual(result.plan.calls.map((call) => call.capabilityId), ['capability:read', 'capability:highlight']);
  assert.equal(result.results.length, 2);
  assert.match(result.message, /checkout/);
  assert.equal(continuationRequests.length, 2);
  assert.equal(continuationRequests[0].context.executionResults[0].value.service, 'checkout');
  assert.equal(continuationRequests[1].context.executionResults[1].effect, 'visual');
});

test('Aura markdown renders common syntax and rejects executable content', () => {
  const rendered = renderAuraMarkdown('**P95 延迟**\n\n- `checkout`\n- [详情](https://example.com)');
  assert.match(rendered, /<strong>P95 延迟<\/strong>/);
  assert.match(rendered, /<code>checkout<\/code>/);
  assert.match(rendered, /rel="noopener noreferrer"/);

  const unsafe = renderAuraMarkdown('<script>alert(1)</script>\n\n[运行](javascript:alert(1))\n\n![remote](https://example.com/a.png)');
  assert.doesNotMatch(unsafe, /<script>/);
  assert.doesNotMatch(unsafe, /href="javascript:/);
  assert.doesNotMatch(unsafe, /<img/);
});

test('default agent maps native function calls back to capabilities', async () => {
  let request;
  let responseRequest;
  let executionCount = 0;
  const forge = createEnchantForge({
    maxPlanRounds: 0,
    llmClient: {
      async runJson(value) {
        request = value;
        return {
          content: 'native tool call',
          toolCalls: [{ name: 'enchant_tool_0', arguments: '{"value":"valid"}' }]
        };
      },
      async run(value) {
        responseRequest = value;
        return { content: 'native completed', payload: {} };
      }
    }
  });
  forge.registry.register(createRegistration({
    execute(input) {
      executionCount += 1;
      return { status: 'success', data: input };
    }
  }));

  const result = await forge.run({ input: 'use the action' });

  assert.equal(request.tools[0].function.name, 'enchant_tool_0');
  assert.equal(result.plan.calls[0].capabilityId, 'capability:test');
  assert.equal(executionCount, 1);
  assert.equal(result.results[0].ok, true);
  assert.doesNotMatch(request.prompt, /审批|支付|删除/);
  assert.doesNotMatch(responseRequest.prompt, /highlight capability|面板已高亮/);
  assert.match(responseRequest.prompt, /对应 capability/);
});

test('forge synthesizes a response from successful read capability results', async () => {
  let responseRequest;
  const forge = createEnchantForge({
    agent: {
      async plan({ snapshot }) {
        return {
          message: 'planned',
          snapshotVersion: snapshot.version,
          calls: [{ capabilityId: 'capability:test', input: { value: 'valid' } }]
        };
      },
      async respond(request) {
        responseRequest = request;
        return 'JFK 的平均延误最高。';
      }
    }
  });
  forge.registry.register(createRegistration({
    effect: 'read',
    execute: () => ({ status: 'success', data: { airport: 'JFK', averageDelay: 31 } })
  }));

  const history = [
    { role: 'user', content: '先查看机场延误。' },
    { role: 'assistant', content: '可以继续询问具体指标。' }
  ];
  const result = await forge.run({ input: '当前哪个机场的平均延误最高？', history });

  assert.equal(result.message, 'JFK 的平均延误最高。');
  assert.equal(responseRequest.input, '当前哪个机场的平均延误最高？');
  assert.deepEqual(responseRequest.history, history);
  assert.equal(responseRequest.results[0].ok, true);
  assert.deepEqual(responseRequest.results[0].value, { airport: 'JFK', averageDelay: 31 });
});

test('forge continuation and response are not restricted to read effects', async () => {
  const requests = [];
  const forge = createEnchantForge({
    agent: {
      async plan({ snapshot }) {
        return {
          message: '',
          snapshotVersion: snapshot.version,
          calls: [{ capabilityId: 'capability:test', input: { value: 'draft' } }]
        };
      },
      async planNext(request) {
        requests.push(request);
        return { message: '草稿已生成，可以继续检查。' };
      },
      async respond() {
        throw new Error('planNext message should finish the run');
      }
    }
  });
  forge.registry.register(createRegistration({
    effect: 'draft',
    execute: () => ({ status: 'success', data: { draftId: 'draft-1' } })
  }));

  const result = await forge.run({ input: '生成草稿' });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].results[0].value.draftId, 'draft-1');
  assert.equal(result.message, '草稿已生成，可以继续检查。');
});

test('forge responder receives non-read execution results', async () => {
  let responseRequest;
  const forge = createEnchantForge({
    agent: {
      async plan({ snapshot }) {
        return {
          message: '',
          snapshotVersion: snapshot.version,
          calls: [{ capabilityId: 'capability:test', input: { value: 'valid' } }]
        };
      },
      async respond(request) {
        responseRequest = request;
        return '界面操作已完成。';
      }
    }
  });
  forge.registry.register(createRegistration({ effect: 'visual' }));

  const result = await forge.run({ input: '聚焦目标' });

  assert.equal(responseRequest.results[0].status, 'success');
  assert.equal(result.message, '界面操作已完成。');
});

test('capture and agent run add trace events without changing registry version', async () => {
  const forge = createEnchantForge({
    agent: {
      async plan({ snapshot }) {
        return {
          message: 'stable contract',
          snapshotVersion: snapshot.version,
          calls: []
        };
      }
    }
  });
  forge.registry.register(createRegistration());
  const initialVersion = forge.registry.version.value;
  const initialTraceCount = forge.events.length;

  forge.capture();
  await forge.run({ input: 'inspect' });

  assert.equal(forge.registry.version.value, initialVersion);
  assert.ok(forge.events.length > initialTraceCount);
});

test('plan snapshot version is provenance and does not block execution', async () => {
  const forge = createEnchantForge({
    agent: {
      async plan() {
        return { message: 'accepted', snapshotVersion: 1, calls: [] };
      }
    }
  });
  forge.registry.register(createRegistration());

  const result = await forge.run({ input: 'inspect' });

  assert.equal(result.message, 'accepted');
});

test('forge keeps a plan when an unrelated registry change occurs during planning', async () => {
  let forge;
  let attempts = 0;
  forge = createEnchantForge({
    agent: {
      async plan({ snapshot }) {
        attempts += 1;
        if (attempts === 1) forge.registry.touch();
        return {
          message: 'replanned',
          snapshotVersion: snapshot.version,
          calls: [{ capabilityId: 'capability:test', input: { value: 'valid' } }]
        };
      }
    }
  });
  forge.registry.register(createRegistration());

  const result = await forge.run({ input: 'run after mount' });

  assert.equal(attempts, 1);
  assert.equal(result.results[0].ok, true);
});

test('forge keeps later calls when an unrelated registry change occurs during execution', async () => {
  let forge;
  let executions = 0;
  forge = createEnchantForge({
    agent: {
      async plan({ snapshot }) {
        return {
          message: 'continued',
          snapshotVersion: snapshot.version,
          calls: [
            { capabilityId: 'capability:test', input: { value: 'first' } },
            { capabilityId: 'capability:test', input: { value: 'second' } }
          ]
        };
      }
    }
  });
  forge.registry.register(createRegistration({
    execute(input) {
      executions += 1;
      if (executions === 1) forge.registry.touch();
      return { status: 'success', data: input };
    }
  }));

  const result = await forge.run({ input: 'continue after modal mount' });

  assert.equal(executions, 2);
  assert.deepEqual(result.results.map((item) => item.ok), [true, true]);
});

test('registry filters route-scoped registrations for the active snapshot', () => {
  const registry = createEnchantRegistry();
  const createRouteRegistration = (id, route) => ({
    id,
    page: 'console',
    route,
    exposure: 'aura',
    getStatus: () => status(),
    capture: () => ({
      enchantment: {
        id,
        page: 'console',
        route,
        kind: 'panel',
        exposure: 'aura',
        status: status(),
        metadata: [],
        capabilities: [],
        source: { scopeId: id },
        version: 1
      },
      capabilities: []
    })
  });
  registry.register(createRouteRegistration('route:a', '/a'));
  registry.register(createRouteRegistration('route:b', '/b'));

  const snapshot = registry.capture({ page: 'console', route: '/a' });
  assert.deepEqual(snapshot.enchantments.map((item) => item.id), ['route:a']);
});

test('forge dispose runs plugin cleanup and clears its app-owned registry', () => {
  const forge = createEnchantForge();
  let cleaned = false;
  forge.use({
    name: 'test-cleanup',
    setup() {
      return () => {
        cleaned = true;
      };
    }
  });
  forge.registry.register(createRegistration());
  forge.dispose();

  assert.equal(cleaned, true);
  assert.equal(forge.digest().activeEnchantments, 0);
});

test('application APIs register reusable actions once at app scope', async () => {
  const calls = [];
  const getOrder = defineEnchantAction({
    name: 'orders.get',
    label: 'Query order',
    description: 'Query one order by its exact order number.',
    effect: 'read',
    inputSchema: {
      type: 'object',
      required: ['orderNo'],
      additionalProperties: false,
      properties: {
        orderNo: { type: 'string', minLength: 4 }
      }
    },
    execute(input) {
      calls.push(input);
      return {
        status: 'success',
        summary: `Order ${input.orderNo}`,
        data: { orderNo: input.orderNo }
      };
    }
  });
  const ordersApi = defineEnchantApi({
    id: 'orders',
    label: 'Order API',
    provider: 'order-service',
    page: 'test-page',
    actions: [getOrder]
  });
  const forge = createEnchantForge().use(ordersApi);
  forge.registry.register(createRegistration());

  const snapshot = forge.capture({
    enchantmentIds: ['scope:test'],
    includeLocal: true
  });
  assert.deepEqual(
    snapshot.enchantments.map((item) => item.id),
    ['api:orders', 'scope:test']
  );
  const orderTool = snapshot.tools.find((tool) => tool.name === 'orders.get');
  assert.equal(orderTool.capabilityId, 'api:orders:orders.get');
  assert.equal(orderTool.provider, 'order-service');
  assert.equal(forge.capture({ page: 'other-page' }).tools.some(
    (tool) => tool.name === 'orders.get'
  ), false);

  const result = await forge.execute(
    {
      capabilityId: orderTool.capabilityId,
      input: { orderNo: 'EF-1' }
    },
    { snapshot }
  );
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [{ orderNo: 'EF-1' }]);

  forge.dispose();
});

test('execution middleware can reuse capability results across agent runs', async () => {
  let executions = 0;
  const forge = createEnchantForge();
  forge.registry.register(createRegistration({
    effect: 'read',
    execute(input) {
      executions += 1;
      return {
        status: 'success',
        summary: `Value ${input.value}`,
        data: { value: input.value, executions }
      };
    }
  }));
  const results = new Map();
  const unregister = forge.registerExecutionMiddleware(async (request, next) => {
    const key = `${request.capability.id}:${JSON.stringify(request.input)}`;
    if (results.has(key)) return results.get(key);
    const result = await next();
    results.set(key, result);
    return result;
  });
  const snapshot = forge.capture({ page: 'test-page' });
  const call = { capabilityId: 'capability:test', input: { value: 'same' } };

  const first = await forge.execute(call, { snapshot });
  const second = await forge.execute(call, { snapshot });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(executions, 1);

  unregister();
  await forge.execute(call, { snapshot });
  assert.equal(executions, 2);
});

test('run middleware wraps agent orchestration and can be removed', async () => {
  const lifecycle = [];
  const forge = createEnchantForge({
    agent: {
      async plan() {
        lifecycle.push('agent');
        return { message: 'finished', calls: [] };
      }
    }
  });
  const unregister = forge.registerRunMiddleware(async (request, next) => {
    lifecycle.push(`before:${request.options.input}`);
    const result = await next();
    lifecycle.push(`after:${result.message}`);
    return result;
  });

  await forge.run('inspect');
  assert.deepEqual(lifecycle, ['before:inspect', 'agent', 'after:finished']);

  unregister();
  lifecycle.length = 0;
  await forge.run('again');
  assert.deepEqual(lifecycle, ['agent']);
});

test('OpenTelemetry adapter creates nested run and capability spans with metrics', async () => {
  const spans = [];
  const activeSpans = [];
  const measurements = [];
  const tracer = {
    startActiveSpan(name, options, callback) {
      const record = {
        name,
        parent: activeSpans.at(-1)?.name,
        attributes: { ...options.attributes },
        events: [],
        exceptions: [],
        ended: false
      };
      const span = {
        setAttribute(key, value) {
          record.attributes[key] = value;
          return this;
        },
        setAttributes(attributes) {
          Object.assign(record.attributes, attributes);
          return this;
        },
        addEvent(eventName, attributes) {
          record.events.push({ name: eventName, attributes });
          return this;
        },
        setStatus(statusValue) {
          record.status = statusValue;
          return this;
        },
        recordException(error) {
          record.exceptions.push(error);
        },
        end() {
          record.ended = true;
        }
      };
      spans.push(record);
      activeSpans.push(record);
      try {
        const result = callback(span);
        if (result && typeof result.then === 'function') {
          return result.finally(() => activeSpans.pop());
        }
        activeSpans.pop();
        return result;
      } catch (error) {
        activeSpans.pop();
        throw error;
      }
    }
  };
  const meter = {
    createCounter(name) {
      return {
        add(value, attributes) {
          measurements.push({ type: 'counter', name, value, attributes });
        }
      };
    },
    createHistogram(name) {
      return {
        record(value, attributes) {
          measurements.push({ type: 'histogram', name, value, attributes });
        }
      };
    }
  };
  const forge = createEnchantForge({
    agent: {
      async plan() {
        return {
          message: '',
          calls: [{ capabilityId: 'capability:test', input: { value: 'private' } }]
        };
      }
    }
  });
  forge.registry.register(createRegistration());
  forge.use(createEnchantOpenTelemetry({
    tracer,
    meter,
    attributes: { 'service.name': 'test-app' }
  }));

  const result = await forge.run({ input: 'run private action', page: 'test-page' });

  assert.equal(result.results[0].ok, true);
  assert.deepEqual(spans.map((span) => span.name), [
    'enchantforge.agent.run',
    'enchantforge.capability.execute'
  ]);
  assert.equal(spans[1].parent, 'enchantforge.agent.run');
  assert.equal(spans[0].attributes['service.name'], 'test-app');
  assert.equal(spans[1].attributes['enchantforge.capability.name'], 'test.action');
  assert.equal(spans[1].attributes['enchantforge.capability.input'], undefined);
  assert.equal(spans.every((span) => span.ended), true);
  assert.deepEqual(measurements.map((item) => item.name), [
    'enchantforge.capability.execution.count',
    'enchantforge.capability.execution.duration',
    'enchantforge.agent.run.count',
    'enchantforge.agent.run.duration'
  ]);
  assert.equal(measurements.every((item) => item.attributes['enchantforge.outcome'] === 'success'), true);
});

test('debug plugin enables the lightweight in-page debug surface by default', () => {
  const forge = createEnchantForge();
  forge.use(createEnchantDebug({ title: 'Runtime Debug', position: 'bottom-left' }));

  assert.equal(forge.debug.enabled, true);
  assert.equal(forge.debug.title, 'Runtime Debug');
  assert.equal(forge.debug.position, 'bottom-left');
  assert.equal(forge.observationEnabled.value, false);

  const observing = createEnchantForge();
  observing.use(createEnchantDebug({ snapshots: { autoCapture: true } }));
  assert.equal(observing.observationEnabled.value, true);

  const disabled = createEnchantForge();
  disabled.use(createEnchantDebug({ overlay: false }));
  assert.equal(disabled.debug.enabled, false);
});

test('debug plugin records default LLM client requests and responses', async () => {
  const forge = createEnchantForge({
    llm: {
      model: 'test',
      fetcher: async () => new Response(JSON.stringify({
        choices: [{
          finish_reason: 'stop',
          message: { content: '{"message":"No action","calls":[]}' }
        }],
        usage: { completion_tokens: 9 }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
  });
  forge.use(createEnchantDebug());
  forge.registry.register(createRegistration());

  await forge.run({ input: 'inspect' });

  const llmEvents = forge.events.filter((event) => event.kind === 'llm');
  assert.equal(llmEvents.length, 2);
  assert.equal(llmEvents[0].detail.phase, 'response');
  assert.equal(llmEvents[0].detail.detail.finishReason, 'stop');
  assert.equal(llmEvents[1].detail.phase, 'request');
  assert.equal(llmEvents[1].detail.detail.body.tool_choice, 'auto');

  const rows = buildEnchantLlmDebugRows(llmEvents);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].model, 'test');
  assert.equal(rows[0].toolCount, 1);
  assert.equal(rows[0].toolChoice, 'auto');
  assert.equal(rows[0].finishReason, 'stop');
  assert.equal(rows[0].outputTokens, 9);
  assert.equal(rows[0].status, 'completed');
  assert.ok(rows[0].request);
  assert.ok(rows[0].response);
});

test('useEnchantForm emits provider-compatible field schemas', async (context) => {
  const renderer = createRenderer({
    patchProp() {},
    insert(child, parent) {
      (parent.children ??= []).push(child);
      child.parent = parent;
    },
    remove() {},
    createElement(type) {
      return { type, children: [] };
    },
    createText(text) {
      return { text };
    },
    createComment(comment) {
      return { comment };
    },
    setText(node, text) {
      node.text = text;
    },
    setElementText(node, text) {
      node.text = text;
    },
    parentNode(node) {
      return node.parent;
    },
    nextSibling() {
      return null;
    }
  });
  const forge = createEnchantForge();
  const Form = defineComponent({
    name: 'SchemaTestForm',
    setup() {
      const model = ref({
        baseDashboardId: '',
        id: '',
        title: '',
        description: '',
        panelIds: []
      });
      useEnchantForm(model, {
        fields: {
          baseDashboardId: '数据域 ID',
          id: 'Dashboard ID',
          title: '标题',
          description: '描述',
          panelIds: '需要加入的 Panel ID 列表'
        }
      });
      return () => h('span');
    }
  });
  const App = defineComponent({
    name: 'SchemaTestApp',
    setup: () => () => h(
      Enchant,
      { name: 'schema-root', page: 'test' },
      () => h(Enchant, { name: 'schema-test', page: 'test' }, () => h(Form))
    )
  });
  const app = renderer.createApp(App);
  app.use(forge);
  app.mount({ children: [] });
  context.after(() => app.unmount());
  await nextTick();

  const snapshot = forge.capture();
  const tool = snapshot.tools.find((item) => item.name === 'field.fill');
  const properties = tool.inputSchema.properties.values.properties;
  assert.equal(properties.baseDashboardId.type, 'string');
  assert.equal(properties.id.type, 'string');
  assert.equal(properties.title.type, 'string');
  assert.equal(properties.description.type, 'string');
  assert.deepEqual(properties.panelIds, {
    description: '需要加入的 Panel ID 列表',
    type: 'array',
    items: { type: 'string' }
  });
  assert.equal(tool.source.component, 'SchemaTestForm');
  const scopeTree = buildEnchantDebugScopeTree(snapshot);
  assert.equal(scopeTree[0].enchantment.name, 'schema-root');
  assert.equal(scopeTree[0].enchantment.source.component, 'SchemaTestApp');
  assert.equal(scopeTree[0].children[0].enchantment.name, 'schema-test');
  assert.equal(flattenEnchantDebugMetadata(snapshot)[0].component, 'SchemaTestForm');
});

test('core entry stays independent from optional UI component bundles', () => {
  const coreEntry = readFileSync(new URL('../dist/core.js', import.meta.url), 'utf8');
  const packageManifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

  assert.doesNotMatch(coreEntry, /ant-design/);
  assert.doesNotMatch(coreEntry, /ant-design-x/);
  assert.doesNotMatch(coreEntry, /marked/);
  assert.equal(packageManifest.dependencies['ant-design-x-vue'], '^1.6.0');
  assert.equal(packageManifest.dependencies['ant-design-vue'], undefined);
  assert.equal(packageManifest.dependencies['@ant-design/icons-vue'], undefined);
});
