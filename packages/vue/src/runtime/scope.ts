import { computed, shallowReactive, type ComputedRef, type InjectionKey } from 'vue';

export type MetadataNode = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  aliases?: string[];
};

export type LlmScopeSnapshot = {
  id: string;
  prompt: string;
  metadata: MetadataNode[];
};

export const llmScopeKey: InjectionKey<ComputedRef<LlmScopeSnapshot>> = Symbol('llm-scope');

const globalScopes = shallowReactive(new Map<string, LlmScopeSnapshot>());

export function registerLlmScope(snapshot: LlmScopeSnapshot) {
  globalScopes.set(snapshot.id, snapshot);
  return () => globalScopes.delete(snapshot.id);
}

export function updateLlmScope(snapshot: LlmScopeSnapshot) {
  globalScopes.set(snapshot.id, snapshot);
}

export function getLlmScopeSnapshots() {
  return Array.from(globalScopes.values());
}

export function useLlmScopeRegistry() {
  return computed(() => Array.from(globalScopes.values()));
}
