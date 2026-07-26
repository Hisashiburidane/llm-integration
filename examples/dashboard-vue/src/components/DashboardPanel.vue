<script setup lang="ts">
import { computed } from 'vue';
import ChartCanvas from './ChartCanvas.vue';
import { formatMetricValue } from '../query/format';
import type { DatasetDefinition, PanelConfig, QueryResult } from '../model/types';

const props = defineProps<{
  panel: PanelConfig;
  dataset?: DatasetDefinition;
  result: QueryResult;
  highlighted: boolean;
  lowlight: boolean;
  selected: boolean;
}>();

const emit = defineEmits<{
  select: [panel: PanelConfig];
}>();

const metricKey = computed(() => props.panel.query.metrics[0]?.alias ?? props.panel.query.metrics[0]?.metricId ?? 'value');
const dimensionKey = computed(() => props.panel.query.dimensions[0]?.alias ?? props.panel.query.dimensions[0]?.dimensionId ?? 'group');
const metricId = computed(() => props.panel.query.metrics[0]?.metricId ?? 'flightCount');
const primaryMetric = computed(() => props.dataset?.metrics.find((definition) => definition.id === metricId.value));
const primaryValue = computed(() => props.result.rows[0]?.[metricKey.value] ?? 0);
const option = computed(() => {
  const rows = props.result.rows;
  const x = rows.map((row) => displayDimensionValue(row, dimensionKey.value));
  const values = rows.map((row) => Number(row[metricKey.value] ?? 0));
  const metricKeys = props.panel.query.metrics.map((metric) => metric.alias ?? metric.metricId);
  const metricLabels = props.panel.query.metrics.map((metric) => props.dataset?.metrics.find((definition) => definition.id === metric.metricId)?.label ?? metric.metricId);
  const common = {
    animation: false,
    color: ['#3b82f6', '#f59e0b', '#ef4444', '#14b8a6', '#8b5cf6'],
    tooltip: { trigger: props.panel.type === 'donut' ? 'item' : 'axis' },
    textStyle: { fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 }
  };
  if (props.panel.type === 'donut') return { ...common, legend: { bottom: 0, textStyle: { fontSize: 10 } }, series: [{ type: 'pie', radius: ['46%', '72%'], center: ['50%', '45%'], data: rows.map((row) => ({ name: String(row[dimensionKey.value] ?? '-'), value: Number(row[metricKey.value] ?? 0) })) }] };
  if (metricKeys.length > 1) {
    const category = props.panel.query.dimensions.length ? x : metricKeys;
    const series = props.panel.query.dimensions.length
      ? metricKeys.map((key, index) => ({ name: metricLabels[index], type: props.panel.type === 'bar' ? 'bar' : 'line', smooth: props.panel.type !== 'timeline', data: rows.map((row) => Number(row[key] ?? 0)), barMaxWidth: 28 }))
      : [{ name: metricLabels[0], type: 'bar', data: metricKeys.map((key) => Number(rows[0]?.[key] ?? 0)), barMaxWidth: 28 }];
    return { ...common, legend: { top: 0, textStyle: { fontSize: 9 } }, grid: { top: 32, right: 16, bottom: 34, left: 42 }, xAxis: { type: 'category', data: category, axisLabel: { color: '#64748b', fontSize: 10 }, axisLine: { lineStyle: { color: '#cbd5e1' } } }, yAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 10 }, splitLine: { lineStyle: { color: '#edf1f5' } } }, series };
  }
  return {
    ...common,
    grid: { top: 20, right: 16, bottom: 34, left: 42 },
    xAxis: { type: 'category', data: x, axisLabel: { color: '#64748b', fontSize: 10 }, axisLine: { lineStyle: { color: '#cbd5e1' } } },
    yAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 10 }, splitLine: { lineStyle: { color: '#edf1f5' } } },
    series: [{ type: props.panel.type === 'bar' ? 'bar' : 'line', smooth: props.panel.type !== 'timeline', data: values, barMaxWidth: 28, areaStyle: props.panel.type === 'timeline' ? { color: '#dbeafe' } : undefined, markPoint: props.panel.type === 'timeline' ? { data: [{ type: 'max', name: 'peak' }] } : undefined }]
  };
});

function displayValue(value: unknown) {
  return formatMetricValue(metricId.value, value, primaryMetric.value?.unit);
}

function columnLabel(column: string) {
  const metric = props.panel.query.metrics.find((item) => (item.alias ?? item.metricId) === column);
  if (metric) return props.dataset?.metrics.find((definition) => definition.id === metric.metricId)?.label ?? column;
  const dimension = props.panel.query.dimensions.find((item) => (item.alias ?? item.dimensionId) === column);
  return props.dataset?.dimensions.find((definition) => definition.id === dimension?.dimensionId)?.label ?? column;
}

function cellValue(row: Record<string, unknown>, column: string) {
  const metric = props.panel.query.metrics.find((item) => (item.alias ?? item.metricId) === column);
  return metric ? formatMetricValue(metric.metricId, row[column], props.dataset?.metrics.find((definition) => definition.id === metric.metricId)?.unit) : displayDimensionValue(row, column);
}

function displayDimensionValue(row: Record<string, unknown>, dimension: string) {
  return String(row[`${dimension}Label`] ?? row[dimension] ?? '-');
}

</script>

<template>
  <article class="dashboard-panel" :class="{ highlighted, lowlight, selected }" @click="emit('select', panel)">
    <header class="panel-header">
      <div>
        <p class="panel-kicker">{{ panel.type }} / {{ panel.id }}</p>
        <h3>{{ panel.title }}</h3>
      </div>
      <div class="panel-header-meta">
        <span v-if="highlighted" class="panel-highlight-badge">重点</span>
        <span class="panel-source">{{ result.loading ? '--' : `${result.summary.rowCount} rows` }}</span>
      </div>
    </header>
    <p class="panel-description">{{ panel.description }}</p>

    <div v-if="result.loading" class="panel-loading">
      <a-skeleton active :paragraph="{ rows: panel.type === 'metric' ? 2 : 4 }" />
    </div>
    <div v-else-if="result.error" class="panel-error">
      <strong>QuerySpec 无效</strong>
      <span>{{ result.error }}</span>
    </div>
    <div v-else-if="panel.type === 'metric'" class="metric-value">
      <strong>{{ displayValue(primaryValue) }}</strong>
      <span>{{ primaryMetric?.label ?? metricId }}<template v-if="primaryMetric?.unit"> · {{ primaryMetric.unit }}</template></span>
    </div>
    <div v-else-if="panel.type === 'table'" class="table-wrap">
      <table>
        <thead><tr><th v-for="column in result.columns" :key="column">{{ columnLabel(column) }}</th></tr></thead>
        <tbody>
          <tr v-for="(row, index) in result.rows" :key="`${panel.id}-${index}`">
            <td v-for="column in result.columns" :key="column">{{ cellValue(row, column) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else-if="result.rows.length" class="panel-visual">
      <ChartCanvas :option="option" />
    </div>
    <div v-else class="panel-empty">当前筛选没有匹配数据</div>
  </article>
</template>

<style scoped>
.dashboard-panel { position: relative; min-width: 0; height: 100%; padding: 16px; border: 1px solid #d8e0ea; border-radius: 8px; background: #fff; box-shadow: 0 2px 8px rgb(24 39 75 / 4%); cursor: pointer; transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease; }
.dashboard-panel.lowlight { opacity: .48; filter: saturate(.55); }
.dashboard-panel:hover, .dashboard-panel.selected { border-color: #8fb7ed; box-shadow: 0 8px 22px rgb(59 130 246 / 12%); transform: translateY(-1px); }
.dashboard-panel.highlighted { border-color: #f59e0b; background: linear-gradient(180deg, #fffdf5 0%, #fff 42%); box-shadow: 0 0 0 3px rgb(245 158 11 / 24%), 0 10px 28px rgb(180 83 9 / 12%); }
.panel-header { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; }
.panel-header-meta { display: flex; flex: 0 0 auto; gap: 8px; align-items: center; }
.panel-kicker { margin: 0 0 5px; color: #6b7b90; font: 10px/1.2 'IBM Plex Mono', monospace; letter-spacing: .04em; text-transform: uppercase; }
h3 { margin: 0; color: #1e293b; font-size: 14px; }
.panel-highlight-badge { padding: 3px 6px; border: 1px solid #f6c453; border-radius: 999px; color: #9a6700; background: #fff7d6; font: 700 9px/1 'IBM Plex Mono', monospace; }
.panel-source { flex: 0 0 auto; color: #94a3b8; font: 10px/1.2 'IBM Plex Mono', monospace; }
.panel-description { min-height: 32px; margin: 8px 0 10px; color: #64748b; font-size: 11px; line-height: 1.5; }
.panel-loading { min-height: 180px; padding-top: 12px; }
.panel-loading :deep(.ant-skeleton-title), .panel-loading :deep(.ant-skeleton-paragraph > li) { background: linear-gradient(90deg, #edf2f7 25%, #f8fafc 37%, #edf2f7 63%); background-size: 400% 100%; }
.metric-value { display: flex; min-height: 84px; flex-direction: column; justify-content: center; }
.metric-value strong { color: #0f3d75; font: 600 32px/1 'IBM Plex Mono', monospace; }
.metric-value span { margin-top: 8px; color: #94a3b8; font: 10px/1.2 'IBM Plex Mono', monospace; }
.panel-visual { height: 235px; }
.panel-empty { display: grid; height: 180px; place-items: center; color: #94a3b8; font-size: 12px; }
.panel-error { display: flex; min-height: 180px; flex-direction: column; justify-content: center; gap: 8px; color: #b42318; font-size: 11px; line-height: 1.5; }
.panel-error strong { font-size: 12px; }
.table-wrap { max-height: 240px; overflow: auto; }
table { width: 100%; border-collapse: collapse; color: #475569; font: 10px/1.4 'IBM Plex Mono', monospace; }
th, td { padding: 7px 8px; border-bottom: 1px solid #edf1f5; text-align: left; white-space: nowrap; }
th { position: sticky; top: 0; color: #64748b; background: #f8fafc; font-weight: 600; }
</style>
