<script setup lang="ts">
import { computed } from 'vue';
import { Enchant } from '@enchantforge/vue';
import { k8sPanels, panelGroups, type K8sPanel } from './focus/k8sDashboard';
import {
  clearFocusComposition,
  closeFocusPanel,
  focusViewCapabilities,
  focusViewState,
  openFocusPanel
} from './focus/focus-view-capabilities';
import EChart from './focus/EChart.vue';
import type { DemoSpec } from './registry';

defineProps<{ demo: DemoSpec }>();

const highlightedIds = computed(() => focusViewState.highlightedPanelIds);
const activePanel = computed(() => k8sPanels.find((panel) => panel.id === focusViewState.activePanelId));
const composedPanels = computed(() =>
  focusViewState.composedPanelIds
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
  openFocusPanel(panelId);
}

function closeDetail() {
  closeFocusPanel();
}

function clearComposed() {
  clearFocusComposition();
}
</script>

<template>
  <div class="focus-shell">
    <Enchant
      name="focus-dashboard"
      page="focus-view"
      kind="page"
      prompt="根据用户要求高亮、打开或组合监控面板。只要求查看或定位时高亮；明确要求打开或放大时打开；明确要求组合或对比时组合。"
      :capabilities="focusViewCapabilities"
    >
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
              kind="chart"
              :metadata="[{
                id: panel.id,
                kind: 'chart',
                label: panel.title,
                title: panel.title,
                metric: panel.metric,
                summary: panel.summary,
                priority: panel.priority,
                tags: [panel.category]
              }]"
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
    </Enchant>

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

<style scoped src="./FocusViewDemo.css"></style>
