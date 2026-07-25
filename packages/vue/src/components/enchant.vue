<script setup lang="ts">
import {
  computed,
  getCurrentInstance,
  inject,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  provide,
  ref,
  unref,
  watch,
  type PropType,
  type WatchStopHandle
} from 'vue';
import { scanDom, type EnchantScan } from '../runtime/dom-adapter';
import type {
  EnchantCapabilityDefinition,
  EnchantContribution,
  EnchantExposure,
  EnchantMetadataNode,
  EnchantRegistration,
  Enchantment
} from '../runtime/enchantment';
import {
  createEnchantForge,
  enchantContextKey,
  enchantForgeKey,
  useEnchantForge
} from '../runtime/forge';

type MetadataInput = Partial<EnchantMetadataNode> & {
  id: string;
  type?: string;
};

const props = defineProps({
  id: String,
  name: String,
  page: String,
  route: String,
  kind: {
    type: String as PropType<Enchantment['kind']>,
    default: undefined
  },
  prompt: String,
  spell: String,
  state: {
    type: null as unknown as PropType<unknown | (() => unknown)>,
    default: undefined
  },
  scan: {
    type: [String, Object] as PropType<EnchantScan>,
    default: 'none'
  },
  metadata: {
    type: Array as PropType<MetadataInput[]>,
    default: () => []
  },
  capabilities: {
    type: Array as PropType<EnchantCapabilityDefinition[]>,
    default: () => []
  },
  exposure: {
    type: String as PropType<EnchantExposure>,
    default: undefined
  },
  registerGlobal: {
    type: Boolean,
    default: undefined
  },
  active: {
    type: Boolean,
    default: true
  },
  visible: {
    type: Boolean,
    default: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  tags: {
    type: Array as PropType<string[]>,
    default: () => []
  }
});

const instance = getCurrentInstance();
const parentContext = inject(enchantContextKey, undefined);
const installedForge = useEnchantForge(false);
const forge = installedForge ?? createEnchantForge();
if (!installedForge) provide(enchantForgeKey, forge);

const rootEl = ref<HTMLElement>();
const mounted = ref(false);
const activated = ref(true);
const captureVersion = ref(0);
const enchantment = ref<Enchantment>();
const contributions = new Map<string, { token: symbol; contribution: EnchantContribution }>();
const initialScopeId = props.name || props.id || `component-${instance?.uid ?? Math.random().toString(36).slice(2, 8)}`;
const enchantmentId = props.id || ['enchant', props.page || 'global', initialScopeId, instance?.uid ?? 'local'].join(':');
let unregister: (() => void) | undefined;
let observer: MutationObserver | undefined;
let stopStateWatch: WatchStopHandle | undefined;
let invalidateTimer: ReturnType<typeof setTimeout> | undefined;

function currentExposure(): EnchantExposure {
  return props.registerGlobal === false ? 'local' : (props.exposure ?? forge.policy.defaultExposure);
}

function currentStatus() {
  return {
    alive: mounted.value,
    active: props.active && activated.value,
    visible: props.visible,
    enabled: props.enabled
  };
}

function resolveState() {
  const source = props.state as unknown | (() => unknown);
  return typeof source === 'function' ? source() : unref(source);
}

function normalizeMetadata(metadata: MetadataInput[], scopeId: string): EnchantMetadataNode[] {
  return metadata.map((node) => ({
    visible: true,
    enabled: true,
    source: 'registered',
    ...node,
    scopeId,
    kind: node.kind || node.type || 'custom'
  } as EnchantMetadataNode));
}

function mergeMetadata(scanned: EnchantMetadataNode[], explicit: EnchantMetadataNode[]) {
  const nodes = new Map(scanned.map((node) => [node.id, node]));
  explicit.forEach((node) => nodes.set(node.id, { ...nodes.get(node.id), ...node } as EnchantMetadataNode));
  return Array.from(nodes.values());
}

function capture() {
  if (!rootEl.value || !mounted.value) throw new Error(`Enchant ${enchantmentId} 尚未挂载。`);
  const scopeId = props.name || initialScopeId;
  const scanned = scanDom(rootEl.value, { enchantmentId, scopeId, scan: props.scan });
  const capturedContributions = Array.from(contributions.values()).map(({ contribution }) => contribution.capture());
  const contributedMetadata = capturedContributions.flatMap((contribution) => contribution.metadata ?? []);
  const explicitMetadata = normalizeMetadata([...props.metadata, ...contributedMetadata], scopeId);
  const metadata = mergeMetadata(scanned.metadata, explicitMetadata);
  const explicitCapabilities = [
    ...props.capabilities,
    ...capturedContributions.flatMap((contribution) => contribution.capabilities ?? [])
  ].map((capability) => ({ ...capability, enchantmentId }));
  const explicitNames = new Set(explicitCapabilities.map((capability) => capability.name));
  const capabilities = [
    ...scanned.capabilities.filter((capability) => !explicitNames.has(capability.name)),
    ...explicitCapabilities
  ];
  captureVersion.value += 1;
  const next: Enchantment = {
    id: enchantmentId,
    name: props.name,
    page: props.page,
    route: props.route,
    kind: props.kind ?? (metadata.some((node) => node.kind === 'field') ? 'form' : 'panel'),
    exposure: currentExposure(),
    instruction: props.prompt || props.spell || undefined,
    status: currentStatus(),
    state: resolveState(),
    tags: [...props.tags],
    metadata,
    capabilities: capabilities.map((capability) => capability.id),
    source: {
      scopeId,
      parentEnchantmentId: parentContext?.id,
      component: instance?.type && typeof instance.type === 'object' && 'name' in instance.type
        ? String(instance.type.name || 'Enchant')
        : 'Enchant'
    },
    version: captureVersion.value
  };
  enchantment.value = next;
  return { enchantment: next, capabilities };
}

function registration(): EnchantRegistration {
  return {
    id: enchantmentId,
    name: props.name,
    page: props.page,
    route: props.route,
    tags: [...props.tags],
    exposure: currentExposure(),
    parentEnchantmentId: parentContext?.id,
    getStatus: currentStatus,
    capture
  };
}

function publishRegistration() {
  if (!mounted.value) return;
  if (unregister) forge.registry.update(registration());
  else unregister = forge.registry.register(registration());
}

function invalidate() {
  if (invalidateTimer) clearTimeout(invalidateTimer);
  invalidateTimer = setTimeout(() => forge.registry.invalidate(enchantmentId), 24);
}

function registerContribution(contribution: EnchantContribution) {
  const token = Symbol(contribution.id);
  contributions.set(contribution.id, { token, contribution });
  if (mounted.value) forge.registry.invalidate(enchantmentId);
  return () => {
    const current = contributions.get(contribution.id);
    if (!current || current.token !== token) return;
    contributions.delete(contribution.id);
    if (mounted.value) forge.registry.invalidate(enchantmentId);
  };
}

function configureObservation(enabled: boolean) {
  observer?.disconnect();
  observer = undefined;
  stopStateWatch?.();
  stopStateWatch = undefined;
  if (!enabled || !rootEl.value) return;

  // Do not observe arbitrary visualization DOM when this boundary has no scanner.
  const scanMode = typeof props.scan === 'string' ? props.scan : (props.scan?.mode ?? 'none');
  if (scanMode !== 'none' && globalThis.MutationObserver) {
    observer = new MutationObserver(invalidate);
    observer.observe(rootEl.value, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        'aria-disabled',
        'aria-invalid',
        'disabled',
        'readonly',
        'required',
        'value',
        'data-enchant-node',
        'data-enchant-ignore'
      ]
    });
  }
  stopStateWatch = watch(resolveState, invalidate, { deep: true, flush: 'post' });
}

function refresh() {
  const snapshot = forge.capture({ enchantmentIds: [enchantmentId], includeLocal: true });
  return snapshot;
}

provide(enchantContextKey, {
  id: enchantmentId,
  enchantment,
  refresh,
  registerContribution
});

onMounted(() => {
  mounted.value = true;
  publishRegistration();
  configureObservation(forge.observationEnabled.value);
});

onActivated(() => {
  activated.value = true;
  publishRegistration();
});

onDeactivated(() => {
  activated.value = false;
  publishRegistration();
});

watch(forge.observationEnabled, configureObservation);
watch(() => [
  props.name,
  props.page,
  props.route,
  props.kind,
  props.prompt,
  props.spell,
  props.exposure,
  props.registerGlobal,
  props.active,
  props.visible,
  props.enabled,
  JSON.stringify(props.scan),
  JSON.stringify(props.metadata),
  JSON.stringify(props.tags)
], publishRegistration, { flush: 'post' });

onBeforeUnmount(() => {
  mounted.value = false;
  observer?.disconnect();
  stopStateWatch?.();
  if (invalidateTimer) clearTimeout(invalidateTimer);
  unregister?.();
});

defineExpose({
  enchantment: computed(() => enchantment.value),
  capture: refresh,
  refresh,
  getSnapshot: refresh
});
</script>

<template>
  <div
    ref="rootEl"
    class="enchant-boundary llm-scope"
    :data-enchant="enchantmentId"
    :data-enchant-name="name"
    :data-enchant-page="page"
  >
    <slot :enchantment="enchantment" :capture="refresh" :refresh="refresh" />
  </div>
</template>

<style scoped>
.enchant-boundary {
  display: contents;
}
</style>
