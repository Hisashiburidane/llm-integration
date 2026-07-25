<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { DatasetDefinition, PanelConfig, PanelType } from '../model/types';

const props = defineProps<{
  panels: PanelConfig[];
  dataset: DatasetDefinition;
  saving?: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  save: [panel: PanelConfig];
  openDashboard: [panelId: string];
}>();

type PanelDraft = {
  id: string;
  type: PanelType;
  title: string;
  description: string;
  metricId: string;
  dimensionId: string;
  width: number;
  minHeight: number;
  limit: number;
};

const panelTypes: Array<{ label: string; value: PanelType }> = [
  { label: '指标卡', value: 'metric' },
  { label: '折线图', value: 'line' },
  { label: '柱状图', value: 'bar' },
  { label: '环形图', value: 'donut' },
  { label: '表格', value: 'table' },
  { label: '时间线', value: 'timeline' },
  { label: '机场状态', value: 'airport-status' }
];
const search = ref('');
const editorOpen = ref(false);
const editing = ref(false);
const formError = ref('');
const draft = ref<PanelDraft>(emptyDraft());

const filteredPanels = computed(() => {
  const needle = search.value.trim().toLowerCase();
  if (!needle) return props.panels;
  return props.panels.filter((panel) => [
    panel.id,
    panel.title,
    panel.description,
    panel.type,
    ...panel.query.metrics.map((metric) => metric.metricId),
    ...panel.query.dimensions.map((dimension) => dimension.dimensionId)
  ].join(' ').toLowerCase().includes(needle));
});

const metricLabel = (metricId: string) => props.dataset.metrics.find((metric) => metric.id === metricId)?.label ?? metricId;
const dimensionLabel = (dimensionId: string) => props.dataset.dimensions.find((dimension) => dimension.id === dimensionId)?.label ?? dimensionId;
const typeLabel = (type: PanelType) => panelTypes.find((item) => item.value === type)?.label ?? type;
const availableDimensions = computed(() => {
  const metric = props.dataset.metrics.find((item) => item.id === draft.value.metricId);
  return props.dataset.dimensions.filter((dimension) => metric?.supportedDimensions.includes(dimension.id));
});

watch(() => draft.value.metricId, () => {
  if (draft.value.dimensionId && !availableDimensions.value.some((dimension) => dimension.id === draft.value.dimensionId)) draft.value.dimensionId = '';
});

function emptyDraft(): PanelDraft {
  return {
    id: '',
    type: 'bar',
    title: '',
    description: '',
    metricId: props.dataset.metrics[0]?.id ?? 'flightCount',
    dimensionId: props.dataset.dimensions[0]?.id ?? '',
    width: 4,
    minHeight: 300,
    limit: 20
  };
}

function toDraft(panel: PanelConfig): PanelDraft {
  return {
    id: panel.id,
    type: panel.type,
    title: panel.title,
    description: panel.description,
    metricId: panel.query.metrics[0]?.metricId ?? props.dataset.metrics[0]?.id ?? 'flightCount',
    dimensionId: panel.query.dimensions[0]?.dimensionId ?? '',
    width: panel.layout.width,
    minHeight: panel.layout.minHeight,
    limit: panel.query.limit ?? 20
  };
}

function toPanel(value: PanelDraft): PanelConfig {
  const dimensions = value.dimensionId ? [{ dimensionId: value.dimensionId }] : [];
  const query = {
    datasetId: props.dataset.id,
    metrics: [{ metricId: value.metricId }],
    dimensions,
    filters: [],
    ...(value.limit > 0 ? { limit: value.limit } : {})
  };
  return {
    id: value.id.trim(),
    type: value.type,
    title: value.title.trim(),
    description: value.description.trim(),
    query,
    ...(value.type === 'bar' || value.type === 'line' ? { visualization: { showLabels: value.type === 'bar' } } : {}),
    layout: { width: value.width, minHeight: value.minHeight }
  };
}

function openCreate() {
  editing.value = false;
  formError.value = '';
  draft.value = emptyDraft();
  editorOpen.value = true;
}

function openEdit(panel: PanelConfig) {
  editing.value = true;
  formError.value = '';
  draft.value = toDraft(panel);
  editorOpen.value = true;
}

function submit() {
  const panel = toPanel(draft.value);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(panel.id)) {
    formError.value = 'Panel ID 只能使用小写字母、数字和连字符。';
    return;
  }
  if (!panel.title || !panel.description) {
    formError.value = '标题和描述不能为空。';
    return;
  }
  if (!editing.value && props.panels.some((item) => item.id === panel.id)) {
    formError.value = `Panel ID 已存在：${panel.id}。`;
    return;
  }
  formError.value = '';
  emit('save', panel);
  editorOpen.value = false;
}
</script>

<template>
  <section class="catalog-page">
    <div class="catalog-heading">
      <div>
        <p class="eyebrow">DASHBOARD / PANEL CATALOG</p>
        <h1>Panel metadata</h1>
        <p class="heading-copy">查看、搜索和维护当前 Dashboard 的 Panel 元数据。这里不编辑图表代码，只维护 QuerySpec 和展示合约。</p>
      </div>
      <a-button type="primary" @click="openCreate">新增 Panel</a-button>
    </div>

    <a-alert v-if="error" type="error" show-icon :message="error" class="catalog-alert" />
    <div class="catalog-toolbar">
      <a-input-search v-model:value="search" allow-clear placeholder="搜索 ID、标题、类型、指标或维度" />
      <span class="catalog-count">显示 {{ filteredPanels.length }} / {{ panels.length }} 个 Panel</span>
    </div>

    <a-empty v-if="!filteredPanels.length" description="没有匹配的 Panel" />
    <div v-else class="catalog-grid">
      <a-card v-for="panel in filteredPanels" :key="panel.id" size="small" class="catalog-card">
        <template #title>
          <div class="catalog-card-title">
            <span>{{ panel.title }}</span>
            <a-tag color="blue">{{ typeLabel(panel.type) }}</a-tag>
          </div>
        </template>
        <template #extra><a-button type="link" size="small" @click="openEdit(panel)">编辑</a-button></template>
        <p class="catalog-id">{{ panel.id }}</p>
        <p class="catalog-description">{{ panel.description }}</p>
        <dl class="catalog-meta">
          <div><dt>Metrics</dt><dd>{{ panel.query.metrics.map((metric) => metricLabel(metric.metricId)).join('、') || '-' }}</dd></div>
          <div><dt>Dimensions</dt><dd>{{ panel.query.dimensions.map((dimension) => dimensionLabel(dimension.dimensionId)).join('、') || '无' }}</dd></div>
          <div><dt>Layout</dt><dd>{{ panel.layout.width }}/12 · {{ panel.layout.minHeight }}px</dd></div>
          <div><dt>Query limit</dt><dd>{{ panel.query.limit ?? '默认' }}</dd></div>
        </dl>
        <a-button block size="small" @click="emit('openDashboard', panel.id)">在 Dashboard 中查看</a-button>
      </a-card>
    </div>

    <a-modal v-model:open="editorOpen" :title="editing ? '编辑 Panel 元数据' : '新增 Panel'" ok-text="保存" cancel-text="取消" :confirm-loading="saving" @ok="submit">
      <a-alert v-if="formError" type="error" show-icon :message="formError" class="editor-alert" />
      <a-form layout="vertical">
        <a-form-item label="Panel ID" required>
          <a-input v-model:value="draft.id" :disabled="editing" placeholder="例如 airport-delay-risk" />
        </a-form-item>
        <a-form-item label="标题" required><a-input v-model:value="draft.title" placeholder="面板标题" /></a-form-item>
        <a-form-item label="描述" required><a-textarea v-model:value="draft.description" :rows="2" placeholder="说明这个面板回答什么问题" /></a-form-item>
        <a-form-item label="Panel 类型" required><a-select v-model:value="draft.type" :options="panelTypes" /></a-form-item>
        <a-form-item label="指标" required><a-select v-model:value="draft.metricId" :options="dataset.metrics.map((metric) => ({ label: `${metric.label} / ${metric.id}`, value: metric.id }))" /></a-form-item>
        <a-form-item label="维度"><a-select v-model:value="draft.dimensionId" allow-clear :options="availableDimensions.map((dimension) => ({ label: `${dimension.label} / ${dimension.id}`, value: dimension.id }))" /></a-form-item>
        <div class="editor-row">
          <a-form-item label="宽度（12 列）"><a-input-number v-model:value="draft.width" :min="3" :max="12" /></a-form-item>
          <a-form-item label="最小高度"><a-input-number v-model:value="draft.minHeight" :min="120" :max="800" /></a-form-item>
          <a-form-item label="Query limit"><a-input-number v-model:value="draft.limit" :min="0" :max="100" /></a-form-item>
        </div>
      </a-form>
    </a-modal>
  </section>
</template>

<style scoped>
.catalog-page { min-height: 540px; }
.catalog-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 22px; }
.eyebrow { margin: 0; color: #3b82f6; font: 700 10px/1.2 "IBM Plex Mono", monospace; letter-spacing: .12em; }
h1 { margin: 7px 0 8px; color: #14233a; font-size: clamp(24px, 3vw, 36px); letter-spacing: -.03em; }
.heading-copy { max-width: 760px; margin: 0; color: #64748b; font-size: 12px; line-height: 1.7; }
.catalog-alert { margin-bottom: 16px; }
.catalog-toolbar { display: flex; align-items: center; gap: 16px; padding: 14px 16px; margin-bottom: 18px; border: 1px solid #d8e0ea; border-radius: 8px; background: #fff; }
.catalog-toolbar :deep(.ant-input-search) { max-width: 520px; }
.catalog-count { margin-left: auto; color: #64748b; font: 10px/1.2 "IBM Plex Mono", monospace; }
.catalog-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.catalog-card { min-width: 0; border-color: #d8e0ea; }
.catalog-card-title { display: flex; min-width: 0; align-items: center; gap: 8px; }
.catalog-card-title > span { overflow: hidden; color: #1e293b; text-overflow: ellipsis; white-space: nowrap; }
.catalog-id { margin: 0 0 7px; color: #3b82f6; font: 10px/1.2 "IBM Plex Mono", monospace; }
.catalog-description { min-height: 36px; margin: 0 0 12px; color: #64748b; font-size: 11px; line-height: 1.55; }
.catalog-meta { display: grid; gap: 7px; margin: 0 0 14px; }
.catalog-meta > div { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 8px; }
.catalog-meta dt { color: #94a3b8; font: 10px/1.4 "IBM Plex Mono", monospace; }
.catalog-meta dd { min-width: 0; margin: 0; overflow: hidden; color: #475569; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.editor-alert { margin-bottom: 16px; }
.editor-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
@media (max-width: 980px) { .catalog-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 620px) { .catalog-heading, .catalog-toolbar { align-items: stretch; flex-direction: column; } .catalog-toolbar :deep(.ant-input-search) { max-width: none; } .catalog-count { margin-left: 0; } .catalog-grid { grid-template-columns: 1fr; } .editor-row { grid-template-columns: 1fr; } }
</style>
