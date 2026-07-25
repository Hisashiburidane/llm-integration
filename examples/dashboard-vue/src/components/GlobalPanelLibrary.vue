<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { PanelConfig } from '../model/types';

interface PanelEntry extends PanelConfig { dashboardTitle: string; topicId: string; }

const entries = ref<PanelEntry[]>([]);
const loading = ref(true);
const error = ref('');
const search = ref('');
const filteredEntries = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  if (!keyword) return entries.value;
  return entries.value.filter((panel) => `${panel.id} ${panel.title} ${panel.description} ${panel.dashboardTitle}`.toLowerCase().includes(keyword));
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const responses = await Promise.all([
      fetch('/api/dashboard/config'),
      fetch('/api/dashboard/config?dashboard=air-quality-operations'),
      fetch('/api/dashboard/config?dashboard=nyc-taxi-operations')
    ]);
    const payloads = await Promise.all(responses.map((response) => response.json() as Promise<{ panelLibrary?: PanelConfig[]; title?: string; topicId?: string; error?: string }>));
    if (responses.some((response) => !response.ok) || payloads.some((payload) => payload.error)) throw new Error(payloads.find((payload) => payload.error)?.error || 'Panel Library 加载失败。');
    entries.value = payloads.flatMap((payload) => (payload.panelLibrary ?? []).map((panel) => ({ ...panel, dashboardTitle: payload.title ?? '', topicId: payload.topicId ?? '' })));
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
    <header class="library-heading"><div><p class="eyebrow">PLATFORM / PANEL LIBRARY</p><h1>Panel Library</h1><p>跨 Dashboard 管理可复用 Panel 定义。这里展示查询元数据，不重复渲染业务页面。</p></div><a-input v-model:value="search" allow-clear placeholder="搜索 Panel、指标或 Dashboard" class="library-search" /></header>
    <a-alert v-if="error" type="error" show-icon :message="error" />
    <a-skeleton v-if="loading" active :paragraph="{ rows: 8 }" />
    <a-empty v-else-if="!filteredEntries.length" description="没有匹配的 Panel" />
    <section v-else class="library-grid"><article v-for="panel in filteredEntries" :key="`${panel.topicId}:${panel.id}`" class="library-card"><div class="card-top"><span class="panel-kicker">{{ panel.type }} / {{ panel.id }}</span><a-tag>{{ panel.dashboardTitle }}</a-tag></div><h2>{{ panel.title }}</h2><p>{{ panel.description }}</p><dl><div><dt>指标</dt><dd>{{ panel.query.metrics.map((metric) => metric.metricId).join(', ') }}</dd></div><div><dt>维度</dt><dd>{{ panel.query.dimensions.map((dimension) => dimension.dimensionId).join(', ') || '-' }}</dd></div><div><dt>数据集</dt><dd>{{ panel.query.datasetId }}</dd></div></dl></article></section>
  </main>
</template>

<style scoped>
.library-page { min-height: calc(100vh - 38px); padding: 42px 30px; background: #f4f7fb; }
.library-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; max-width: 1540px; margin: 0 auto 26px; }
.eyebrow, .panel-kicker { margin: 0; color: #3b82f6; font: 700 10px/1.2 'IBM Plex Mono', monospace; letter-spacing: .1em; }
h1 { margin: 8px 0; color: #14233a; font-size: 34px; }
.library-heading p:not(.eyebrow) { max-width: 650px; margin: 0; color: #64748b; font-size: 12px; }
.library-search { width: min(360px, 100%); }
.library-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; max-width: 1540px; margin: 0 auto; }
.library-card { padding: 18px; border: 1px solid #d8e0ea; border-radius: 8px; background: #fff; box-shadow: 0 2px 8px rgb(24 39 75 / 4%); }
.card-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
h2 { margin: 14px 0 8px; color: #1e293b; font-size: 15px; }
.library-card > p { min-height: 36px; margin: 0 0 15px; color: #64748b; font-size: 11px; line-height: 1.6; }
dl { display: grid; gap: 8px; margin: 0; }
dl div { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 8px; }
dt { color: #94a3b8; font-size: 10px; } dd { margin: 0; overflow: hidden; color: #475569; font: 10px/1.4 'IBM Plex Mono', monospace; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 1000px) { .library-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 620px) { .library-page { padding: 28px 16px; } .library-heading { align-items: flex-start; flex-direction: column; } .library-search { width: 100%; } .library-grid { grid-template-columns: 1fr; } }
</style>
