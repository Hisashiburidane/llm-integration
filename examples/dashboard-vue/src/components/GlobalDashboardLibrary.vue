<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Enchant } from '@enchantforge/vue';
import TextToFormBuilder from './TextToFormBuilder.vue';
import { fetchDataDomains } from '../query/domains';
import type { PanelConfig } from '../model/types';
import type { DataDomain } from '../query/domains';

interface DashboardPlacement {
  panelId: string;
  sortOrder: number;
  width: number;
  minHeight: number;
}

interface DashboardEntry {
  id: string;
  topicId: string;
  title: string;
  description: string;
  baseDashboardId: string;
  placements: DashboardPlacement[];
}

interface DashboardDraft extends Record<string, unknown> {
  id: string;
  title: string;
  description: string;
  baseDashboardId: string;
  placements: DashboardPlacement[];
}

const dashboards = ref<DashboardEntry[]>([]);
const domains = ref<DataDomain[]>([]);
const panels = ref<PanelConfig[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const formError = ref('');
const search = ref('');
const panelSearch = ref('');
const editorOpen = ref(false);
const editing = ref(false);
const draft = ref<DashboardDraft>(emptyDraft());

const filteredDashboards = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  if (!keyword) return dashboards.value;
  return dashboards.value.filter((dashboard) => [
    dashboard.id,
    dashboard.title,
    dashboard.description,
    dashboard.topicId
  ].join(' ').toLowerCase().includes(keyword));
});
const selectedDomain = computed(() => domains.value.find((domain) => domain.id === draft.value.baseDashboardId));
const compatiblePanels = computed(() => {
  const datasetIds = new Set(selectedDomain.value?.datasetIds ?? []);
  const keyword = panelSearch.value.trim().toLowerCase();
  return panels.value.filter((panel) => {
    if (!datasetIds.has(panel.query.datasetId)) return false;
    return !keyword || [
      panel.id,
      panel.title,
      panel.description,
      ...panel.query.metrics.map((metric) => metric.metricId),
      ...panel.query.dimensions.map((dimension) => dimension.dimensionId)
    ].join(' ').toLowerCase().includes(keyword);
  });
});
const selectedPanelIds = computed(() => new Set(draft.value.placements.map((placement) => placement.panelId)));
const panelMap = computed(() => new Map(panels.value.map((panel) => [panel.id, panel])));
const builderModel = computed<Record<string, unknown>>(() => ({
  id: draft.value.id,
  title: draft.value.title,
  description: draft.value.description,
  panelIds: draft.value.placements.map((placement) => placement.panelId)
}));
const builderPrompt = computed(() => [
  '根据用户需求填写 Dashboard 草稿，不要保存。',
  `当前数据域：${selectedDomain.value?.title ?? '未选择'}。`,
  'panelIds 必须是下列 Panel ID 组成的 JSON 数组，只选择与问题相关的 Panel。',
  compatiblePanels.value.map((panel) => `${panel.id}: ${panel.title}；${panel.description}`).join('\n'),
  'id 使用小写字母、数字和连字符。不要调用保存或删除能力。'
].join('\n\n'));

watch(() => draft.value.baseDashboardId, () => {
  const allowed = new Set(compatiblePanels.value.map((panel) => panel.id));
  draft.value.placements = draft.value.placements.filter((placement) => allowed.has(placement.panelId));
  panelSearch.value = '';
});

function emptyDraft(): DashboardDraft {
  return { id: '', title: '', description: '', baseDashboardId: '', placements: [] };
}

function domainTitle(id: string) {
  return domains.value.find((domain) => domain.id === id)?.title ?? id;
}

function openDashboard(dashboard: DashboardEntry) {
  window.location.hash = `dashboard/${encodeURIComponent(dashboard.id)}`;
}

function openCreate(source?: DashboardEntry) {
  editing.value = false;
  formError.value = '';
  panelSearch.value = '';
  draft.value = source
    ? {
        id: '',
        title: `${source.title} Copy`,
        description: source.description,
        baseDashboardId: source.baseDashboardId,
        placements: source.placements.map((placement) => ({ ...placement }))
      }
    : { ...emptyDraft(), baseDashboardId: domains.value[0]?.id ?? '' };
  editorOpen.value = true;
}

function openEdit(dashboard: DashboardEntry) {
  editing.value = true;
  formError.value = '';
  panelSearch.value = '';
  draft.value = {
    id: dashboard.id,
    title: dashboard.title,
    description: dashboard.description,
    baseDashboardId: dashboard.baseDashboardId,
    placements: dashboard.placements.map((placement) => ({ ...placement }))
  };
  editorOpen.value = true;
}

function addPanel(panel: PanelConfig) {
  if (selectedPanelIds.value.has(panel.id)) return;
  draft.value.placements.push({
    panelId: panel.id,
    sortOrder: draft.value.placements.length,
    width: panel.layout.width,
    minHeight: panel.layout.minHeight
  });
}

function removePanel(panelId: string) {
  draft.value.placements = draft.value.placements.filter((placement) => placement.panelId !== panelId);
}

function movePanel(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= draft.value.placements.length) return;
  const placements = [...draft.value.placements];
  [placements[index], placements[target]] = [placements[target], placements[index]];
  draft.value.placements = placements;
}

function generatedPanelIds(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function applyGeneratedDraft(values: Record<string, unknown>) {
  if (!editing.value && typeof values.id === 'string') draft.value.id = values.id;
  if (typeof values.title === 'string') draft.value.title = values.title;
  if (typeof values.description === 'string') draft.value.description = values.description;
  if (values.panelIds !== undefined) {
    const allowed = new Map(compatiblePanels.value.map((panel) => [panel.id, panel]));
    draft.value.placements = [...new Set(generatedPanelIds(values.panelIds))]
      .flatMap((panelId, index) => {
        const panel = allowed.get(panelId);
        return panel ? [{
          panelId,
          sortOrder: index,
          width: panel.layout.width,
          minHeight: panel.layout.minHeight
        }] : [];
      });
  }
}

async function submit() {
  const value = draft.value;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(value.id)) {
    formError.value = 'Dashboard ID 只能使用小写字母、数字和连字符。';
    return;
  }
  if (!value.title.trim() || !value.description.trim()) {
    formError.value = '标题和描述不能为空。';
    return;
  }
  if (!value.placements.length) {
    formError.value = '至少选择一个 Panel。';
    return;
  }
  if (!editing.value && dashboards.value.some((dashboard) => dashboard.id === value.id)) {
    formError.value = `Dashboard ID 已存在：${value.id}。`;
    return;
  }
  saving.value = true;
  formError.value = '';
  try {
    const response = await fetch('/api/dashboard/dashboards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: value.id,
        title: value.title,
        description: value.description,
        baseDashboardId: value.baseDashboardId,
        placements: value.placements.map(({ panelId, width, minHeight }) => ({ panelId, width, minHeight }))
      })
    });
    const payload = await response.json() as { error?: string };
    if (!response.ok || payload.error) throw new Error(payload.error || `Dashboard 保存失败（${response.status}）。`);
    editorOpen.value = false;
    await load();
  } catch (cause) {
    formError.value = cause instanceof Error ? cause.message : 'Dashboard 保存失败。';
  } finally {
    saving.value = false;
  }
}

async function deleteDashboard(dashboard: DashboardEntry) {
  try {
    const response = await fetch(`/api/dashboard/dashboards/${encodeURIComponent(dashboard.id)}`, { method: 'DELETE' });
    const payload = await response.json() as { error?: string };
    if (!response.ok || payload.error) throw new Error(payload.error || `Dashboard 删除失败（${response.status}）。`);
    await load();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Dashboard 删除失败。';
  }
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [dashboardResponse, panelResponse, domainDefinitions] = await Promise.all([
      fetch('/api/dashboard/dashboards'),
      fetch('/api/dashboard/panels'),
      fetchDataDomains()
    ]);
    const dashboardPayload = await dashboardResponse.json() as { dashboards?: DashboardEntry[]; error?: string };
    const panelPayload = await panelResponse.json() as { panels?: PanelConfig[]; error?: string };
    if (!dashboardResponse.ok || !panelResponse.ok || dashboardPayload.error || panelPayload.error) {
      throw new Error(dashboardPayload.error || panelPayload.error || 'Dashboard Library 加载失败。');
    }
    dashboards.value = dashboardPayload.dashboards ?? [];
    domains.value = domainDefinitions;
    panels.value = panelPayload.panels ?? [];
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Dashboard Library 加载失败。';
  } finally {
    loading.value = false;
  }
}

onMounted(() => { void load(); });
</script>

<template>
  <main class="dashboard-library">
    <header class="library-heading">
      <div><p class="eyebrow">PLATFORM / DASHBOARD LIBRARY</p><h1>Dashboard Library</h1><p>Dashboard 只编排已有 Panel。所有 Dashboard 都是可查看、编辑、复制和删除的配置资产。</p></div>
      <div class="library-actions"><a-input v-model:value="search" allow-clear placeholder="搜索 Dashboard" class="library-search" /><a-button type="primary" @click="openCreate()">新增 Dashboard</a-button></div>
    </header>
    <a-alert v-if="error" type="error" show-icon :message="error" class="library-alert" />
    <a-skeleton v-if="loading" active :paragraph="{ rows: 8 }" />
    <a-empty v-else-if="!filteredDashboards.length" description="没有匹配的 Dashboard" />
    <section v-else class="dashboard-cards">
      <article v-for="dashboard in filteredDashboards" :key="dashboard.id" class="dashboard-card">
        <div class="card-top"><span class="dashboard-id">{{ dashboard.id }}</span><a-tag>{{ domainTitle(dashboard.baseDashboardId) }}</a-tag></div>
        <h2>{{ dashboard.title }}</h2>
        <p>{{ dashboard.description }}</p>
        <div class="dashboard-stats"><div><strong>{{ dashboard.placements.length }}</strong><span>Panels</span></div><div><strong>{{ domainTitle(dashboard.baseDashboardId) }}</strong><span>数据域</span></div></div>
        <div class="card-actions">
          <a-button size="small" @click="openDashboard(dashboard)">打开</a-button>
          <a-button size="small" @click="openCreate(dashboard)">复制</a-button>
          <a-button size="small" @click="openEdit(dashboard)">编辑</a-button>
          <a-popconfirm title="确定删除这个 Dashboard？Panel 定义不会被删除。" ok-text="删除" cancel-text="取消" @confirm="deleteDashboard(dashboard)"><a-button size="small" danger>删除</a-button></a-popconfirm>
        </div>
      </article>
    </section>

    <a-drawer v-model:open="editorOpen" :title="editing ? '编辑 Dashboard' : '新增 Dashboard'" width="min(980px, 96vw)" :closable="!saving">
      <a-alert v-if="formError" type="error" show-icon :message="formError" class="editor-alert" />
      <Enchant name="dashboard-builder" page="dashboard-library" kind="form" prompt="根据用户描述填写 Dashboard 草稿，不要保存。">
        <TextToFormBuilder
          :model="builderModel"
          :fields="{ id: 'Dashboard ID', title: '标题', description: '描述', panelIds: '需要加入的 Panel ID 列表' }"
          :prompt="builderPrompt"
          placeholder="例如：创建一个服务延迟排障大盘，包含 P95、趋势、服务排名和健康明细"
          :assign="applyGeneratedDraft"
        />
        <a-form layout="vertical">
          <a-form-item label="数据域" required><a-select v-model:value="draft.baseDashboardId" :disabled="editing" :options="domains.map((domain) => ({ label: domain.title, value: domain.id }))" /></a-form-item>
          <div class="editor-row">
            <a-form-item label="Dashboard ID" required><a-input v-model:value="draft.id" :disabled="editing" placeholder="service-latency-review" /></a-form-item>
            <a-form-item label="标题" required><a-input v-model:value="draft.title" /></a-form-item>
          </div>
          <a-form-item label="描述" required><a-textarea v-model:value="draft.description" :rows="2" /></a-form-item>
        </a-form>
      </Enchant>

      <section class="composer">
        <div class="composer-column">
          <div class="section-heading"><div><strong>Panel Library</strong><span>{{ compatiblePanels.length }} 个可用 Panel</span></div><a-input v-model:value="panelSearch" allow-clear placeholder="搜索 Panel、指标或维度" /></div>
          <div class="panel-options">
            <article v-for="panel in compatiblePanels" :key="panel.id" :class="{ selected: selectedPanelIds.has(panel.id) }">
              <div><strong>{{ panel.title }}</strong><span>{{ panel.id }} · {{ panel.type }} · {{ panel.query.datasetId }}</span><p>{{ panel.description }}</p></div>
              <a-button size="small" :disabled="selectedPanelIds.has(panel.id)" @click="addPanel(panel)">{{ selectedPanelIds.has(panel.id) ? '已加入' : '加入' }}</a-button>
            </article>
          </div>
        </div>
        <div class="composer-column selected-column">
          <div class="section-heading"><div><strong>Dashboard Layout</strong><span>{{ draft.placements.length }} 个已选 Panel</span></div></div>
          <a-empty v-if="!draft.placements.length" description="从左侧加入 Panel，或使用 Text to Form 生成草稿" />
          <div v-else class="placement-list">
            <article v-for="(placement, index) in draft.placements" :key="placement.panelId">
              <div class="placement-title"><strong>{{ panelMap.get(placement.panelId)?.title ?? placement.panelId }}</strong><span>{{ placement.panelId }}</span></div>
              <label><span>宽度</span><a-input-number v-model:value="placement.width" :min="3" :max="12" size="small" /></label>
              <label><span>高度</span><a-input-number v-model:value="placement.minHeight" :min="120" :max="800" size="small" /></label>
              <div class="placement-actions"><a-button size="small" :disabled="index === 0" @click="movePanel(index, -1)">上移</a-button><a-button size="small" :disabled="index === draft.placements.length - 1" @click="movePanel(index, 1)">下移</a-button><a-button size="small" danger @click="removePanel(placement.panelId)">移除</a-button></div>
            </article>
          </div>
        </div>
      </section>
      <template #footer><div class="drawer-footer"><a-button :disabled="saving" @click="editorOpen = false">取消</a-button><a-button type="primary" :loading="saving" @click="submit">保存 Dashboard</a-button></div></template>
    </a-drawer>
  </main>
</template>

<style scoped>
.dashboard-library { min-height: calc(100vh - 38px); padding: 42px 30px; background: #f4f7fb; }
.library-heading { display: flex; max-width: 1540px; align-items: flex-end; justify-content: space-between; gap: 24px; margin: 0 auto 26px; }
.eyebrow, .dashboard-id { margin: 0; color: #3b82f6; font: 700 10px/1.2 'IBM Plex Mono', monospace; letter-spacing: .1em; }
h1 { margin: 8px 0; color: #14233a; font-size: 34px; }
.library-heading p:not(.eyebrow) { max-width: 720px; margin: 0; color: #64748b; font-size: 12px; }
.library-actions, .card-top, .card-actions, .section-heading, .drawer-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.library-search { width: min(340px, 100%); }
.library-alert, .editor-alert { margin-bottom: 16px; }
.dashboard-cards { display: grid; max-width: 1540px; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin: 0 auto; }
.dashboard-card { padding: 18px; border: 1px solid #d8e0ea; border-radius: 8px; background: #fff; box-shadow: 0 2px 8px rgb(24 39 75 / 4%); }
.dashboard-card h2 { margin: 14px 0 8px; color: #1e293b; font-size: 16px; }
.dashboard-card > p { min-height: 40px; margin: 0; color: #64748b; font-size: 11px; line-height: 1.6; }
.dashboard-stats { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 12px; padding: 14px 0; margin: 14px 0; border-block: 1px solid #edf1f5; }
.dashboard-stats strong, .dashboard-stats span, .section-heading strong, .section-heading span, .placement-title strong, .placement-title span { display: block; }
.dashboard-stats strong { overflow: hidden; color: #174a84; font: 600 13px/1.3 'IBM Plex Mono', monospace; text-overflow: ellipsis; white-space: nowrap; }
.dashboard-stats span, .section-heading span, .placement-title span { margin-top: 4px; color: #94a3b8; font-size: 9px; }
.card-actions { justify-content: flex-end; }
.editor-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.composer { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 14px; }
.composer-column { min-width: 0; padding: 14px; border: 1px solid #d8e0ea; border-radius: 7px; background: #f8fafc; }
.section-heading { align-items: flex-end; margin-bottom: 12px; }
.section-heading > div { flex: 0 0 auto; }
.section-heading :deep(.ant-input-affix-wrapper) { width: min(280px, 60%); }
.panel-options, .placement-list { display: grid; max-height: 520px; gap: 8px; overflow: auto; }
.panel-options article, .placement-list article { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px; border: 1px solid #dce4ee; border-radius: 6px; background: #fff; }
.panel-options article.selected { border-color: #a9c9ee; background: #f3f8ff; }
.panel-options strong { color: #334155; font-size: 11px; }
.panel-options span { display: block; margin-top: 3px; color: #7890aa; font: 9px/1.3 'IBM Plex Mono', monospace; }
.panel-options p { margin: 5px 0 0; color: #64748b; font-size: 9px; line-height: 1.4; }
.placement-list article { display: grid; grid-template-columns: minmax(150px, 1fr) 82px 90px auto; }
.placement-list label { color: #7890aa; font-size: 9px; }
.placement-list label > span { display: block; margin-bottom: 4px; }
.placement-actions { display: flex; gap: 4px; }
.drawer-footer { justify-content: flex-end; }
@media (max-width: 1100px) { .dashboard-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } .composer { grid-template-columns: 1fr; } }
@media (max-width: 720px) { .dashboard-library { padding: 28px 16px; } .library-heading, .library-actions { align-items: stretch; flex-direction: column; } .library-search { width: 100%; } .dashboard-cards, .editor-row { grid-template-columns: 1fr; } .placement-list article { grid-template-columns: 1fr 1fr; } .placement-title, .placement-actions { grid-column: 1 / -1; } }
</style>
