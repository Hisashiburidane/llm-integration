import type { EnchantProgressEvent, EnchantRegistryDigest, EnchantRunPhase } from './enchantment';

export interface AuraProgressContext {
  event: EnchantProgressEvent;
  digest: EnchantRegistryDigest;
}

export type AuraProgressMessage = string | ((context: AuraProgressContext) => string);

export type AuraProgressMessages = Partial<Record<EnchantRunPhase, AuraProgressMessage>>;

export interface AuraActivityStep {
  id: string;
  phase: EnchantRunPhase;
  label: string;
  status: 'running' | 'done' | 'failed';
  current?: number;
  total?: number;
}

export const defaultAuraProgressMessages: Record<EnchantRunPhase, AuraProgressMessage> = {
  capturing: '正在读取页面信息',
  planning: '正在理解用户需求',
  authorizing: ({ event }) => event.capabilityLabel
    ? `正在检查：${event.capabilityLabel}`
    : '正在检查可执行操作',
  executing: ({ event }) => event.detail
    || (event.capabilityLabel ? `正在执行：${event.capabilityLabel}` : '正在执行操作'),
  responding: '正在整理分析结果',
  completed: '操作已完成',
  failed: ({ event }) => event.detail || '操作未完成'
};

export function formatAuraProgress(
  event: EnchantProgressEvent,
  digest: EnchantRegistryDigest,
  messages: AuraProgressMessages = {}
) {
  const formatter = messages[event.phase] ?? defaultAuraProgressMessages[event.phase];
  return typeof formatter === 'function' ? formatter({ event, digest }) : formatter;
}
