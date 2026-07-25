<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Aura, Enchant } from '@enchantforge/vue';
import DashboardPanel from './components/DashboardPanel.vue';
import { airQualityCapabilities, airQualityPanelCapabilities } from './runtime/air-quality-capabilities';
import { airQualityDashboardMetadata, airQualityPanelMetadata } from './runtime/air-quality-metadata';
import {
  airQualityDashboardContext,
  airQualityState,
  highlightAirQualityPanels,
  loadAirQualityConfig,
  queryForAirPanel,
  refreshAirQualityData,
  resultForAirPanel,
  setAirQualityFilters
} from './runtime/air-quality-store';

const selectedPanelId = ref('');
const contextOpen = ref(false);
const panels = computed(() => airQualityState.config.panels);
const rootMetadata = computed(() => airQualityDashboardMetadata(airQualityState.config));
const globalSummary = computed(() => {
  const panel = panels.value.find((item) => item.id === 'aq-observation-count');
  return panel ? resultForAirPanel(panel).summary : { rowCount: 0, source: 'SQLite air_quality_dashboard_rollup', query: queryForAirPanel(panel ?? { id: 'empty', type: 'metric', title: '', description: '', query: { datasetId: airQualityState.dataset.id, metrics: [{ metricId: 'observationCount' }], dimensions: [], filters: [] }, layout: { width: 1, minHeight: 1 } }) };
});
const activePanel = computed(() => panels.value.find((panel) => panel.id === selectedPanelId.value));

watch(
  [() => airQualityState.filters.startDate, () => airQualityState.filters.endDate, () => airQualityState.filters.station],
  () => { if (airQualityState.config.panels.length) void refreshAirQualityData(); }
);

onMounted(() => { void loadAirQualityConfig(); });

function selectPanel(panelId: string) {
  selectedPanelId.value = panelId;
}

function clearSelection() {
  selectedPanelId.value = '';
}

function stringify(value: unknown) {
  return JSON.stringify(value, null, 2) ?? '';
}

function applyDateRange(event: Event, field: 'startDate' | 'endDate') {
  const value = (event.target as HTMLInputElement).value;
  setAirQualityFilters({ [field]: value });
}

function applyStation(value: string) {
  setAirQualityFilters({ station: value });
}

function clearHighlight() {
  highlightAirQualityPanels([]);
}

function openFlightOperations() {
  window.location.hash = '';
}
</script>

<template>
  <div class="air-quality-app">
    <header class="topbar">
      <div class="brand-lockup">
        <span class="brand-mark">EF / AQ</span>
        <div><strong>Air Quality Monitoring</strong><span>EnchantForge Dashboard Example</span></div>
      </div>
      <div class="topbar-actions">
        <a-tag color="blue">{{ panels.length }} panels</a-tag>
        <a-button size="small" @click="openFlightOperations">Flight Operations</a-button>
        <a-button size="small" @click="contextOpen = true">上下文</a-button>
      </div>
    </header>

    <main class="dashboard-main">
      <section class="dashboard-heading">
        <div>
          <p class="eyebrow">AIR QUALITY / BEIJING MULTI-SITE</p>
          <h1>Pollution monitoring workspace</h1>
          <p class="heading-copy">读取 UCI 北京多站点小时观测，使用预处理后的日期 × 监测站统计表回答污染物趋势、站点比较和气象背景问题。</p>
        </div>
        <div class="heading-actions"><a-button size="small" @click="clearHighlight">清除高亮</a-button></div>
      </section>

      <section class="filter-bar" aria-label="空气质量筛选">
        <label class="date-filter"><span>开始日期</span><input type="date" :value="airQualityState.filters.startDate" @change="(event) => applyDateRange(event, 'startDate')" /></label>
        <label class="date-filter"><span>结束日期</span><input type="date" :value="airQualityState.filters.endDate" @change="(event) => applyDateRange(event, 'endDate')" /></label>
        <label class="filter-item"><span>监测站</span><select :value="airQualityState.filters.station" @change="(event) => applyStation((event.target as HTMLSelectElement).value)"><option value="ALL">全部监测站</option><option v-for="station in airQualityState.stations" :key="station.code" :value="station.code">{{ station.label }}</option></select></label>
        <div class="filter-summary"><strong>{{ globalSummary.rowCount }}</strong><span>rows in query scope</span></div>
      </section>

      <a-alert v-if="airQualityState.dataError" type="error" show-icon :message="airQualityState.dataError" class="data-alert" />

      <Enchant name="air-quality-dashboard" page="air-quality-dashboard" :metadata="rootMetadata" :capabilities="airQualityCapabilities">
        <section class="dashboard-grid">
          <Enchant v-for="panel in panels" :key="panel.id" :name="panel.id" page="air-quality-dashboard" kind="panel" :metadata="airQualityPanelMetadata(panel)" :capabilities="airQualityPanelCapabilities(panel.id)">
            <DashboardPanel :panel="panel" :result="resultForAirPanel(panel)" :highlighted="airQualityState.highlightedPanelIds.includes(panel.id)" :lowlight="airQualityState.highlightedPanelIds.length > 0 && !airQualityState.highlightedPanelIds.includes(panel.id)" :selected="selectedPanelId === panel.id" :style="{ gridColumn: `span ${panel.layout.width}`, minHeight: `${panel.layout.minHeight}px` }" @select="selectPanel(panel.id)" />
          </Enchant>
        </section>
      </Enchant>

      <section class="dashboard-footer"><div><span class="footer-label">LAST ACTION</span><strong>{{ airQualityState.lastAction }}</strong></div><div><span class="footer-label">SOURCE</span><strong>{{ airQualityState.dataset.sourceLabel }}</strong></div></section>
    </main>

    <a-drawer :open="Boolean(activePanel)" :title="activePanel?.title" width="min(520px, 94vw)" @close="clearSelection">
      <template v-if="activePanel"><a-descriptions :column="1" size="small" bordered><a-descriptions-item label="Panel ID">{{ activePanel.id }}</a-descriptions-item><a-descriptions-item label="指标">{{ activePanel.query.metrics.map((metric) => metric.metricId).join(', ') }}</a-descriptions-item><a-descriptions-item label="维度">{{ activePanel.query.dimensions.map((dimension) => dimension.dimensionId).join(', ') || '-' }}</a-descriptions-item></a-descriptions><a-divider /><pre class="json-block">{{ stringify(queryForAirPanel(activePanel)) }}</pre></template>
    </a-drawer>
    <a-drawer v-model:open="contextOpen" title="Air Quality Context" width="min(640px, 94vw)"><pre class="json-block">{{ stringify(airQualityDashboardContext()) }}</pre></a-drawer>
    <Aura page="air-quality-dashboard" title="Air Quality Assistant" :prompt="`你是 Air Quality Assistant，负责分析当前北京空气质量 Dashboard。回答问题前必须调用 dashboard.read_data 读取真实聚合结果；涉及站点比较时使用 aq-station-ranking，涉及趋势时使用 aq-pm25-trend，涉及污染物横向比较时使用 aq-pollutant-profile。需要强调证据时调用 dashboard.highlight，不能只在文字中声称已高亮。不要把监测站英文代码当作结论，必须同时说明监测站名称和指标单位。当前可询问：哪个监测站 PM2.5 最高？PM2.5 在当前日期范围如何变化？主要污染物的平均浓度如何比较？降雨和温度是否提供了气象背景？`" :suggestions="['哪个监测站的 PM2.5 最高？', 'PM2.5 在当前日期范围如何变化？', '比较主要污染物的平均浓度。', '查看温度和降雨背景。']" />
  </div>
</template>

<style scoped>
.air-quality-app { min-height: 100vh; background: #f4f7fb; }
.date-filter { display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 11px; }
.date-filter input, .filter-item select { height: 28px; padding: 0 8px; border: 1px solid #d8e0ea; border-radius: 5px; color: #334155; background: #fff; font-size: 11px; }
.json-block { padding: 12px; overflow: auto; border: 1px solid #d8e0ea; border-radius: 6px; color: #334155; background: #f8fafc; font: 11px/1.5 'IBM Plex Mono', monospace; white-space: pre-wrap; }
</style>
