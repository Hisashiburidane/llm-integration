import type { EnchantForgePlugin } from '@enchantforge/vue';

interface SupportExecutionPolicyOptions {
  orderCacheTtl?: number;
}

interface OrderQueryInput {
  orderNo?: string;
  refresh?: boolean;
}

interface CachedExecution {
  expiresAt: number;
  value?: unknown;
  pending?: Promise<unknown>;
}

export function createSupportExecutionPolicy(
  options: SupportExecutionPolicyOptions = {}
): EnchantForgePlugin {
  const orderCacheTtl = Math.max(0, options.orderCacheTtl ?? 5 * 60_000);

  return {
    name: 'customer-service:execution-policy',
    setup(forge) {
      const executions = new Map<string, CachedExecution>();
      const unregister = forge.registerExecutionMiddleware(async (request, next) => {
        if (request.capability.name !== 'support.get_order_detail') return next();

        const input = request.input as OrderQueryInput;
        const orderNo = input.orderNo?.trim().toUpperCase();
        if (!orderNo || input.refresh || orderCacheTtl === 0) return next();

        const key = `${request.capability.id}:${orderNo}`;
        const cached = executions.get(key);
        if (cached?.pending) return cached.pending;
        if (cached?.value !== undefined && cached.expiresAt > Date.now()) return cached.value;
        executions.delete(key);

        const pending = Promise.resolve(next());
        executions.set(key, { expiresAt: 0, pending });
        try {
          const value = await pending;
          executions.set(key, {
            expiresAt: Date.now() + orderCacheTtl,
            value
          });
          return value;
        } catch (error) {
          executions.delete(key);
          throw error;
        }
      });

      return () => {
        unregister();
        executions.clear();
      };
    }
  };
}

export const supportExecutionPolicy = createSupportExecutionPolicy();
