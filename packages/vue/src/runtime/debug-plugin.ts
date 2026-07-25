import { createVNode, render, type App } from 'vue';
import DebugOverlay from '../components/debug-overlay.vue';
import type { EnchantDebugConfig, EnchantForge, EnchantForgePlugin, EnchantSnapshotConfig } from './forge';

export interface EnchantDebugOptions {
  snapshots?: Partial<EnchantSnapshotConfig>;
  overlay?: boolean;
  title?: string;
  position?: EnchantDebugConfig['position'];
}

export function createEnchantDebug(options: EnchantDebugOptions = {}): EnchantForgePlugin {
  return {
    name: 'enchant-debug',
    setup(forge) {
      forge.configureSnapshots({
        autoCapture: options.snapshots?.autoCapture ?? false,
        retention: options.snapshots?.retention ?? 30,
        throttle: options.snapshots?.throttle ?? 160
      });
      forge.configureDebug({
        enabled: options.overlay ?? true,
        title: options.title ?? 'Enchant Debug',
        position: options.position ?? 'bottom-right'
      });
    },
    install(forge: EnchantForge, app: App) {
      if (!forge.debug.enabled || typeof document === 'undefined') return;
      const host = document.createElement('div');
      host.dataset.enchantDebug = 'true';
      document.body.appendChild(host);
      const vnode = createVNode(DebugOverlay);
      vnode.appContext = app._context;
      render(vnode, host);
      return () => {
        render(null, host);
        host.remove();
      };
    }
  };
}
