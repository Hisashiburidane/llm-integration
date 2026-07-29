import type { EnchantActionOptions } from './actions';
import type {
  EnchantCapability,
  EnchantMetadataNode,
  EnchantmentStatus
} from './enchantment';
import type { EnchantForgePlugin } from './forge';

export type EnchantActionDefinition<TInput = unknown, TResult = unknown> =
  EnchantActionOptions<TInput, TResult>;

export interface EnchantApiOptions {
  id: string;
  label?: string;
  provider?: string;
  actions: readonly EnchantActionDefinition<any, any>[];
}

export interface EnchantApi extends EnchantForgePlugin {
  readonly id: string;
  readonly actions: readonly EnchantActionDefinition<any, any>[];
}

export function defineEnchantAction<TInput = unknown, TResult = unknown>(
  definition: EnchantActionDefinition<TInput, TResult>
): EnchantActionDefinition<TInput, TResult> {
  return definition;
}

export function defineEnchantApi(options: EnchantApiOptions): EnchantApi {
  if (!options.id.trim()) throw new Error('Enchant API id 不能为空。');

  const scopeId = `api:${options.id}`;
  const capabilityIds = new Set<string>();
  const capabilities = options.actions.map((action) => {
    const id = action.id ?? `${scopeId}:${action.name}`;
    if (capabilityIds.has(id)) throw new Error(`Enchant API capability id 重复：${id}。`);
    capabilityIds.add(id);
    return {
      id,
      enchantmentId: scopeId,
      owner: action.owner ?? 'application',
      provider: action.provider ?? options.provider ?? options.id,
      name: action.name,
      label: action.label ?? action.name,
      description: action.description,
      target: action.target,
      effect: action.effect,
      inputSchema: action.inputSchema,
      source: {
        component: `api:${options.id}`,
        contributionId: id
      },
      execute: (input, context) => action.execute(input, context)
    } satisfies EnchantCapability;
  });
  const status: EnchantmentStatus = {
    alive: true,
    active: true,
    visible: true,
    enabled: true
  };

  function captureMetadata() {
    return options.actions.flatMap((action) => {
      const metadata = typeof action.metadata === 'function'
        ? action.metadata()
        : action.metadata;
      return (metadata ?? []).map((node): EnchantMetadataNode => ({
        ...node,
        scopeId: node.scopeId || scopeId,
        component: node.component ?? `api:${options.id}`
      }));
    });
  }

  return {
    id: options.id,
    name: `api:${options.id}`,
    actions: options.actions,
    setup(forge) {
      return forge.registry.register({
        id: scopeId,
        name: options.label ?? options.id,
        exposure: 'aura',
        getStatus: () => status,
        capture: () => ({
          enchantment: {
            id: scopeId,
            name: options.label ?? options.id,
            kind: 'custom',
            exposure: 'aura',
            status,
            metadata: captureMetadata(),
            capabilities: capabilities.map((capability) => capability.id),
            source: {
              scopeId,
              component: `api:${options.id}`
            },
            version: 1
          },
          capabilities
        })
      });
    }
  };
}
