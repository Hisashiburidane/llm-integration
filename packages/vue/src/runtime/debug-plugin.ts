import type { EnchantForgePlugin, EnchantSnapshotConfig } from './forge';

export interface EnchantDebugOptions {
  snapshots?: Partial<EnchantSnapshotConfig>;
}

export function createEnchantDebug(options: EnchantDebugOptions = {}): EnchantForgePlugin {
  return {
    name: 'enchant-debug',
    setup(forge) {
      forge.configureSnapshots({
        autoCapture: options.snapshots?.autoCapture ?? true,
        retention: options.snapshots?.retention ?? 30,
        throttle: options.snapshots?.throttle ?? 160
      });
    }
  };
}
