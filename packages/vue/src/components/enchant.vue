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
import { scanDom } from '../runtime/dom-adapter';
import type {
  EnchantCapability,
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
  metadata: {
    type: Array as PropType<MetadataInput[]>,
    default: () => []
  },
  capabilities: {
    type: Array as PropType<EnchantCapability[]>,
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
  const scanned = scanDom(rootEl.value, { enchantmentId, scopeId, page: props.page, visual: forge.visual });
  const metadata = mergeMetadata(scanned.metadata, normalizeMetadata(props.metadata, scopeId));
  const capabilities = [
    ...scanned.capabilities,
    ...props.capabilities.map((capability) => ({ ...capability, enchantmentId }))
  ];
  captureVersion.value += 1;
  const next: Enchantment = {
    id: enchantmentId,
    name: props.name,
    page: props.page,
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

function configureObservation(enabled: boolean) {
  observer?.disconnect();
  observer = undefined;
  stopStateWatch?.();
  stopStateWatch = undefined;
  if (!enabled || !rootEl.value) return;

  if (globalThis.MutationObserver) {
    observer = new MutationObserver(invalidate);
    observer.observe(rootEl.value, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['aria-disabled', 'aria-invalid', 'disabled', 'readonly', 'required', 'value', 'class']
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
  refresh
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
  props.kind,
  props.prompt,
  props.spell,
  props.exposure,
  props.registerGlobal,
  props.active,
  props.visible,
  props.enabled,
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
