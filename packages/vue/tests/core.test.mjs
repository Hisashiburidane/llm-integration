import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEnchantForge,
  createEnchantRegistry,
  createLlmClient,
  evaluateEnchantPolicy
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

test('registry preserves nested metadata tree nodes', () => {
  const registry = createEnchantRegistry();
  registry.register(createRegistration());

  const snapshot = registry.capture();
  const region = snapshot.metadataTree.children[0].children[0];

  assert.equal(region.id, 'region:test');
  assert.equal(region.children[0].id, 'field:test');
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

test('forge rejects stale snapshots before executing a capability', async () => {
  const { forge, getExecutionCount } = createTestForge();
  const snapshot = forge.capture();
  forge.registry.invalidate('scope:test');

  const result = await forge.execute(
    { capabilityId: 'capability:test', input: { value: 'valid' } },
    { snapshot }
  );

  assert.equal(result.ok, false);
  assert.match(result.error, /Snapshot 已失效/);
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
  forge.configurePolicy({ mode: 'read-only' });
  const readOnlySnapshot = forge.capture();
  const readOnly = await forge.execute(
    { capabilityId: 'capability:test', input: { value: 'valid' } },
    { snapshot: readOnlySnapshot, confirmed: true }
  );
  assert.equal(readOnly.ok, false);
  assert.match(readOnly.error, /不属于本次 snapshot/);

  forge.configurePolicy({ mode: 'draft-only' });
  const draftSnapshot = forge.capture();
  const draft = await forge.execute(
    { capabilityId: 'capability:test', input: { value: 'valid' } },
    { snapshot: draftSnapshot, confirmed: true }
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
          snapshotVersion: value.context.version,
          calls: []
        };
      }
    }
  });
  forge.registry.register(createRegistration());
  const result = await forge.run({ input: 'inspect' });

  assert.equal(result.message, 'custom client');
  assert.equal(request.input, 'inspect');
});
