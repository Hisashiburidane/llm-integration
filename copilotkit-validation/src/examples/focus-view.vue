<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAgentContext, useFrontendTool } from '@copilotkit/vue/v2';
import { z } from 'zod';
import MetricChart from '../components/metric-chart.vue';
import { focusPanels } from '../data/focus-panels';

const highlightedIds = ref<string[]>([]);
const detailPanelId = ref<string>();
const detailOpen = ref(false);
const composedIds = ref<string[]>([]);
const drawerOpen = ref(false);

const detailPanel = computed(() => focusPanels.find((panel) => panel.id === detailPanelId.value));
const composedPanels = computed(() => focusPanels.filter((panel) => composedIds.value.includes(panel.id)));
const hasHighlight = computed(() => highlightedIds.value.length > 0);

function validIds(ids: string[]) {
  const unique = [...new Set(ids)];
  const existing = unique.filter((id) => focusPanels.some((panel) => panel.id === id));
  if (!existing.length) throw new Error('没有找到有效的面板 ID。');
  return existing;
}

function openDetail(panelId: string) {
  detailPanelId.value = validIds([panelId])[0];
  detailOpen.value = true;
}

useAgentContext({
  description: '当前页面是监控 Focus View。面板目录用于语义选择；调用工具时必须使用 panel id。',
  value: () => ({
    page: 'Focus View',
    interactionRules: {
      highlight: '用户只说查看、关注、找出、看看某类数据时，高亮匹配面板，不打开弹窗。',
      detail: '只有用户明确要求打开、放大、详情或弹窗时，才打开单个面板。',
      compose: '只有用户明确要求组合、对比或集中查看多个指标时，才创建组合视图。'
    },
    panels: focusPanels.map(({ id, title, category, description, unit, value, tags }) => ({
      id,
      title,
      category,
      description,
      unit,
      value,
      tags
    })),
    uiState: {
      highlightedIds: highlightedIds.value,
      detailPanelId: detailPanelId.value ?? null,
      composedIds: composedIds.value
    }
  })
});

useFrontendTool({
  name: 'highlightPanels',
  description: '高亮一个或多个监控面板，并淡化其他面板。当用户说“查看、关注、找出、看看”某类数据且没有明确要求打开、放大、详情、弹窗、组合或对比时使用。',
  parameters: z.object({
    panelIds: z.array(z.string()).min(1).describe('需要高亮的面板 ID 列表'),
    reason: z.string().optional().describe('选择这些面板的简短原因')
  }),
  handler: async ({ panelIds }) => {
    highlightedIds.value = validIds(panelIds);
    return `已高亮 ${highlightedIds.value.length} 个面板。`;
  }
});

useFrontendTool({
  name: 'openPanelDetail',
  description: '在 Modal 中打开一个监控面板。仅当用户明确说“打开、放大、查看详情、弹窗显示”某个单独面板时使用；普通的“查看”应使用 highlightPanels。',
  parameters: z.object({
    panelId: z.string().describe('需要打开的单个面板 ID')
  }),
  handler: async ({ panelId }) => {
    openDetail(panelId);
    return `已打开 ${detailPanel.value?.title ?? panelId}。`;
  }
});

useFrontendTool({
  name: 'composePanelView',
  description: '在 Drawer 中创建多个监控面板的临时组合视图。仅当用户明确要求“组合、对比、集中查看、放在一起”多个指标时使用。',
  parameters: z.object({
    panelIds: z.array(z.string()).min(2).describe('需要加入组合视图的至少两个面板 ID'),
    title: z.string().optional().describe('组合视图标题')
  }),
  handler: async ({ panelIds }) => {
    composedIds.value = validIds(panelIds);
    if (composedIds.value.length < 2) throw new Error('组合视图至少需要两个有效面板。');
    drawerOpen.value = true;
    return `已创建包含 ${composedIds.value.length} 个面板的组合视图。`;
  }
});

useFrontendTool({
  name: 'clearPanelFocus',
  description: '当用户明确要求取消高亮、恢复全部面板或关闭当前聚焦状态时使用。',
  parameters: z.object({}),
  handler: async () => {
    highlightedIds.value = [];
    return '已恢复全部面板。';
  }
});
</script>

<template>
  <section class="demo-page focus-page">
    <div class="page-heading">
      <div>
        <div class="eyebrow">FOCUS VIEW</div>
        <h1>语义选择与视图控制</h1>
        <p>Context 提供面板目录，三个独立 Tool 分别负责高亮、详情和组合视图。</p>
      </div>
      <a-space>
        <a-tag color="blue">4 tools</a-tag>
        <a-button v-if="hasHighlight" size="small" @click="highlightedIds = []">清除高亮</a-button>
      </a-space>
    </div>

    <a-alert type="info" show-icon>
      <template #message>用于检查触发边界的输入</template>
      <template #description>
        “查看内存使用情况”应高亮；“打开内存工作集详情”应显示 Modal；“把存储和网络异常组合起来对比”应显示 Drawer。
      </template>
    </a-alert>

    <div class="metric-grid" :class="{ 'has-focus': hasHighlight }">
      <article
        v-for="panel in focusPanels"
        :key="panel.id"
        class="metric-panel"
        :class="{
          highlighted: highlightedIds.includes(panel.id),
          muted: hasHighlight && !highlightedIds.includes(panel.id)
        }"
        @dblclick="openDetail(panel.id)"
      >
        <div class="metric-head">
          <div>
            <span class="metric-category">{{ panel.category }}</span>
            <h2>{{ panel.title }}</h2>
          </div>
          <a-button type="text" size="small" @click="openDetail(panel.id)">详情</a-button>
        </div>
        <div class="metric-value">{{ panel.value }} <small>{{ panel.unit }}</small></div>
        <MetricChart :panel="panel" compact />
        <div class="metric-foot">{{ panel.description }}</div>
      </article>
    </div>

    <a-modal v-model:open="detailOpen" :title="detailPanel?.title" :footer="null" width="760px">
      <div v-if="detailPanel" class="detail-chart">
        <div class="detail-value">{{ detailPanel.value }} <small>{{ detailPanel.unit }}</small></div>
        <p>{{ detailPanel.description }}</p>
        <MetricChart :panel="detailPanel" />
      </div>
    </a-modal>

    <a-drawer v-model:open="drawerOpen" title="组合视图" width="760px">
      <div class="drawer-grid">
        <article v-for="panel in composedPanels" :key="panel.id" class="metric-panel compact">
          <div class="metric-head">
            <div>
              <span class="metric-category">{{ panel.category }}</span>
              <h2>{{ panel.title }}</h2>
            </div>
          </div>
          <div class="metric-value">{{ panel.value }} <small>{{ panel.unit }}</small></div>
          <MetricChart :panel="panel" compact />
        </article>
      </div>
    </a-drawer>
  </section>
</template>
