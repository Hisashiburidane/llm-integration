<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Aura, Enchant, useEnchantForge, useLlmDebugEvents } from '@enchantforge/vue';
import { ReloadOutlined, SaveOutlined, SettingOutlined } from '@ant-design/icons-vue';
import DashboardPanel from './components/DashboardPanel.vue';
import PanelCatalog from './components/PanelCatalog.vue';
import { dashboardMetadata, panelMetadata } from './runtime/metadata';
import { dashboardCapabilities, panelCapabilities } from './runtime/capabilities';
import {
  dashboardContext,
  dashboardState,
  highlightPanels,
  queryForPanel,
  resetDashboard,
  restoreView,
  resultForPanel,
  saveView,
  selectAirport,
  setGlobalFilter,
  setTimeRange,
  loadDashboardConfig,
  refreshDashboardData,
  savePanelConfig
} from './runtime/dashboard-store';

const forge = useEnchantForge();
const traceEvents = useLlmDebugEvents();
const traceOpen = ref(false);
const contextOpen = ref(false);
const activeView = ref<'dashboard' | 'panels'>('dashboard');
const panelSaveError = ref('');
const panelSaving = ref(false);
const selectedPanelId = computed(() => dashboardState.selectedPanelId);
const activePanel = computed(() => dashboardState.config.panels.find((panel) => panel.id === selectedPanelId.value));
const rootMetadata = computed(() => dashboardMetadata(dashboardState.config));
const panelResults = computed(() => new Map(dashboardState.config.panels.map((panel) => [panel.id, resultForPanel(panel)])));
const filteredEvents = computed(() => traceEvents.value.slice(0, 80));
const savedViews = computed(() => dashboardState.savedViews);
const flightOpsAssistantQuestions = [
  '当前哪个机场的平均延误最高？',
  '比较各航空公司的准点率。',
  '哪些小时的严重延误最多？',
  '当前延误主要由哪些原因构成？',
  '分析 JFK 18:00-21:00 的延误。',
  '比较出港和到港的准点率。',
  '添加航空公司平均延误排名。',
  '保存当前调查视图。'
];
const flightOpsAssistantPrompt = `你是 Flight Ops Assistant，负责协助完成当前航班延误调查。

可直接回答的问题包括：
${flightOpsAssistantQuestions.map((question, index) => `${index + 1}. ${question}`).join('\n')}

还可以询问机场 P95 延误、晚高峰风险和延误原因贡献，并要求高亮相关 Panel。

延误原因字典：NAS 表示国家空域系统/空管流量限制，carrier 表示航空公司运行原因，weather 表示天气原因，security 表示安保流程，none 表示没有记录到可归类原因。

分析规则：数据分析问题不能只调用 dashboard.read_context，因为它只返回页面结构；必须调用 dashboard.read_data 或相关 panel.read_data 读取真实指标。对于“哪个机场平均延误最高”，必须读取 airport-ranking 的数据，并额外调用 dashboard.highlight，panelIds 固定为 ["airport-ranking"]，然后再给出结论；其他问题在用户要求高亮或你需要强调证据时，也必须额外调用 dashboard.highlight 或 panel.highlight，不能只在回答中声称已高亮。只能使用当前数据和已注册能力，不要编造航班、原因或因果关系；如果当前 Panel 不足以回答问题，应明确说明数据缺口。`;
const globalSummary = computed(() => {
  const countPanel = dashboardState.config.panels.find((panel) => panel.id === 'flight-count');
  return countPanel ? resultForPanel(countPanel).summary : { rowCount: 0, source: 'SQLite aviation_flights', query: { datasetId: dashboardState.dataset.id, metrics: [], dimensions: [], filters: [] } };
});

watch(
  [
    () => dashboardState.filters.airport,
    () => dashboardState.filters.carrier,
    () => dashboardState.filters.direction,
    () => dashboardState.filters.timeRange.startHour,
    () => dashboardState.filters.timeRange.endHour
  ],
  () => { void refreshDashboardData(); }
);

onMounted(() => { void loadDashboardConfig(); });

function selectPanel(panelId: string) {
  dashboardState.selectedPanelId = panelId;
}

function clearSelection() {
  dashboardState.selectedPanelId = '';
}

function onSelectAirport(airport: string) {
  selectAirport(airport);
}

function saveCurrentView() {
  saveView();
}

function restoreLatestView() {
  restoreView();
}

function clearTrace() {
  forge.clearTrace();
}

function stringify(value: unknown) {
  return JSON.stringify(value, null, 2) ?? '';
}

function resultFor(id: string) {
  return panelResults.value.get(id);
}

async function savePanel(panel: Parameters<typeof savePanelConfig>[0]) {
  panelSaving.value = true;
  panelSaveError.value = '';
  try {
    await savePanelConfig(panel);
  } catch (error) {
    panelSaveError.value = error instanceof Error ? error.message : 'Panel 保存失败。';
  } finally {
    panelSaving.value = false;
  }
}

</script>

<template>
  <div class="dashboard-app">
    <header class="topbar">
      <div class="brand-lockup">
        <span class="brand-mark">EF / OPS</span>
        <div>
          <strong>Flight Operations</strong>
          <span>EnchantForge Dashboard Example</span>
        </div>
      </div>
      <div class="topbar-actions">
        <a-tag color="blue">{{ dashboardState.config.panels.length }} panels</a-tag>
        <a-button size="small" @click="activeView = activeView === 'dashboard' ? 'panels' : 'dashboard'">{{ activeView === 'dashboard' ? 'Panel Library' : 'Dashboard' }}</a-button>
        <a-button size="small" @click="contextOpen = true"><SettingOutlined />上下文</a-button>
        <a-button size="small" @click="traceOpen = true">Trace ({{ filteredEvents.length }})</a-button>
      </div>
    </header>

    <main class="dashboard-main">
      <PanelCatalog
        v-if="activeView === 'panels'"
        :panels="dashboardState.panelLibrary"
        :dataset="dashboardState.dataset"
        :saving="panelSaving"
        :error="panelSaveError"
        @save="savePanel"
      />

      <template v-else>
      <section class="dashboard-heading">
        <div>
          <p class="eyebrow">AVIATION / ON-TIME PERFORMANCE</p>
          <h1>Delay investigation workspace</h1>
          <p class="heading-copy">用结构化 QuerySpec 连接当前筛选、Panel 语义和受约束的页面能力。Panel 配置和查询结果由 Node 开发服务从 SQLite 提供。</p>
        </div>
        <div class="heading-actions">
          <a-button size="small" @click="saveCurrentView"><SaveOutlined />保存视图</a-button>
          <a-button size="small" :disabled="!savedViews.length" @click="restoreLatestView"><ReloadOutlined />恢复视图</a-button>
          <a-button size="small" danger @click="resetDashboard">重置</a-button>
        </div>
      </section>

      <section class="filter-bar" aria-label="全局筛选">
        <div class="filter-item"><span>机场</span><a-select :value="dashboardState.filters.airport" size="small" @change="(value: string) => setGlobalFilter('airport', value)"><a-select-option value="ALL">全部</a-select-option><a-select-option v-for="airport in dashboardState.airports" :key="airport.code" :value="airport.code">{{ airport.label }} ({{ airport.code }})</a-select-option></a-select></div>
        <div class="filter-item"><span>航空公司</span><a-select :value="dashboardState.filters.carrier" size="small" @change="(value: string) => setGlobalFilter('carrier', value)"><a-select-option value="ALL">全部</a-select-option><a-select-option v-for="carrier in dashboardState.carriers" :key="carrier" :value="carrier">{{ carrier }}</a-select-option></a-select></div>
        <div class="filter-item"><span>方向</span><a-segmented v-model:value="dashboardState.filters.direction" :options="[{ label: '出港', value: 'departure' }, { label: '到港', value: 'arrival' }]" @change="(value: string) => setGlobalFilter('direction', value)" /></div>
        <div class="filter-item time-filter"><span>小时 {{ dashboardState.filters.timeRange.startHour }}:00 - {{ dashboardState.filters.timeRange.endHour }}:00</span><a-slider :value="[dashboardState.filters.timeRange.startHour, dashboardState.filters.timeRange.endHour]" range :min="0" :max="23" :tooltip-open="false" @change="(value: number[]) => setTimeRange(value[0] ?? 0, value[1] ?? 23)" /></div>
        <div class="filter-summary"><strong>{{ globalSummary.rowCount }}</strong><span>records in query scope</span></div>
      </section>

      <a-alert v-if="dashboardState.dataError" type="error" show-icon :message="dashboardState.dataError" class="data-alert" />

      <Enchant name="aviation-dashboard" page="aviation-dashboard" :metadata="rootMetadata" :capabilities="dashboardCapabilities" :prompt="flightOpsAssistantPrompt">
        <section class="dashboard-grid">
          <Enchant
            v-for="panel in dashboardState.config.panels"
            :key="panel.id"
            :name="panel.id"
            page="aviation-dashboard"
            kind="panel"
            :metadata="panelMetadata(panel)"
            :capabilities="panelCapabilities(panel.id)"
          >
            <DashboardPanel
              :panel="panel"
              :result="resultFor(panel.id)!"
              :highlighted="dashboardState.highlightedPanelIds.includes(panel.id)"
              :lowlight="dashboardState.highlightedPanelIds.length > 0 && !dashboardState.highlightedPanelIds.includes(panel.id)"
              :selected="selectedPanelId === panel.id"
              :style="{ gridColumn: `span ${panel.layout.width}`, minHeight: `${panel.layout.minHeight}px` }"
              @select="selectPanel(panel.id)"
              @select-airport="onSelectAirport"
            />
          </Enchant>
        </section>
      </Enchant>

      <section class="dashboard-footer">
        <div>
          <span class="footer-label">LAST ACTION</span>
          <strong>{{ dashboardState.lastAction }}</strong>
        </div>
        <div>
          <span class="footer-label">SOURCE</span>
          <strong>{{ dashboardState.sourceManifest.license }}</strong>
        </div>
      </section>
      </template>
    </main>

    <a-drawer :open="Boolean(activePanel)" :title="activePanel?.title" width="min(520px, 94vw)" @close="clearSelection">
      <template v-if="activePanel">
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item label="Panel ID">{{ activePanel.id }}</a-descriptions-item>
          <a-descriptions-item label="Type">{{ activePanel.type }}</a-descriptions-item>
          <a-descriptions-item label="Metric">{{ activePanel.query.metrics.map((metric) => metric.metricId).join(', ') }}</a-descriptions-item>
          <a-descriptions-item label="Dimension">{{ activePanel.query.dimensions.map((dimension) => dimension.dimensionId).join(', ') || '-' }}</a-descriptions-item>
        </a-descriptions>
        <a-divider />
        <h3>Current QuerySpec</h3>
        <pre class="json-block">{{ stringify(queryForPanel(activePanel)) }}</pre>
      </template>
    </a-drawer>

    <a-drawer v-model:open="contextOpen" title="Dashboard Context" width="min(640px, 94vw)">
      <pre class="json-block">{{ stringify(dashboardContext()) }}</pre>
    </a-drawer>

    <a-drawer v-model:open="traceOpen" title="Runtime Trace" width="min(760px, 94vw)">
      <div class="trace-actions"><a-button size="small" @click="clearTrace">清空 trace</a-button></div>
      <a-empty v-if="!filteredEvents.length" description="当前没有运行事件" />
      <a-collapse v-else>
        <a-collapse-panel v-for="event in filteredEvents" :key="event.id" :header="`${event.title} / ${event.kind}`">
          <pre class="json-block">{{ stringify(event) }}</pre>
        </a-collapse-panel>
      </a-collapse>
    </a-drawer>

    <Aura page="aviation-dashboard" title="Flight Ops Assistant" :prompt="flightOpsAssistantPrompt" :suggestions="flightOpsAssistantQuestions" />
  </div>
</template>

<style>
:root { color: #1e293b; background: #f4f7fb; font-family: "IBM Plex Sans", "Segoe UI", sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; }
button, input, textarea, select { font: inherit; }
.dashboard-app { min-height: 100vh; background: #f4f7fb; }
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
.filter-item :deep(.ant-select) { min-width: 100px; }
.time-filter { flex: 1 1 260px; min-width: 240px; }
.time-filter :deep(.ant-slider) { flex: 1; min-width: 140px; margin: 7px 4px; }
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
.trace-actions { justify-content: flex-end; margin-bottom: 12px; }
@media (max-width: 980px) { .dashboard-main { padding: 22px 18px; } .dashboard-heading { align-items: flex-start; flex-direction: column; } .dashboard-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .dashboard-grid > .llm-scope > .dashboard-panel { grid-column: span 1 !important; } }
@media (max-width: 620px) { .topbar { align-items: flex-start; flex-direction: column; padding: 14px 16px; } .topbar-actions { width: 100%; justify-content: flex-end; } .dashboard-grid { grid-template-columns: 1fr; } .dashboard-grid > .llm-scope > .dashboard-panel { grid-column: span 1 !important; } .filter-summary { margin-left: 0; } .dashboard-footer { align-items: flex-start; flex-direction: column; } }
</style>
