import type { CapabilityEffect, EnchantCapability, Enchantment } from './enchantment';

export type EnchantPolicyMode = 'read-only' | 'draft-only' | 'disabled';

export interface EnchantPolicy {
  mode: EnchantPolicyMode;
  defaultExposure: 'aura' | 'local' | 'private';
  allowedEffects: CapabilityEffect[];
  requireConfirmationFor: CapabilityEffect[];
  blockedCapabilities: string[];
  blockedProviderEffects: Record<string, CapabilityEffect[]>;
  valuePolicy: Record<string, 'expose' | 'mask' | 'omit'>;
}

export interface EnchantPolicyDecision {
  allowed: boolean;
  requiresConfirmation: boolean;
  reason?: string;
}

export const defaultEnchantPolicy: EnchantPolicy = {
  mode: 'draft-only',
  defaultExposure: 'aura',
  allowedEffects: ['read', 'visual', 'draft'],
  requireConfirmationFor: [],
  blockedCapabilities: [],
  blockedProviderEffects: {},
  valuePolicy: {
    password: 'omit',
    token: 'omit',
    secret: 'omit'
  }
};

export function resolveEnchantPolicy(policy: Partial<EnchantPolicy> = {}): EnchantPolicy {
  return {
    ...defaultEnchantPolicy,
    ...policy,
    allowedEffects: [...(policy.allowedEffects ?? defaultEnchantPolicy.allowedEffects)],
    requireConfirmationFor: [...(policy.requireConfirmationFor ?? defaultEnchantPolicy.requireConfirmationFor)],
    blockedCapabilities: [...(policy.blockedCapabilities ?? defaultEnchantPolicy.blockedCapabilities)],
    blockedProviderEffects: Object.fromEntries(
      Object.entries(policy.blockedProviderEffects ?? defaultEnchantPolicy.blockedProviderEffects)
        .map(([provider, effects]) => [provider, [...effects]])
    ),
    valuePolicy: { ...defaultEnchantPolicy.valuePolicy, ...policy.valuePolicy }
  };
}

export function evaluateEnchantPolicy(
  policy: EnchantPolicy,
  capability: EnchantCapability,
  enchantment: Enchantment
): EnchantPolicyDecision {
  if (
    !enchantment.status.alive
    || !enchantment.status.active
    || !enchantment.status.visible
    || !enchantment.status.enabled
  ) {
    return { allowed: false, requiresConfirmation: false, reason: '目标 Enchantment 当前不可执行。' };
  }

  if (policy.mode === 'disabled') {
    return { allowed: false, requiresConfirmation: false, reason: 'Forge 当前处于 disabled 模式。' };
  }

  if (policy.mode === 'read-only' && !['read', 'visual'].includes(capability.effect)) {
    return { allowed: false, requiresConfirmation: false, reason: 'read-only 模式只允许读取和视觉操作。' };
  }

  if (policy.mode === 'draft-only' && capability.effect === 'commit') {
    return { allowed: false, requiresConfirmation: false, reason: 'draft-only 模式禁止提交类操作。' };
  }

  if (policy.blockedCapabilities.includes(capability.id)) {
    return { allowed: false, requiresConfirmation: false, reason: 'Capability 已被 policy 禁止。' };
  }

  if (!policy.allowedEffects.includes(capability.effect)) {
    return { allowed: false, requiresConfirmation: false, reason: 'Capability effect 未被 policy 允许。' };
  }

  if (policy.blockedProviderEffects[capability.provider]?.includes(capability.effect)) {
    return {
      allowed: false,
      requiresConfirmation: false,
      reason: `Capability provider/effect 已被 policy 禁止：${capability.provider}/${capability.effect}。`
    };
  }

  return {
    allowed: true,
    requiresConfirmation: policy.requireConfirmationFor.includes(capability.effect)
  };
}
