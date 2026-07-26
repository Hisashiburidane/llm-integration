<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Aura, Enchant } from '@enchantforge/vue';
import DashboardPanel from './components/DashboardPanel.vue';
import { createDashboardCapabilities, createPanelCapabilities, dashboardContext } from './runtime/dashboard-capabilities';
import { dashboardMetadata, panelMetadata } from './runtime/dashboard-metadata';
import { dashboardRuntimes } from './runtime/dashboard-registry';
import type { DashboardFilterDefinition } from './runtime/dashboard-runtime';

const props = defineProps<{ dashboardId: keyof typeof dashboardRuntimes }>();
const runtime = dashboardRuntimes[props.dashboardId];
const state = runtime.state;
const contextOpen = ref(false);
const selectedPanelId = ref('');
const panels = computed(() => state.config.panels);
const activePanel = computed(() => panels.value.find((panel) => panel.id === selectedPanelId.value));
const rootMetadata = computed(() => dashboardMetadata(state.config, state.evidenceGroups));
const capabilities = createDashboardCapabilities(runtime);

watch(() => state.filters, () => { if (state.config.panels.length) void runtime.refreshData(); }, { deep: true });
onMounted(() => { void runtime.loadConfig(); });

function selectPanel(id: string) { selectedPanelId.value = id; }
function clearSelection() { selectedPanelId.value = ''; }
function stringify(value: unknown) { return JSON.stringify(value, null, 2) ?? ''; }
function optionsFor(definition: DashboardFilterDefinition) {
  if (definition.options) return definition.options;
  const facet = definition.facetKey ? state.facets[definition.facetKey] : undefined;
  return Array.isArray(facet) ? facet.map((item) => typeof item === 'string' ? { value: item, label: item } : { value: item.code, label: item.label }) : [];
}
function isDateFilter(definition: DashboardFilterDefinition) { return definition.type === 'date' || (Array.isArray(definition.defaultValue) && typeof definition.defaultValue[0] === 'string'); }
function isRangeFilter(definition: DashboardFilterDefinition) { return definition.type === 'range' || (Array.isArray(definition.defaultValue) && typeof definition.defaultValue[0] === 'number'); }
function rangeValue(definition: DashboardFilterDefinition) { const value = state.filters[definition.id]; return Array.isArray(value) ? value as number[] : [definition.min ?? 0, definition.max ?? 100]; }
function filterValue(id: string) { return (state.filters as Record<string, unknown>)[id]; }
function filterLabel(definition: DashboardFilterDefinition) {
  return definition.label ?? state.dataset.dimensions.find((dimension) => dimension.id === definition.dimensionId)?.label ?? definition.id;
}
function metricLabels(panel: { query: { metrics: Array<{ metricId: string }> } }) {
  return panel.query.metrics.map((metric) => state.dataset.metrics.find((definition) => definition.id === metric.metricId)?.label ?? metric.metricId).join(', ');
}
function dimensionLabels(panel: { query: { dimensions: Array<{ dimensionId: string }> } }) {
  return panel.query.dimensions.map((dimension) => state.dataset.dimensions.find((definition) => definition.id === dimension.dimensionId)?.label ?? dimension.dimensionId).join(', ') || '-';
}
function dateValue(id: string, index: number) { const value = filterValue(id); return Array.isArray(value) ? String(value[index] ?? '') : ''; }
function setDateValue(definition: DashboardFilterDefinition, index: number, event: Event) { const current = Array.isArray(state.filters[definition.id]) ? [...state.filters[definition.id] as string[]] : ['', '']; current[index] = (event.target as HTMLInputElement).value; runtime.setFilter(definition.id, current); }
function setRangeValue(definition: DashboardFilterDefinition, event: Event) { const value = Number((event.target as HTMLInputElement).value); const current = rangeValue(definition); const index = Number((event.target as HTMLInputElement).dataset.index ?? 0); current[index] = value; runtime.setFilter(definition.id, current); }
function setSelectValue(definition: DashboardFilterDefinition, event: Event) { runtime.setFilter(definition.id, (event.target as HTMLSelectElement).value); }
function clearHighlight() { runtime.highlightPanels([]); }
</script>

<template>
  <div class="configurable-dashboard">
    <header class="topbar"><div class="brand-lockup"><span class="brand-mark">EF / DB</span><div><strong>{{ state.config.title }}</strong><span>Configurable Dashboard Runtime</span></div></div><div class="topbar-actions"><a-tag color="blue">{{ panels.length }} panels</a-tag><a-button size="small" @click="clearHighlight">清除高亮</a-button><a-button size="small" @click="contextOpen = true">上下文</a-button></div></header>
    <main class="dashboard-main">
      <section class="dashboard-heading"><div><p class="eyebrow">{{ state.config.topicId.toUpperCase() }} / CONFIGURATION-DRIVEN</p><h1>{{ state.config.title }}</h1><p class="heading-copy">{{ state.config.description }}</p></div></section>
      <section v-if="state.filterDefinitions.length" class="filter-bar" aria-label="Dashboard filters">
        <template v-for="definition in state.filterDefinitions" :key="definition.id">
          <label v-if="isDateFilter(definition)" class="date-filter"><span>{{ filterLabel(definition) }}</span><input type="date" :value="dateValue(definition.id, 0)" @change="(event) => setDateValue(definition, 0, event)" /><input type="date" :value="dateValue(definition.id, 1)" @change="(event) => setDateValue(definition, 1, event)" /></label>
          <div v-else-if="isRangeFilter(definition)" class="filter-item"><span>{{ filterLabel(definition) }}</span><input v-for="index in [0, 1]" :key="index" type="number" :data-index="index" :min="definition.min" :max="definition.max" :value="rangeValue(definition)[index]" @change="(event) => setRangeValue(definition, event)" /></div>
          <label v-else class="filter-item"><span>{{ filterLabel(definition) }}</span><select :value="filterValue(definition.id)" @change="(event) => setSelectValue(definition, event)"><option v-if="definition.allValue !== undefined" :value="definition.allValue">全部</option><option v-for="option in optionsFor(definition)" :key="String(option.value)" :value="option.value">{{ option.label }}</option></select></label>
        </template>
        <div class="filter-summary"><strong>{{ panels.length }}</strong><span>configured panels</span></div>
      </section>
      <a-alert v-if="state.dataError" type="error" show-icon :message="state.dataError" class="data-alert" />
      <Enchant :name="state.config.id" :page="state.config.id" :metadata="rootMetadata" :capabilities="capabilities" :prompt="state.assistantPrompt"><section class="dashboard-grid"><Enchant v-for="panel in panels" :key="panel.id" :name="panel.id" :page="state.config.id" kind="panel" :metadata="panelMetadata(panel)" :capabilities="createPanelCapabilities(runtime, panel.id)"><DashboardPanel :panel="panel" :dataset="state.dataset" :result="runtime.resultForPanel(panel)" :highlighted="state.highlightedPanelIds.includes(panel.id)" :lowlight="state.highlightedPanelIds.length > 0 && !state.highlightedPanelIds.includes(panel.id)" :selected="selectedPanelId === panel.id" :style="{ gridColumn: `span ${panel.layout.width}`, minHeight: `${panel.layout.minHeight}px` }" @select="selectPanel(panel.id)" /></Enchant></section></Enchant>
      <section class="dashboard-footer"><div><span class="footer-label">LAST ACTION</span><strong>{{ state.lastAction }}</strong></div><div><span class="footer-label">SOURCE</span><strong>{{ state.dataset.sourceLabel }}</strong></div></section>
    </main>
    <a-drawer :open="Boolean(activePanel)" :title="activePanel?.title" width="min(520px, 94vw)" @close="clearSelection"><template v-if="activePanel"><a-descriptions :column="1" size="small" bordered><a-descriptions-item label="Panel ID">{{ activePanel.id }}</a-descriptions-item><a-descriptions-item label="指标">{{ metricLabels(activePanel) }}</a-descriptions-item><a-descriptions-item label="维度">{{ dimensionLabels(activePanel) }}</a-descriptions-item></a-descriptions><a-divider /><pre class="json-block">{{ stringify(runtime.queryForPanel(activePanel)) }}</pre></template></a-drawer>
    <a-drawer v-model:open="contextOpen" title="Dashboard Context" width="min(640px, 94vw)"><pre class="json-block">{{ stringify(dashboardContext(runtime)) }}</pre></a-drawer>
    <Aura :page="state.config.id" :title="state.config.title" :prompt="state.assistantPrompt" :suggestions="state.suggestions" />
  </div>
</template>

<style scoped>
.configurable-dashboard { min-height: 100vh; background: #f4f7fb; }
.date-filter { display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 11px; }
.date-filter input, .filter-item select, .filter-item input { height: 28px; padding: 0 8px; border: 1px solid #d8e0ea; border-radius: 5px; color: #334155; background: #fff; font-size: 11px; }
.json-block { padding: 12px; overflow: auto; border: 1px solid #d8e0ea; border-radius: 6px; color: #334155; background: #f8fafc; font: 11px/1.5 'IBM Plex Mono', monospace; white-space: pre-wrap; }
</style>
