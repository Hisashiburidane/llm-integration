import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  Aura,
  createEnchantForge,
  createEnchantDebug,
  createEnchantRegistry,
  createLlmClient,
  evaluateEnchantPolicy,
  renderAuraMarkdown
} from '../dist/enchantforge-vue.js';

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

test('policy blocks hidden enchantments and DOM writes', () => {
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
    { defaultExposure: 'aura', allowDomWrite: true, allowedEffects: ['draft'], requireConfirmationFor: [], blockedCapabilities: [], valuePolicy: {} },
    capability,
    { id: 'scope:test', exposure: 'aura', kind: 'form', status: status({ visible: false }) }
  );
  const domDecision = evaluateEnchantPolicy(
    { defaultExposure: 'aura', allowDomWrite: false, allowedEffects: ['draft'], requireConfirmationFor: [], blockedCapabilities: [], valuePolicy: {} },
    capability,
    { id: 'scope:test', exposure: 'aura', kind: 'form', status: status() }
  );

  assert.equal(hiddenDecision.allowed, false);
  assert.equal(domDecision.allowed, false);
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
  const client = createLlmClient({
    model: 'test',
    fetcher: async (_url, init) => {
      body = JSON.parse(init.body);
      return new Response(JSON.stringify({
        choices: [{ message: { content: '', tool_calls: [{ id: 'call-1', function: { name: 'enchant_tool_0', arguments: '{"value":"ok"}' } }] } }]
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
  assert.doesNotMatch(body.messages[0].content, /只返回 JSON/);
  assert.deepEqual(result.toolCalls[0], { id: 'call-1', name: 'enchant_tool_0', arguments: '{"value":"ok"}' });
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
  let executionCount = 0;
  const forge = createEnchantForge({
    llmClient: {
      async runJson(value) {
        request = value;
        return {
          content: 'native tool call',
          toolCalls: [{ name: 'enchant_tool_0', arguments: '{"value":"valid"}' }]
        };
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
