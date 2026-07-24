<script setup lang="ts">
import { computed, ref } from 'vue';
import { BugOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import { Badge, Button, Drawer, Space, Tag, Tabs, TabPane } from 'ant-design-vue';
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
      <BugOutlined />
      <span>Debug</span>
      <Badge :count="events.length" :overflow-count="99" />
    </button>

    <Drawer v-model:open="open" :title="forge.debug.title" width="min(560px, 94vw)" placement="right">
      <template #extra>
        <Space>
          <Button size="small" :icon="ReloadOutlined" @click="refreshSnapshot">刷新</Button>
          <Button size="small" @click="clearEvents">清空 trace</Button>
        </Space>
      </template>

      <div class="debug-summary">
        <div><span>page</span><strong>{{ digest.pageId }}</strong></div>
        <div><span>version</span><strong>{{ digest.version }}</strong></div>
        <div><span>enchantments</span><strong>{{ digest.activeEnchantments }}</strong></div>
        <div><span>tools</span><strong>{{ digest.capturedCapabilities }}</strong></div>
      </div>

      <Tabs v-model:active-key="activeTab" size="small">
        <TabPane key="overview" tab="Overview">
          <div class="debug-tags">
            <Tag color="blue">mode: {{ forge.policy.mode }}</Tag>
            <Tag color="cyan">route: {{ forge.navigation.route || '-' }}</Tag>
            <Tag color="green">exporters: {{ forge.exporters.length }}</Tag>
          </div>
          <pre class="debug-json">{{ stringify({ navigation: forge.navigation, policy: forge.policy, exporters: forge.exporters }) }}</pre>
        </TabPane>
        <TabPane key="snapshot" tab="Snapshot">
          <p v-if="!snapshot" class="debug-empty">暂无 snapshot。点击“刷新”捕获当前页面。</p>
          <pre v-else class="debug-json">{{ stringify(snapshot) }}</pre>
        </TabPane>
        <TabPane key="trace" :tab="`Trace (${events.length})`">
          <p v-if="!events.length" class="debug-empty">暂无 trace。</p>
          <pre v-else class="debug-json">{{ stringify(events) }}</pre>
        </TabPane>
      </Tabs>
    </Drawer>
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
.enchant-debug-trigger :deep(.ant-badge-count) { position: static; transform: none; }

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
.debug-json { max-height: calc(100vh - 250px); margin: 0; padding: 12px; overflow: auto; color: #36465b; background: #f7f9fc; border: 1px solid #e3eaf3; border-radius: 5px; font-size: 11px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.debug-empty { color: #8490a0; font-size: 12px; }

@media (max-width: 520px) {
  .debug-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
