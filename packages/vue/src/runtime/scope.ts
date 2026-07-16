import { computed, type ComputedRef, type InjectionKey, type MaybeRef } from 'vue';
import type { Enchantment, EnchantMetadataTreeNode, EnchantRegistration, EnchantTool } from './enchantment';
import { getLatestEnchantForge, useEnchantForge } from './forge';

export interface MetadataNode {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  aliases?: string[];
}

export interface LlmScopeSnapshot {
  id: string;
  page?: string;
  prompt: string;
  metadata: MetadataNode[];
}

export interface LlmMetadataTreeNode {
  id: string;
  label: string;
  type: 'page' | 'scope' | 'metadata';
  children?: LlmMetadataTreeNode[];
}

export type LlmPageToolAction = 'readScope' | 'focusField' | 'setFieldValue' | 'highlightScope' | 'openScope' | 'composeScope' | 'clearPageFocus';

export interface LlmPageTool {
  id: string;
  page?: string;
  scopeId: string;
  action: LlmPageToolAction;
  target?: string;
  label: string;
  description: string;
}

type FieldHandle = {
  scopeId: string;
  page?: string;
  fieldId: string;
  label: string;
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
};

export const llmScopeKey: InjectionKey<ComputedRef<LlmScopeSnapshot>> = Symbol('legacy-llm-scope');
const legacyRegistrations = new Map<string, () => void>();
const legacyFieldHandles = new Map<string, FieldHandle>();

function legacyKey(page: string | undefined, scopeId: string) {
  return `${page ?? 'global'}::${scopeId}`;
}

function toLegacyScope(enchantment: Enchantment): LlmScopeSnapshot {
  return {
    id: enchantment.source.scopeId,
    page: enchantment.page,
    prompt: enchantment.instruction ?? '',
    metadata: enchantment.metadata.map((node) => ({
      id: node.id,
      label: node.label ?? ('text' in node ? node.text : node.id),
      type: node.kind,
      required: 'required' in node ? node.required : undefined,
      aliases: 'aliases' in node ? node.aliases : undefined
    }))
  };
}

function actionFor(tool: EnchantTool): LlmPageToolAction {
  if (tool.name === 'field.focus') return 'focusField';
  if (tool.name === 'field.fill') return 'setFieldValue';
  if (tool.name === 'scope.highlight') return 'highlightScope';
  if (tool.name === 'scope.open') return 'openScope';
  if (tool.name === 'scope.compose') return 'composeScope';
  return 'readScope';
}

function toLegacyTool(tool: EnchantTool, scopes: Enchantment[]): LlmPageTool {
  const owner = scopes.find((scope) => scope.id === tool.enchantmentId);
  return {
    id: tool.capabilityId,
    page: tool.page,
    scopeId: owner?.source.scopeId ?? tool.enchantmentId,
    action: actionFor(tool),
    target: tool.target,
    label: tool.label,
    description: tool.description
  };
}

export function registerLlmScope(snapshot: LlmScopeSnapshot) {
  const forge = getLatestEnchantForge();
  if (!forge) return () => undefined;
  const id = `legacy:${legacyKey(snapshot.page, snapshot.id)}`;
  const registration: EnchantRegistration = {
    id,
    name: snapshot.id,
    page: snapshot.page,
    exposure: 'aura',
    getStatus: () => ({ alive: true, active: true, visible: true, enabled: true }),
    capture: () => ({
      enchantment: {
        id,
        name: snapshot.id,
        page: snapshot.page,
        kind: 'custom',
        exposure: 'aura',
        instruction: snapshot.prompt,
        status: { alive: true, active: true, visible: true, enabled: true },
        metadata: snapshot.metadata.map((node) => ({
          id: node.id,
          scopeId: snapshot.id,
          kind: node.type,
          label: node.label,
          required: node.required,
          aliases: node.aliases,
          visible: true,
          enabled: true,
          source: 'registered'
        })),
        capabilities: [],
        source: { scopeId: snapshot.id },
        version: 1
      },
      capabilities: []
    })
  };
  legacyRegistrations.get(id)?.();
  const unregister = forge.registry.register(registration);
  legacyRegistrations.set(id, unregister);
  return () => {
    unregister();
    legacyRegistrations.delete(id);
  };
}

export function updateLlmScope(snapshot: LlmScopeSnapshot) {
  registerLlmScope(snapshot);
}

export function registerScopeFieldHandles(page: string | undefined, scopeId: string, handles: FieldHandle[]) {
  clearScopeFieldHandles(page, scopeId);
  handles.forEach((handle) => legacyFieldHandles.set(`${legacyKey(page, scopeId)}::${handle.fieldId}`, handle));
}

export function clearScopeFieldHandles(page: string | undefined, scopeId: string) {
  const prefix = `${legacyKey(page, scopeId)}::`;
  Array.from(legacyFieldHandles.keys()).forEach((key) => {
    if (key.startsWith(prefix)) legacyFieldHandles.delete(key);
  });
}

export function getLlmScopeSnapshots(page?: string) {
  const forge = getLatestEnchantForge();
  return forge?.capture({ page, includeLocal: true }).enchantments.map(toLegacyScope) ?? [];
}

export function useLlmScopeRegistry(page?: MaybeRef<string | undefined>) {
  const forge = useEnchantForge();
  return computed(() => {
    forge.registry.version.value;
    const value = typeof page === 'object' ? page.value : page;
    return forge.capture({ page: value, includeLocal: true }).enchantments.map(toLegacyScope);
  });
}

export function buildMetadataTree(scopes: LlmScopeSnapshot[], pageId = 'current-page'): LlmMetadataTreeNode {
  return {
    id: pageId,
    label: pageId,
    type: 'page',
    children: scopes.map((scope) => ({
      id: scope.id,
      label: scope.id,
      type: 'scope',
      children: scope.metadata.map((node) => ({ id: node.id, label: node.label, type: 'metadata' }))
    }))
  };
}

export function buildToolsFromScopes(scopes: LlmScopeSnapshot[], pageId = 'current-page'): LlmPageTool[] {
  return scopes.map((scope) => ({
    id: `${scope.id}:read`,
    page: scope.page ?? pageId,
    scopeId: scope.id,
    action: 'readScope',
    label: `读取 ${scope.id}`,
    description: '读取当前区域 metadata。'
  }));
}

export function executePageTool(tool: LlmPageTool, value = '') {
  const forge = getLatestEnchantForge();
  if (!forge) return false;
  const capability = forge.registry.getCapability(tool.id);
  if (!capability) return false;
  const snapshot = forge.capture({ page: tool.page });
  const input = tool.action === 'setFieldValue'
    ? { values: tool.target ? { [tool.target]: value } : {} }
    : tool.target ? { fieldId: tool.target } : {};
  void forge.execute({ capabilityId: capability.id, input }, { snapshot });
  return true;
}

export function useActiveLlmPage(page: MaybeRef<string | undefined>) {
  const forge = useEnchantForge();
  return computed(() => {
    forge.registry.version.value;
    const pageId = typeof page === 'object' ? page.value ?? 'current-page' : page ?? 'current-page';
    const snapshot = forge.capture({ page: pageId });
    return {
      pageId,
      scopeList: snapshot.enchantments.map(toLegacyScope),
      metadataTree: convertMetadataTree(snapshot.metadataTree),
      toolList: snapshot.tools.map((tool) => toLegacyTool(tool, snapshot.enchantments))
    };
  });
}

function convertMetadataTree(node: EnchantMetadataTreeNode): LlmMetadataTreeNode {
  return {
    id: node.id,
    label: node.label,
    type: node.type === 'enchantment' ? 'scope' : node.type,
    children: node.children?.map(convertMetadataTree)
  };
}
