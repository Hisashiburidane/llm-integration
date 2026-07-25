<script setup lang="ts">
import { computed, ref } from 'vue';
import { useEnchantForge } from '../runtime/forge';
import type { EnchantSnapshot } from '../runtime/enchantment';

const forge = useEnchantForge();
const open = ref(false);
const activeTab = ref('overview');
const inspectedSnapshot = ref<EnchantSnapshot>();

const digest = computed(() => {
  forge.registry.version.value;
  return forge.digest();
});

const events = computed(() => forge.events.slice(0, 80));
const snapshots = computed(() => forge.snapshots);
const snapshot = computed(() => inspectedSnapshot.value ?? snapshots.value[0]);
const positionClass = computed(() => `debug-position-${forge.debug.position}`);

function refreshSnapshot() {
  inspectedSnapshot.value = forge.capture({ retain: true });
}

function clearEvents() {
  forge.clearTrace();
}

function stringify(value: unknown) {
  return JSON.stringify(value, null, 2) ?? '';
}
</script>

<template>
  <div class="enchant-debug-root" :class="positionClass">
    <button
      class="enchant-debug-trigger"
      type="button"
      :aria-label="forge.debug.title"
      :title="forge.debug.title"
      @click="open = true"
    >
      <span class="debug-glyph">&gt;_</span>
      <span>Debug</span>
      <span class="debug-count" :title="`${events.length} trace events`">trace {{ events.length }}</span>
    </button>

    <Transition name="debug-fade">
      <aside v-if="open" class="debug-drawer">
        <header class="debug-drawer-header">
          <strong>{{ forge.debug.title }}</strong>
          <div class="debug-actions">
            <button type="button" @click="refreshSnapshot">刷新</button>
            <button type="button" @click="clearEvents">清空 trace</button>
            <button type="button" aria-label="关闭 Debug" @click="open = false">×</button>
          </div>
        </header>

        <div class="debug-drawer-body">
          <div class="debug-summary">
            <div><span>page</span><strong>{{ digest.pageId }}</strong></div>
            <div><span>version</span><strong>{{ digest.version }}</strong></div>
            <div><span>enchantments</span><strong>{{ digest.activeEnchantments }}</strong></div>
            <div><span>tools</span><strong>{{ digest.capturedCapabilities }}</strong></div>
          </div>

          <nav class="debug-tabs" aria-label="Debug sections">
            <button type="button" :class="{ active: activeTab === 'overview' }" @click="activeTab = 'overview'">Overview</button>
            <button type="button" :class="{ active: activeTab === 'snapshot' }" @click="activeTab = 'snapshot'">Snapshot</button>
            <button type="button" :class="{ active: activeTab === 'trace' }" @click="activeTab = 'trace'">Trace ({{ events.length }})</button>
          </nav>

          <section v-if="activeTab === 'overview'">
            <div class="debug-tags">
              <span class="debug-tag">mode: {{ forge.policy.mode }}</span>
              <span class="debug-tag">route: {{ forge.navigation.route || '-' }}</span>
              <span class="debug-tag">exporters: {{ forge.exporters.length }}</span>
            </div>
            <pre class="debug-json">{{ stringify({ navigation: forge.navigation, policy: forge.policy, exporters: forge.exporters }) }}</pre>
          </section>
          <section v-else-if="activeTab === 'snapshot'">
            <p v-if="!snapshot" class="debug-empty">暂无 snapshot。点击“刷新”捕获当前页面。</p>
            <pre v-else class="debug-json">{{ stringify(snapshot) }}</pre>
          </section>
          <section v-else>
            <p v-if="!events.length" class="debug-empty">暂无 trace。</p>
            <pre v-else class="debug-json">{{ stringify(events) }}</pre>
          </section>
        </div>
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
.enchant-debug-root {
  position: fixed;
  z-index: 2147483000;
  bottom: 18px;
  display: flex;
  align-items: flex-end;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.debug-position-bottom-right { right: 18px; }
.debug-position-bottom-left { left: 18px; }

.enchant-debug-trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 11px;
  color: #314158;
  background: #fff;
  border: 1px solid #b8c4d4;
  border-radius: 6px;
  box-shadow: 0 5px 18px rgb(37 55 79 / 16%);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  letter-spacing: .02em;
}

.enchant-debug-trigger:hover { color: #0958d9; border-color: #7aa2df; }
.debug-glyph { color: #0958d9; font-weight: 700; }
.debug-count { min-width: 16px; padding: 1px 4px; color: #fff; background: #64748b; border-radius: 8px; font-size: 9px; text-align: center; }

.debug-drawer { position: fixed; z-index: 1; top: 0; right: 0; bottom: 0; display: flex; width: min(560px, 94vw); flex-direction: column; background: #fff; border-left: 1px solid #d8e0eb; box-shadow: -12px 0 40px rgb(37 55 79 / 16%); }
.debug-drawer-header { display: flex; min-height: 52px; align-items: center; justify-content: space-between; padding: 0 16px; border-bottom: 1px solid #e3eaf3; color: #1f2d3d; font-size: 13px; }
.debug-actions { display: flex; gap: 6px; align-items: center; }
.debug-actions button { padding: 5px 8px; color: #526477; background: #fff; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; font: inherit; font-size: 10px; }
.debug-actions button:hover { color: #0958d9; border-color: #7aa2df; }
.debug-actions button:last-child { padding: 1px 6px 4px; border: 0; font-size: 20px; }
.debug-drawer-body { min-height: 0; padding: 16px; overflow: auto; }
.debug-tabs { display: flex; gap: 4px; margin-bottom: 14px; border-bottom: 1px solid #e3eaf3; }
.debug-tabs button { padding: 8px 10px; color: #7b8798; background: transparent; border: 0; border-bottom: 2px solid transparent; cursor: pointer; font: inherit; font-size: 11px; }
.debug-tabs button.active { color: #0958d9; border-bottom-color: #0958d9; }

.debug-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 16px;
}

.debug-summary div { padding: 9px; background: #f5f8fc; border: 1px solid #e3eaf3; border-radius: 5px; }
.debug-summary span, .debug-summary strong { display: block; }
.debug-summary span { color: #7b8798; font-size: 10px; text-transform: uppercase; }
.debug-summary strong { margin-top: 4px; color: #1f2d3d; font-size: 14px; }
.debug-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.debug-tag { padding: 3px 7px; color: #526477; background: #f0f5ff; border: 1px solid #c6d8f5; border-radius: 4px; font-size: 10px; }
.debug-json { max-height: calc(100vh - 250px); margin: 0; padding: 12px; overflow: auto; color: #36465b; background: #f7f9fc; border: 1px solid #e3eaf3; border-radius: 5px; font-size: 11px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.debug-empty { color: #8490a0; font-size: 12px; }
.debug-fade-enter-active, .debug-fade-leave-active { transition: opacity 140ms ease, transform 140ms ease; }
.debug-fade-enter-from, .debug-fade-leave-to { opacity: 0; transform: translateX(12px); }

@media (max-width: 520px) {
  .debug-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
