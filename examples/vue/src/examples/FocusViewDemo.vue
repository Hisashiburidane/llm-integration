<script setup lang="ts">
import { computed } from 'vue';
import { clearComposedPageScopes, closePageScope, Enchant, openPageScope, usePageFocus } from '@enchantforge/vue';
import { k8sPanels, panelGroups, type K8sPanel } from './focus/k8sDashboard';
import EChart from './focus/EChart.vue';
import type { DemoSpec } from './registry';

defineProps<{ demo: DemoSpec }>();

const pageFocus = usePageFocus('focus-view');
const highlightedIds = computed(() => pageFocus.value.highlightedScopeIds);
const activePanel = computed(() => k8sPanels.find((panel) => panel.id === pageFocus.value.activeScopeId));
const composedPanels = computed(() =>
  pageFocus.value.composedScopeIds
    .map((id) => k8sPanels.find((panel) => panel.id === id))
    .filter((panel): panel is K8sPanel => Boolean(panel))
);

function latestValue(panel: K8sPanel) {
  return panel.values[panel.values.length - 1];
}

function isHighlighted(panelId: string) {
  return highlightedIds.value.includes(panelId);
}

function isDimmed(panelId: string) {
  return highlightedIds.value.length > 0 && !highlightedIds.value.includes(panelId);
}

function openPanel(panelId: string) {
  openPageScope('focus-view', panelId);
}

function closeDetail() {
  closePageScope('focus-view');
}

function clearComposed() {
  clearComposedPageScopes('focus-view');
}
</script>

<template>
  <div class="focus-shell">
    <section class="k8s-board">
      <header class="board-header">
        <div>
          <p class="board-kicker">PROD / CN-EAST-1</p>
          <h2>Kubernetes Operations Center</h2>
        </div>
        <div class="board-status">
          <span><i class="healthy-dot"></i> 47 / 48 nodes ready</span>
          <span>{{ k8sPanels.length }} panels</span>
        </div>
      </header>

      <section v-for="group in panelGroups" :key="group.category" class="metric-group">
        <div class="group-heading">
          <h3>{{ group.label }}</h3>
          <span>{{ group.panels.length }} panels</span>
        </div>
        <div class="panel-grid">
          <Enchant
            v-for="panel in group.panels"
            :key="panel.id"
            :name="panel.id"
            page="focus-view"
            prompt="帮我找、打开或组合相关监控面板。"
          >
            <article
              class="metric-panel"
              :class="[
                `priority-${panel.priority}`,
                { highlighted: isHighlighted(panel.id), dimmed: isDimmed(panel.id) }
              ]"
              @dblclick="openPanel(panel.id)"
            >
              <header>
                <div><span>{{ panel.title }}</span><code>{{ panel.metric }}</code></div>
                <a-tag :color="panel.priority === 'critical' ? 'red' : panel.priority === 'warning' ? 'orange' : 'green'">{{ panel.priority }}</a-tag>
              </header>
              <div class="panel-value"><strong>{{ latestValue(panel) }}</strong><span>{{ panel.unit }}</span></div>
              <EChart class="panel-chart" :option="panel.option" />
              <p>{{ panel.summary }}</p>
            </article>
          </Enchant>
        </div>
      </section>
    </section>

    <a-modal :open="Boolean(activePanel)" :title="activePanel?.title" width="860px" :footer="null" @cancel="closeDetail">
      <EChart v-if="activePanel" class="detail-chart" :option="activePanel.option" />
      <a-alert v-if="activePanel" type="info" show-icon :message="activePanel.summary" />
    </a-modal>

    <a-drawer :open="composedPanels.length > 0" title="AI Focus Sub-dashboard" width="76vw" @close="clearComposed">
      <div class="composed-grid">
        <article v-for="panel in composedPanels" :key="panel.id" class="composed-panel">
          <h3>{{ panel.title }}</h3>
          <EChart class="composed-chart" :option="panel.option" />
          <p>{{ panel.summary }}</p>
        </article>
      </div>
    </a-drawer>
  </div>
</template>

<style scoped>
.focus-shell { position: relative; }
.k8s-board { min-width: 0; border: 1px solid #d8d9da; border-radius: 4px; background: #f4f5f5; overflow: hidden; box-shadow: 0 1px 3px #1b1b1b1a; }
.board-header { padding: 22px 24px; display: flex; justify-content: space-between; gap: 20px; color: #52545c; background: #ffffff; border-bottom: 1px solid #d8d9da; }
.board-header h2 { margin: 4px 0 0; color: #24292e; font: 600 22px/1.1 "IBM Plex Sans", sans-serif; }
.board-kicker { margin: 0; color: #5794f2; font: 700 10px/1 monospace; letter-spacing: .14em; }
.board-status { display: flex; gap: 16px; align-items: center; color: #5f6368; font-size: 12px; }
.healthy-dot { display: inline-block; width: 7px; height: 7px; margin-right: 6px; border-radius: 50%; background: #62d79b; box-shadow: 0 0 0 4px #62d79b22; }
.metric-group { padding: 18px 18px 4px; }
.group-heading { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
.group-heading h3 { margin: 0; color: #52545c; font: 700 12px/1 monospace; letter-spacing: .06em; text-transform: uppercase; }
.group-heading span { color: #8e8e8e; font: 10px/1 monospace; }
.panel-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.metric-panel { position: relative; min-width: 0; padding: 13px; border: 1px solid #d8d9da; border-radius: 3px; background: #ffffff; transition: opacity .25s, transform .25s, border-color .25s, box-shadow .25s; cursor: default; overflow: hidden; }
.metric-panel header { display: flex; justify-content: space-between; gap: 8px; position: relative; z-index: 1; }
.metric-panel header span { display: block; color: #24292e; font-weight: 600; font-size: 13px; }
.metric-panel header code { display: block; max-width: 170px; margin-top: 3px; overflow: hidden; color: #8e8e8e; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.metric-panel p { position: relative; z-index: 1; min-height: 32px; margin: 6px 0 0; color: #6e6e6e; font-size: 10px; line-height: 1.45; }
.panel-value { position: absolute; z-index: 2; top: 48px; left: 16px; color: #24292e; font-family: "IBM Plex Mono", monospace; }
.panel-value strong { font-size: 22px; letter-spacing: -.04em; }
.panel-value span { margin-left: 3px; color: #8e8e8e; font-size: 9px; }
.panel-chart { height: 132px; }
.metric-panel.highlighted { z-index: 1; border-color: #5794f2; box-shadow: 0 0 0 2px #5794f233, 0 8px 20px #5794f226; transform: translateY(-3px); }
.metric-panel.dimmed { opacity: .22; filter: grayscale(.65); }
.detail-chart { height: 480px; }
.composed-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.composed-panel { padding: 16px; border: 1px solid #dce5e1; border-radius: 10px; }
.composed-panel h3 { margin: 0; }
.composed-panel p { color: #66736e; }
.composed-chart { height: 260px; }
@media (max-width: 760px) { .panel-grid, .composed-grid { grid-template-columns: 1fr; } .board-status { display: none; } }
</style>
