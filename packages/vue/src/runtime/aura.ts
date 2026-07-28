import type { Component } from 'vue';
import type { EnchantAgent, EnchantConversationMessage } from './agent';
import type { EnchantConfirmationRequest } from './forge';
import type { EnchantRunResult } from './enchantment';
import type { AuraActivityStep, AuraProgressMessages } from './presentation';

export interface AuraProps {
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
  model?: string;
  endpoint?: string;
  apiKey?: string;
  configError?: string;
  open?: boolean;
  defaultOpen?: boolean;
  initialMessages?: readonly EnchantConversationMessage[];
  historyLimit?: number;
  clearOnPageChange?: boolean;
  confirm?: (request: EnchantConfirmationRequest) => boolean | Promise<boolean>;
}

export interface AuraMessage extends EnchantConversationMessage {
  id: string;
  type: 'message';
  status: 'sent' | 'error';
}

export interface AuraActivity {
  id: string;
  type: 'activity';
  status: 'running' | 'done' | 'failed';
  steps: AuraActivityStep[];
  expandedKeys: string[];
  startedAt: number;
  finishedAt?: number;
}

export type AuraConversationItem = AuraMessage | AuraActivity;
export type AuraClearReason = 'user' | 'api' | 'page-change';

export interface AuraSubmitEvent {
  input: string;
  history: readonly EnchantConversationMessage[];
}

export interface AuraCompleteEvent extends AuraSubmitEvent {
  result: EnchantRunResult;
}

export interface AuraErrorEvent extends AuraSubmitEvent {
  error: unknown;
}

export interface AuraInstance {
  open(): void;
  close(): void;
  toggle(): void;
  focus(): void;
  submit(message?: string): Promise<EnchantRunResult | undefined>;
  cancel(): void;
  clear(): void;
  getMessages(): readonly EnchantConversationMessage[];
}
