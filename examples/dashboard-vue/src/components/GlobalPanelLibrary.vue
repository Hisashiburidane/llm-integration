<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Enchant } from '@enchantforge/vue';
import DashboardPanel from './DashboardPanel.vue';
import TextToFormBuilder from './TextToFormBuilder.vue';
import { queryDashboard } from '../query/client';
import type { DatasetDefinition, PanelConfig, PanelType, QueryResult, QuerySpec } from '../model/types';
import type { DashboardFilterDefinition } from '../runtime/dashboard-runtime';

interface QuerySource {
  datasetId: string;
  metricIds: string[];
}

interface LibraryPanel extends PanelConfig {
  seeded?: boolean;
}

interface DashboardCatalog {
  id: string;
  title: string;
  topicId: string;
  dataset: DatasetDefinition;
  querySources: QuerySource[];
  filterDefinitions: DashboardFilterDefinition[];
}

interface PanelEntry extends PanelConfig {
  dashboardId: string;
  dashboardTitle: string;
  topicId: string;
  dataset: DatasetDefinition;
  seeded?: boolean;
}

interface PanelDraft extends Record<string, unknown> {
  id: string;
  type: PanelType;
  title: string;
  description: string;
  metricIds: string[];
  dimensionIds: string[];
  width: number;
  minHeight: number;
  limit: number;
}

const panelTypes: Array<{ label: string; value: PanelType }> = [
  { label: '指标卡', value: 'metric' },
  { label: '折线图', value: 'line' },
  { label: '柱状图', value: 'bar' },
  { label: '环形图', value: 'donut' },
  { label: '表格', value: 'table' },
  { label: '时间线', value: 'timeline' },
  { label: '拓扑图', value: 'graph' }
];

const panels = ref<LibraryPanel[]>([]);
const catalogs = ref<DashboardCatalog[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const search = ref('');
const editorOpen = ref(false);
const editing = ref(false);
const formError = ref('');
const selectedDashboardId = ref('');
const selectedDatasetId = ref('');
const detailPanel = ref<PanelEntry | null>(null);
const previewResult = ref<QueryResult>();
const editingPanel = ref<PanelConfig>();
const draft = ref<PanelDraft>(emptyDraft());
let previewSequence = 0;

const entries = computed<PanelEntry[]>(() => panels.value.flatMap((panel) => {
  const catalog = catalogForPanel(panel);
  return catalog ? [{ ...panel, dashboardId: catalog.id, dashboardTitle: catalog.title, topicId: catalog.topicId, dataset: catalog.dataset }] : [];
}));
const filteredEntries = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  if (!keyword) return entries.value;
  return entries.value.filter((panel) => [
    panel.id,
    panel.title,
    panel.description,
    panel.dashboardTitle,
    panel.type,
    ...panel.query.metrics.map((metric) => metric.metricId),
    ...panel.query.dimensions.map((dimension) => dimension.dimensionId)
  ].join(' ').toLowerCase().includes(keyword));
});
const selectedCatalog = computed(() => catalogs.value.find((catalog) => catalog.id === selectedDashboardId.value) ?? catalogs.value[0]);
const selectedSource = computed(() => selectedCatalog.value?.querySources.find((source) => source.datasetId === selectedDatasetId.value));
const availableMetrics = computed(() => {
  const catalog = selectedCatalog.value;
  if (!catalog) return [];
  if (!selectedSource.value) return catalog.dataset.metrics;
  return catalog.dataset.metrics.filter((metric) => selectedSource.value?.metricIds.includes(metric.id));
});
const availableDimensions = computed(() => {
  const catalog = selectedCatalog.value;
  if (!catalog || !draft.value.metricIds.length) return [];
  const metrics = draft.value.metricIds
    .map((metricId) => catalog.dataset.metrics.find((metric) => metric.id === metricId))
    .filter((metric) => metric !== undefined);
  return catalog.dataset.dimensions.filter((dimension) => metrics.every((metric) => metric.supportedDimensions.includes(dimension.id)));
});
const builderPrompt = computed(() => [
  '根据用户描述填写 Panel 草稿，不要保存。',
  `当前数据域：${selectedCatalog.value?.title ?? '未选择'}。`,
  `当前查询数据源：${selectedSource.value?.datasetId ?? '未选择'}。`,
  `可用类型：${panelTypes.map((item) => item.value).join(', ')}。`,
  `可用指标：${availableMetrics.value.map((metric) => `${metric.id}(${metric.label})`).join(', ')}。`,
  `可用维度：${availableDimensions.value.map((dimension) => `${dimension.id}(${dimension.label})`).join(', ') || '无'}。`,
  'metricIds 和 dimensionIds 必须使用上述 ID 数组。指标卡不填写维度，拓扑图必须填写两个维度。id 使用小写字母、数字和连字符。不要调用保存能力。'
].join('\n\n'));

watch(() => draft.value.metricIds, () => {
  const allowedMetrics = new Set(availableMetrics.value.map((metric) => metric.id));
  if (draft.value.metricIds.some((metricId) => !allowedMetrics.has(metricId))) {
    draft.value.metricIds = draft.value.metricIds.filter((metricId) => allowedMetrics.has(metricId));
  }
  const allowedDimensions = new Set(availableDimensions.value.map((dimension) => dimension.id));
  draft.value.dimensionIds = draft.value.dimensionIds.filter((dimensionId) => allowedDimensions.has(dimensionId));
}, { deep: true });

watch(selectedDashboardId, () => {
  if (!editorOpen.value || editing.value) return;
  selectedDatasetId.value = selectedCatalog.value?.querySources[0]?.datasetId ?? '';
  const metric = availableMetrics.value[0];
  draft.value.metricIds = metric ? [metric.id] : [];
  draft.value.dimensionIds = [];
});

watch(selectedDatasetId, () => {
  if (!editorOpen.value || editing.value) return;
  const allowed = new Set(availableMetrics.value.map((metric) => metric.id));
  if (!draft.value.metricIds.length || draft.value.metricIds.some((metricId) => !allowed.has(metricId))) {
    draft.value.metricIds = availableMetrics.value[0] ? [availableMetrics.value[0].id] : [];
    draft.value.dimensionIds = [];
  }
});

watch(detailPanel, (panel) => {
  const sequence = ++previewSequence;
  if (!panel) {
    previewResult.value = undefined;
    return;
  }
  const query = previewQuery(panel);
  previewResult.value = loadingResult(panel, query);
  void queryDashboard(query).then((result) => {
    if (sequence === previewSequence) previewResult.value = result;
  }).catch((cause) => {
    if (sequence !== previewSequence) return;
    previewResult.value = {
      columns: [],
      rows: [],
      error: cause instanceof Error ? cause.message : 'Panel 预览查询失败。',
      summary: { rowCount: 0, source: panel.dataset.sourceLabel, query }
    };
  });
});

function emptyDraft(): PanelDraft {
  return { id: '', type: 'bar', title: '', description: '', metricIds: [], dimensionIds: [], width: 6, minHeight: 300, limit: 20 };
}

function catalogForPanel(panel: PanelConfig) {
  return catalogs.value.find((catalog) => catalog.querySources.some((source) => source.datasetId === panel.query.datasetId));
}

function typeLabel(type: PanelType) {
  return panelTypes.find((item) => item.value === type)?.label ?? type;
}

function metricLabel(panel: PanelEntry, metricId: string) {
  return panel.dataset.metrics.find((metric) => metric.id === metricId)?.label ?? metricId;
}

function dimensionLabel(panel: PanelEntry, dimensionId: string) {
  return panel.dataset.dimensions.find((dimension) => dimension.id === dimensionId)?.label ?? dimensionId;
}

function metricSummary(panel: PanelEntry | null) {
  return panel?.query.metrics.map((metric) => metricLabel(panel, metric.metricId)).join('、') ?? '';
}

function dimensionSummary(panel: PanelEntry | null) {
  return panel?.query.dimensions.map((dimension) => dimensionLabel(panel, dimension.dimensionId)).join('、') || '无';
}

function previewQuery(panel: PanelEntry): QuerySpec {
  const catalog = catalogs.value.find((item) => item.id === panel.dashboardId);
  const filters = [...panel.query.filters];
  const metricDefinitions = panel.query.metrics
    .map((metric) => panel.dataset.metrics.find((definition) => definition.id === metric.metricId))
    .filter((metric) => metric !== undefined);
  for (const definition of catalog?.filterDefinitions ?? []) {
    const value = definition.defaultValue;
    if (value === undefined || (definition.allValue !== undefined && value === definition.allValue)) continue;
    if (!metricDefinitions.every((metric) => metric.supportedDimensions.includes(definition.dimensionId))) continue;
    if (!filters.some((filter) => filter.dimensionId === definition.dimensionId)) {
      filters.push({ dimensionId: definition.dimensionId, operator: definition.operator, value });
    }
  }
  return { ...panel.query, filters };
}

function loadingResult(panel: PanelEntry, query = previewQuery(panel)): QueryResult {
  return { columns: [], rows: [], loading: true, summary: { rowCount: 0, source: panel.dataset.sourceLabel, query } };
}

function openDetails(panel: PanelEntry) {
  detailPanel.value = panel;
}

function openCreate() {
  editing.value = false;
  editingPanel.value = undefined;
  formError.value = '';
  selectedDashboardId.value = catalogs.value[0]?.id ?? '';
  selectedDatasetId.value = selectedCatalog.value?.querySources[0]?.datasetId ?? '';
  draft.value = emptyDraft();
  const metric = availableMetrics.value[0];
  if (metric) draft.value.metricIds = [metric.id];
  editorOpen.value = true;
}

function openEdit(panel: PanelEntry) {
  editing.value = true;
  editingPanel.value = panel;
  formError.value = '';
  selectedDashboardId.value = panel.dashboardId;
  selectedDatasetId.value = panel.query.datasetId;
  draft.value = {
    id: panel.id,
    type: panel.type,
    title: panel.title,
    description: panel.description,
    metricIds: panel.query.metrics.map((metric) => metric.metricId),
    dimensionIds: panel.query.dimensions.map((dimension) => dimension.dimensionId),
    width: panel.layout.width,
    minHeight: panel.layout.minHeight,
    limit: panel.query.limit ?? 20
  };
  editorOpen.value = true;
}

function buildPanel(): PanelConfig | undefined {
  const catalog = selectedCatalog.value;
  const source = selectedSource.value;
  if (!catalog || !source) {
    formError.value = '请选择属于同一查询数据源的指标。';
    return;
  }
  const dimensions = draft.value.type === 'metric' ? [] : draft.value.dimensionIds;
  if (draft.value.type === 'graph' && dimensions.length !== 2) {
    formError.value = '拓扑图必须选择两个维度。';
    return;
  }
  const selectedFields = new Set([...draft.value.metricIds, ...dimensions]);
  const previousQuery = editingPanel.value?.query;
  const preservedOrder = previousQuery?.orderBy && selectedFields.has(previousQuery.orderBy.fieldId) ? previousQuery.orderBy : undefined;
  return {
    id: draft.value.id.trim(),
    type: draft.value.type,
    title: draft.value.title.trim(),
    description: draft.value.description.trim(),
    query: {
      datasetId: source.datasetId,
      metrics: draft.value.metricIds.map((metricId) => ({ metricId })),
      dimensions: dimensions.map((dimensionId) => ({ dimensionId })),
      filters: previousQuery?.datasetId === source.datasetId ? previousQuery.filters : [],
      ...(draft.value.limit > 0 ? { limit: draft.value.limit } : {}),
      ...(preservedOrder ? { orderBy: preservedOrder } : {})
    },
    ...(editingPanel.value?.visualization
      ? { visualization: editingPanel.value.visualization }
      : draft.value.type === 'bar' || draft.value.type === 'graph' ? { visualization: { showLabels: true } } : {}),
    layout: { width: draft.value.width, minHeight: draft.value.minHeight }
  };
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function applyGeneratedDraft(values: Record<string, unknown>) {
  if (!editing.value && typeof values.id === 'string') draft.value.id = values.id;
  if (typeof values.title === 'string') draft.value.title = values.title;
  if (typeof values.description === 'string') draft.value.description = values.description;
  if (typeof values.type === 'string' && panelTypes.some((item) => item.value === values.type)) draft.value.type = values.type as PanelType;
  if (values.metricIds !== undefined) {
    const allowed = new Set(availableMetrics.value.map((metric) => metric.id));
    draft.value.metricIds = [...new Set(stringArray(values.metricIds).filter((metricId) => allowed.has(metricId)))];
  }
  if (values.dimensionIds !== undefined) {
    const allowed = new Set(availableDimensions.value.map((dimension) => dimension.id));
    draft.value.dimensionIds = [...new Set(stringArray(values.dimensionIds).filter((dimensionId) => allowed.has(dimensionId)))];
  }
  if (typeof values.width === 'number') draft.value.width = Math.min(12, Math.max(3, Math.round(values.width)));
  if (typeof values.minHeight === 'number') draft.value.minHeight = Math.min(800, Math.max(120, Math.round(values.minHeight)));
  if (typeof values.limit === 'number') draft.value.limit = Math.min(100, Math.max(0, Math.round(values.limit)));
}

async function submit() {
  const panel = buildPanel();
  if (!panel) return;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(panel.id)) {
    formError.value = 'Panel ID 只能使用小写字母、数字和连字符。';
    return;
  }
  if (!panel.title || !panel.description) {
    formError.value = '标题和描述不能为空。';
    return;
  }
  if (!panel.query.metrics.length) {
    formError.value = '至少选择一个指标。';
    return;
  }
  if (!editing.value && panels.value.some((item) => item.id === panel.id)) {
    formError.value = `Panel ID 已存在：${panel.id}。`;
    return;
  }
  saving.value = true;
  formError.value = '';
  try {
    const response = await fetch('/api/dashboard/panels', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(panel)
    });
    const payload = await response.json() as { error?: string };
    if (!response.ok || payload.error) throw new Error(payload.error || `Panel 保存失败（${response.status}）。`);
    editorOpen.value = false;
    await load();
  } catch (cause) {
    formError.value = cause instanceof Error ? cause.message : 'Panel 保存失败。';
  } finally {
    saving.value = false;
  }
}

async function deletePanel(panel: PanelEntry) {
  try {
    const response = await fetch(`/api/dashboard/panels/${encodeURIComponent(panel.id)}`, { method: 'DELETE' });
    const payload = await response.json() as { error?: string };
    if (!response.ok || payload.error) throw new Error(payload.error || `Panel 删除失败（${response.status}）。`);
    detailPanel.value = null;
    await load();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Panel 删除失败。';
  }
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const configUrls = [
      '/api/dashboard/config',
      '/api/dashboard/config?dashboard=air-quality-operations',
      '/api/dashboard/config?dashboard=nyc-taxi-operations',
      '/api/dashboard/config?dashboard=otel-demo-observability'
    ];
    const [libraryResponse, ...configResponses] = await Promise.all([
      fetch('/api/dashboard/panels'),
      ...configUrls.map((url) => fetch(url))
    ]);
    const library = await libraryResponse.json() as { panels?: LibraryPanel[]; error?: string };
    const configs = await Promise.all(configResponses.map((response) => response.json() as Promise<DashboardCatalog & { error?: string }>));
    const responseError = library.error || configs.find((config) => config.error)?.error;
    if (!libraryResponse.ok || configResponses.some((response) => !response.ok) || responseError) throw new Error(responseError || 'Panel Library 加载失败。');
    catalogs.value = configs;
    panels.value = library.panels ?? [];
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Panel Library 加载失败。';
  } finally {
    loading.value = false;
  }
}

onMounted(() => { void load(); });
</script>

<template>
  <main class="library-page">
    <header class="library-heading">
      <div><p class="eyebrow">PLATFORM / PANEL LIBRARY</p><h1>Panel Library</h1><p>Panel 是独立的可复用资产。点击卡片可真实渲染，编辑只修改 Panel 定义，不改变 Dashboard placement。</p></div>
      <div class="library-actions"><a-input v-model:value="search" allow-clear placeholder="搜索 Panel、指标或 Dashboard" class="library-search" /><a-button type="primary" @click="openCreate">新增 Panel</a-button></div>
    </header>
    <a-alert v-if="error" type="error" show-icon :message="error" />
    <a-skeleton v-if="loading" active :paragraph="{ rows: 8 }" />
    <a-empty v-else-if="!filteredEntries.length" description="没有匹配的 Panel" />
    <section v-else class="library-grid">
      <article v-for="panel in filteredEntries" :key="panel.id" class="library-card" tabindex="0" @click="openDetails(panel)" @keydown.enter="openDetails(panel)">
        <div class="card-top"><span class="panel-kicker">{{ typeLabel(panel.type) }} / {{ panel.id }}</span><a-tag>{{ panel.dashboardTitle }}</a-tag></div>
        <h2>{{ panel.title }}</h2>
        <p>{{ panel.description }}</p>
        <dl><div><dt>指标</dt><dd>{{ panel.query.metrics.map((metric) => metricLabel(panel, metric.metricId)).join(', ') }}</dd></div><div><dt>维度</dt><dd>{{ panel.query.dimensions.map((dimension) => dimensionLabel(panel, dimension.dimensionId)).join(', ') || '-' }}</dd></div><div><dt>数据源</dt><dd>{{ panel.query.datasetId }}</dd></div></dl>
        <div class="card-actions"><span>点击独立查看</span><div><a-button type="link" size="small" @click.stop="openEdit(panel)">编辑</a-button><a-popconfirm v-if="!panel.seeded" title="确定删除这个 Panel？" ok-text="删除" cancel-text="取消" @confirm="deletePanel(panel)"><a-button type="link" size="small" danger @click.stop>删除</a-button></a-popconfirm></div></div>
      </article>
    </section>

    <a-modal v-model:open="editorOpen" :title="editing ? '编辑 Panel' : '新增 Panel'" ok-text="保存" cancel-text="取消" :confirm-loading="saving" width="720px" @ok="submit">
      <a-alert v-if="formError" type="error" show-icon :message="formError" class="editor-alert" />
      <Enchant name="panel-builder" page="panel-library" kind="form" prompt="根据用户描述填写 Panel 草稿，不要保存。">
        <TextToFormBuilder
          :model="draft"
          :fields="{ id: 'Panel ID', type: 'Panel 类型', title: '标题', description: '描述', metricIds: '指标 ID 列表', dimensionIds: '维度 ID 列表', width: '12 列布局宽度', minHeight: '最小高度', limit: '查询行数上限' }"
          :prompt="builderPrompt"
          placeholder="例如：创建一个按服务展示 P95 延迟排名的柱状图，宽度 6"
          :assign="applyGeneratedDraft"
        />
        <a-form layout="vertical">
          <div class="editor-row">
            <a-form-item label="数据域" required><a-select v-model:value="selectedDashboardId" :disabled="editing" :options="catalogs.map((catalog) => ({ label: catalog.title, value: catalog.id }))" /></a-form-item>
            <a-form-item label="查询数据源" required><a-select v-model:value="selectedDatasetId" :disabled="editing" :options="selectedCatalog?.querySources.map((source) => ({ label: source.datasetId, value: source.datasetId }))" /></a-form-item>
          </div>
          <div class="editor-row">
            <a-form-item label="Panel ID" required><a-input v-model:value="draft.id" :disabled="editing" placeholder="service-latency" /></a-form-item>
            <a-form-item label="Panel 类型" required><a-select v-model:value="draft.type" :options="panelTypes" /></a-form-item>
          </div>
          <a-form-item label="标题" required><a-input v-model:value="draft.title" /></a-form-item>
          <a-form-item label="描述" required><a-textarea v-model:value="draft.description" :rows="2" /></a-form-item>
          <a-form-item label="指标" required><a-select v-model:value="draft.metricIds" mode="multiple" :max-tag-count="3" :options="availableMetrics.map((metric) => ({ label: `${metric.label} / ${metric.id}`, value: metric.id }))" /></a-form-item>
          <a-form-item label="维度"><a-select v-model:value="draft.dimensionIds" mode="multiple" :disabled="draft.type === 'metric'" :max-tag-count="3" :options="availableDimensions.map((dimension) => ({ label: `${dimension.label} / ${dimension.id}`, value: dimension.id }))" /></a-form-item>
          <div class="editor-layout-row">
            <a-form-item label="宽度（12 列）"><a-input-number v-model:value="draft.width" :min="3" :max="12" /></a-form-item>
            <a-form-item label="最小高度"><a-input-number v-model:value="draft.minHeight" :min="120" :max="800" /></a-form-item>
            <a-form-item label="Query limit"><a-input-number v-model:value="draft.limit" :min="0" :max="100" /></a-form-item>
          </div>
        </a-form>
      </Enchant>
    </a-modal>

    <a-drawer :open="Boolean(detailPanel)" title="Panel Preview" width="min(720px, 96vw)" @close="detailPanel = null">
      <template v-if="detailPanel">
        <DashboardPanel :panel="detailPanel" :dataset="detailPanel.dataset" :result="previewResult ?? loadingResult(detailPanel)" :highlighted="false" :lowlight="false" :selected="false" />
        <a-divider />
        <div class="drawer-actions"><a-button @click="openEdit(detailPanel)">编辑 Panel</a-button><a-popconfirm v-if="!detailPanel.seeded" title="确定删除这个 Panel？" ok-text="删除" cancel-text="取消" @confirm="deletePanel(detailPanel)"><a-button danger>删除 Panel</a-button></a-popconfirm></div>
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item label="Panel ID">{{ detailPanel.id }}</a-descriptions-item>
          <a-descriptions-item label="数据域">{{ detailPanel.dashboardTitle }}</a-descriptions-item>
          <a-descriptions-item label="指标">{{ metricSummary(detailPanel) }}</a-descriptions-item>
          <a-descriptions-item label="维度">{{ dimensionSummary(detailPanel) }}</a-descriptions-item>
        </a-descriptions>
        <a-divider />
        <pre class="library-json">{{ JSON.stringify(detailPanel.query, null, 2) }}</pre>
      </template>
    </a-drawer>
  </main>
</template>

<style scoped>
.library-page { min-height: calc(100vh - 38px); padding: 42px 30px; background: #f4f7fb; }
.library-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; max-width: 1540px; margin: 0 auto 26px; }
.eyebrow, .panel-kicker { margin: 0; color: #3b82f6; font: 700 10px/1.2 'IBM Plex Mono', monospace; letter-spacing: .1em; }
h1 { margin: 8px 0; color: #14233a; font-size: 34px; }
.library-heading p:not(.eyebrow) { max-width: 700px; margin: 0; color: #64748b; font-size: 12px; }
.library-actions { display: flex; align-items: center; gap: 10px; }
.library-search { width: min(360px, 100%); }
.library-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; max-width: 1540px; margin: 0 auto; }
.library-card { padding: 18px; border: 1px solid #d8e0ea; border-radius: 8px; background: #fff; box-shadow: 0 2px 8px rgb(24 39 75 / 4%); cursor: pointer; transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease; }
.library-card:hover, .library-card:focus-visible { border-color: #8fb7ed; outline: none; box-shadow: 0 8px 22px rgb(59 130 246 / 12%); transform: translateY(-1px); }
.card-top, .card-actions, .drawer-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
h2 { margin: 14px 0 8px; color: #1e293b; font-size: 15px; }
.library-card > p { min-height: 36px; margin: 0 0 15px; color: #64748b; font-size: 11px; line-height: 1.6; }
dl { display: grid; gap: 8px; margin: 0; }
dl div { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 8px; }
dt { color: #94a3b8; font-size: 10px; }
dd { margin: 0; overflow: hidden; color: #475569; font: 10px/1.4 'IBM Plex Mono', monospace; text-overflow: ellipsis; white-space: nowrap; }
.card-actions { padding-top: 14px; margin-top: 14px; border-top: 1px solid #edf1f5; color: #94a3b8; font-size: 10px; }
.editor-alert { margin-bottom: 16px; }
.editor-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.editor-layout-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.drawer-actions { justify-content: flex-end; margin-bottom: 14px; }
.library-json { max-height: 420px; padding: 12px; overflow: auto; border: 1px solid #d8e0ea; border-radius: 6px; color: #334155; background: #f8fafc; font: 11px/1.5 'IBM Plex Mono', monospace; white-space: pre-wrap; }
@media (max-width: 1000px) { .library-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 720px) { .library-page { padding: 28px 16px; } .library-heading, .library-actions { align-items: stretch; flex-direction: column; } .library-search { width: 100%; } .library-grid, .editor-row, .editor-layout-row { grid-template-columns: 1fr; } }
</style>
