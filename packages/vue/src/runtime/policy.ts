import type { CapabilityEffect, EnchantCapability, Enchantment } from './enchantment';

export interface EnchantPolicy {
  defaultExposure: 'aura' | 'local' | 'private';
  allowDomWrite: boolean;
  allowedEffects: CapabilityEffect[];
  requireConfirmationFor: CapabilityEffect[];
  blockedCapabilities: string[];
  valuePolicy: Record<string, 'expose' | 'mask' | 'omit'>;
}

export interface EnchantPolicyDecision {
  allowed: boolean;
  requiresConfirmation: boolean;
  reason?: string;
}

export const defaultEnchantPolicy: EnchantPolicy = {
  defaultExposure: 'aura',
  allowDomWrite: true,
  allowedEffects: ['read', 'visual', 'draft'],
  requireConfirmationFor: [],
  blockedCapabilities: [],
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

  if (policy.blockedCapabilities.includes(capability.id)) {
    return { allowed: false, requiresConfirmation: false, reason: 'Capability 已被 policy 禁止。' };
  }

  if (!policy.allowedEffects.includes(capability.effect)) {
    return { allowed: false, requiresConfirmation: false, reason: 'Capability effect 未被 policy 允许。' };
  }

  if (!policy.allowDomWrite && capability.effect === 'draft' && capability.provider === 'dom') {
    return { allowed: false, requiresConfirmation: false, reason: 'DOM 写入已被 policy 禁止。' };
  }

  return {
    allowed: true,
    requiresConfirmation: policy.requireConfirmationFor.includes(capability.effect)
  };
}
