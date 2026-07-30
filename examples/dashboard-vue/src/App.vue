<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Enchant, useEnchantForge, type EnchantMetadataNode } from '@enchantforge/vue';
import ConfigurableDashboard from './ConfigurableDashboard.vue';
import DashboardPet from './components/DashboardPet.vue';
import GlobalDashboardLibrary from './components/GlobalDashboardLibrary.vue';
import GlobalPanelLibrary from './components/GlobalPanelLibrary.vue';
import PlatformMenu from './components/PlatformMenu.vue';

type View = 'panels' | 'dashboards' | `dashboard/${string}`;
const forge = useEnchantForge();
const view = ref<View>(readView());
const activeDashboardId = computed(() => {
  if (view.value.startsWith('dashboard/')) return decodeURIComponent(view.value.slice('dashboard/'.length));
  return undefined;
});
const pageId = computed(() => {
  if (view.value === 'panels') return 'panel-library';
  if (view.value === 'dashboards') return 'dashboard-library';
  return activeDashboardId.value ?? 'dashboard';
});
const routeId = computed(() => `#${view.value}`);
const pageMetadata = computed<EnchantMetadataNode[]>(() => {
  const page = {
    'panel-library': {
      label: 'Panel Library',
      description: '浏览、预览和管理可复用的 Panel 定义'
    },
    'dashboard-library': {
      label: 'Dashboard Library',
      description: '浏览和管理 Dashboard，并使用已有 Panel 组合新的 Dashboard'
    }
  }[pageId.value] ?? {
    label: `Dashboard ${pageId.value}`,
    description: '查看 Dashboard、筛选数据并分析 Panel'
  };
  return [{
    id: `${pageId.value}:view`,
    scopeId: pageId.value,
    kind: 'region',
    label: page.label,
    description: page.description,
    visible: true,
    enabled: true,
    source: 'registered',
    children: []
  }];
});
const menuView = computed<'panels' | 'dashboards'>(() => {
  return view.value === 'panels' ? 'panels' : 'dashboards';
});

function readView(): View {
  const hash = window.location.hash.slice(1);
  if (hash === 'panels') return 'panels';
  if (hash.startsWith('dashboard/') && hash.length > 'dashboard/'.length) return hash as `dashboard/${string}`;
  return 'dashboards';
}

function syncView() {
  view.value = readView();
}

watch([pageId, routeId], ([page, route]) => {
  forge.syncNavigation({ app: 'dashboard-vue', page, route });
}, { immediate: true });

onMounted(() => window.addEventListener('hashchange', syncView));
onBeforeUnmount(() => window.removeEventListener('hashchange', syncView));
</script>

<template>
  <PlatformMenu :active="menuView" />
  <Enchant
    :key="pageId"
    class="app-view-scope"
    :name="`${pageId}-view`"
    :page="pageId"
    kind="page"
    :metadata="pageMetadata"
  >
    <GlobalPanelLibrary v-if="view === 'panels'" />
    <ConfigurableDashboard v-else-if="activeDashboardId" :key="activeDashboardId" :dashboard-id="activeDashboardId" />
    <GlobalDashboardLibrary v-else />
  </Enchant>
  <DashboardPet :page="pageId" :route="routeId" />
</template>

<style>
:root { color: #1e293b; background: #f4f7fb; font-family: "IBM Plex Sans", "Segoe UI", sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; }
.app-view-scope { display: contents; }
button, input, textarea, select { font: inherit; }
.topbar { display: flex; min-height: 62px; align-items: center; justify-content: space-between; gap: 24px; padding: 0 30px; color: #e5edf8; background: #15263e; }
.brand-lockup, .topbar-actions, .heading-actions, .filter-bar, .filter-item, .dashboard-footer, .trace-actions { display: flex; align-items: center; }
.brand-lockup { gap: 12px; }
.brand-lockup strong, .brand-lockup span { display: block; }
.brand-lockup strong { color: #fff; font-size: 14px; }
.brand-lockup span:last-child { margin-top: 3px; color: #9fb0c8; font: 10px/1.2 "IBM Plex Mono", monospace; }
.brand-mark { padding: 7px 8px; border: 1px solid #4b82c7; border-radius: 4px; color: #9cc6ff !important; font: 700 10px/1 "IBM Plex Mono", monospace !important; letter-spacing: .08em; }
.topbar-actions { gap: 8px; }
.dashboard-main { width: min(1540px, 100%); margin: 0 auto; padding: 30px; }
.dashboard-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 22px; }
.eyebrow, .footer-label { margin: 0; color: #3b82f6; font: 700 10px/1.2 "IBM Plex Mono", monospace; letter-spacing: .12em; }
.dashboard-heading h1 { margin: 7px 0 8px; color: #14233a; font-size: clamp(24px, 3vw, 36px); letter-spacing: -.03em; }
.heading-copy { max-width: 760px; margin: 0; color: #64748b; font-size: 12px; line-height: 1.7; }
.heading-actions { flex: 0 0 auto; gap: 8px; }
.filter-bar { flex-wrap: wrap; gap: 16px; padding: 14px 16px; margin-bottom: 18px; border: 1px solid #d8e0ea; border-radius: 8px; background: #fff; }
.filter-item { gap: 8px; color: #64748b; font-size: 11px; }
.filter-item > span { white-space: nowrap; }
.filter-summary { margin-left: auto; text-align: right; }
.filter-summary strong, .filter-summary span { display: block; }
.filter-summary strong { color: #0f3d75; font: 600 18px/1 "IBM Plex Mono", monospace; }
.filter-summary span { margin-top: 4px; color: #94a3b8; font: 9px/1 "IBM Plex Mono", monospace; }
.data-alert { margin-bottom: 18px; }
.dashboard-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 14px; align-items: stretch; }
.dashboard-grid > .llm-scope { display: contents; }
.dashboard-grid > .llm-scope > .dashboard-panel { min-width: 0; }
.dashboard-footer { justify-content: space-between; gap: 24px; padding: 18px 2px 0; color: #64748b; font-size: 11px; }
.dashboard-footer > div { min-width: 0; }
.dashboard-footer strong { display: block; max-width: 620px; margin-top: 5px; overflow: hidden; color: #475569; font: 10px/1.4 "IBM Plex Mono", monospace; text-overflow: ellipsis; white-space: nowrap; }
.json-block { max-height: 520px; margin: 0; padding: 12px; overflow: auto; color: #334155; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font: 11px/1.6 "IBM Plex Mono", monospace; white-space: pre-wrap; word-break: break-word; }
@media (max-width: 980px) { .dashboard-main { padding: 22px 18px; } .dashboard-heading { align-items: flex-start; flex-direction: column; } .dashboard-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .dashboard-grid > .llm-scope > .dashboard-panel { grid-column: span 1 !important; } }
@media (max-width: 620px) { .topbar { align-items: flex-start; flex-direction: column; padding: 14px 16px; } .topbar-actions { width: 100%; justify-content: flex-end; } .dashboard-grid { grid-template-columns: 1fr; } .dashboard-grid > .llm-scope > .dashboard-panel { grid-column: span 1 !important; } .filter-summary { margin-left: 0; } .dashboard-footer { align-items: flex-start; flex-direction: column; } }
</style>
