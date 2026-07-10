import type { ComputedRef, InjectionKey } from 'vue';

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
