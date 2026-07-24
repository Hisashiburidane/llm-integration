import { readonly, ref, shallowReactive, type Ref } from 'vue';
import type {
  EnchantCapability,
  EnchantMetadataTreeNode,
  EnchantRegistration,
  EnchantRegistryDigest,
  EnchantSnapshot,
  EnchantTool,
  Enchantment
} from './enchantment';

export interface EnchantSnapshotOptions {
  page?: string;
  route?: string;
  tab?: string;
  tags?: string[];
  app?: string;
  enchantmentIds?: string[];
  includeLocal?: boolean;
  includeHidden?: boolean;
  retain?: boolean;
}

export interface EnchantRegistry {
  readonly version: Readonly<Ref<number>>;
  touch(): void;
  register(registration: EnchantRegistration): () => void;
  update(registration: EnchantRegistration): void;
  invalidate(enchantmentId: string): void;
  unregister(enchantmentId: string): void;
  getRegistration(enchantmentId: string): EnchantRegistration | undefined;
  getCapability(capabilityId: string): EnchantCapability | undefined;
  list(options?: EnchantSnapshotOptions): EnchantRegistration[];
  digest(options?: Pick<EnchantSnapshotOptions, 'page' | 'route' | 'tab' | 'tags' | 'includeLocal' | 'includeHidden'>): EnchantRegistryDigest;
  capture(options?: EnchantSnapshotOptions): EnchantSnapshot;
  subscribe(listener: () => void): () => void;
  clear(): void;
}

function getEnchantmentLabel(enchantment: Enchantment) {
  if (enchantment.name) return enchantment.name;
  const text = enchantment.metadata.find((node) => node.kind === 'text');
  if (text && 'text' in text) return text.text.replace(/\s+/g, ' ').slice(0, 64);
  return enchantment.id;
}

function toMetadataNode(node: Enchantment['metadata'][number]): EnchantMetadataTreeNode {
  const treeNode: EnchantMetadataTreeNode = {
    id: node.id,
    label: node.label ?? ('text' in node ? node.text : node.id),
    type: 'metadata',
    kind: node.kind
  };
  if ('children' in node) treeNode.children = node.children.map(toMetadataNode);
  return treeNode;
}

function toMetadataTree(enchantments: Enchantment[], pageId: string): EnchantMetadataTreeNode {
  return {
    id: pageId,
    label: pageId,
    type: 'page',
    children: enchantments.map((enchantment) => ({
      id: enchantment.id,
      label: getEnchantmentLabel(enchantment),
      type: 'enchantment',
      kind: enchantment.kind,
      children: enchantment.metadata.map(toMetadataNode)
    }))
  };
}

function toTool(capability: EnchantCapability, enchantment: Enchantment): EnchantTool {
  return {
    id: capability.id,
    capabilityId: capability.id,
    enchantmentId: enchantment.id,
    owner: capability.owner,
    provider: capability.provider,
    page: enchantment.page,
    name: capability.name,
    label: capability.label,
    description: capability.description,
    target: capability.target,
    effect: capability.effect,
    inputSchema: capability.inputSchema
  };
}

export function createEnchantRegistry(): EnchantRegistry {
  const registrations = shallowReactive(new Map<string, EnchantRegistration>());
  const capabilities = new Map<string, EnchantCapability>();
  const capabilityOwners = new Map<string, Set<string>>();
  const registrationTokens = new Map<string, symbol>();
  const listeners = new Set<() => void>();
  const version = ref(0);

  function touch() {
    version.value += 1;
    listeners.forEach((listener) => listener());
  }

  function clearCapabilities(enchantmentId: string) {
    capabilityOwners.get(enchantmentId)?.forEach((id) => capabilities.delete(id));
    capabilityOwners.delete(enchantmentId);
  }

  function replaceCapabilities(enchantmentId: string, next: EnchantCapability[]) {
    clearCapabilities(enchantmentId);
    const ids = new Set<string>();
    next.forEach((capability) => {
      if (capability.enchantmentId !== enchantmentId) throw new Error('Capability owner 与 Enchantment 不一致。');
      capabilities.set(capability.id, capability);
      ids.add(capability.id);
    });
    capabilityOwners.set(enchantmentId, ids);
  }

  function register(registration: EnchantRegistration) {
    const token = Symbol(registration.id);
    clearCapabilities(registration.id);
    registrationTokens.set(registration.id, token);
    registrations.set(registration.id, registration);
    touch();
    return () => {
      if (registrationTokens.get(registration.id) === token) unregister(registration.id);
    };
  }

  function update(registration: EnchantRegistration) {
    if (!registrations.has(registration.id)) {
      register(registration);
      return;
    }
    clearCapabilities(registration.id);
    registrations.set(registration.id, registration);
    touch();
  }

  function invalidate(enchantmentId: string) {
    clearCapabilities(enchantmentId);
    touch();
  }

  function unregister(enchantmentId: string) {
    if (!registrations.delete(enchantmentId)) return;
    registrationTokens.delete(enchantmentId);
    clearCapabilities(enchantmentId);
    touch();
  }

  function list(options: EnchantSnapshotOptions = {}) {
    const requestedIds = options.enchantmentIds ? new Set(options.enchantmentIds) : undefined;
    return Array.from(registrations.values()).filter((registration) => {
      if (requestedIds && !requestedIds.has(registration.id)) return false;
      if (options.page && registration.page && registration.page !== options.page) return false;
      if (options.route && registration.route && registration.route !== options.route) return false;
      if (registration.exposure === 'private') return false;
      if (!options.includeLocal && registration.exposure !== 'aura') return false;
      const status = registration.getStatus();
      if (!options.includeHidden && (!status.alive || !status.active || !status.visible || !status.enabled)) return false;
      return true;
    });
  }

  function digest(options: Pick<EnchantSnapshotOptions, 'page' | 'route' | 'tab' | 'tags' | 'includeLocal' | 'includeHidden'> = {}) {
    const current = list(options);
    const currentIds = new Set(current.map((registration) => registration.id));
    return {
      pageId: options.page ?? 'current-page',
      version: version.value,
      activeEnchantments: current.length,
      capturedCapabilities: Array.from(capabilities.values()).filter((capability) => currentIds.has(capability.enchantmentId)).length
    };
  }

  function capture(options: EnchantSnapshotOptions = {}): EnchantSnapshot {
    const pageId = options.page ?? 'current-page';
    const results = list(options).map((registration) => registration.capture());
    results.forEach((result) => {
      replaceCapabilities(result.enchantment.id, result.capabilities);
    });
    const enchantments = results.map((result) => result.enchantment);
    const tools = results.flatMap((result) => result.capabilities.map((capability) => toTool(capability, result.enchantment)));

    return {
      id: `${pageId}:${version.value}:${Date.now()}`,
      version: version.value,
      pageId,
      app: options.app,
      route: options.route,
      tab: options.tab,
      tags: options.tags ? [...options.tags] : undefined,
      createdAt: new Date().toISOString(),
      enchantments,
      metadataTree: toMetadataTree(enchantments, pageId),
      tools
    };
  }

  function clear() {
    registrations.clear();
    capabilities.clear();
    capabilityOwners.clear();
    registrationTokens.clear();
    touch();
  }

  return {
    version: readonly(version),
    touch,
    register,
    update,
    invalidate,
    unregister,
    getRegistration: (id) => registrations.get(id),
    getCapability: (id) => capabilities.get(id),
    list,
    digest,
    capture,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clear
  };
}
