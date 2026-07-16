import { computed } from 'vue';
import { getLatestEnchantForge, useEnchantForge } from './forge';
import type { EnchantTraceEvent } from './enchantment';

export type LlmDebugEvent = EnchantTraceEvent;

export function pushLlmDebugEvent(event: Omit<EnchantTraceEvent, 'id' | 'timestamp'>) {
  return getLatestEnchantForge()?.trace(event);
}

export function clearLlmDebugEvents(sourcePrefix?: string) {
  getLatestEnchantForge()?.clearTrace(sourcePrefix);
}

export function useLlmDebugEvents() {
  const forge = useEnchantForge();
  return computed(() => [...forge.events]);
}
