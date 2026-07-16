import type { Component } from 'vue';
import TextToFormDemo from './TextToFormDemo.vue';
import TodoDemo from './TodoDemo.vue';
import FocusViewDemo from './FocusViewDemo.vue';

import expressFormCode from './text-to-form/ExpressForm.vue?raw';
import aiExpressFormCodeRaw from './text-to-form/AiExpressForm.vue?raw';
import focusViewDemoCodeRaw from './FocusViewDemo.vue?raw';

export type CodeBlock = {
  key: string;
  tab: string;
  code: string;
  language?: 'typescript' | 'javascript' | 'xml' | 'json';
  compareTo?: string;
};

export type DemoSpec = {
  id: string;
  title: string;
  status: '真实 API' | 'TODO';
  summary: string;
  component: Component;
  codeBlocks: CodeBlock[];
};

function stripVueStyleBlock(code: string) {
  return code.replace(/\n<style[\s\S]*?<\/style>\s*$/i, '').trimEnd();
}

function assistantUsageCode(page: string) {
  return `<script setup lang="ts">
import { Aura } from '@enchantforge/vue';
</script>

<template>
  <Aura page="${page}" />
</template>`;
}

const forgeSetupCode = `import { createApp } from 'vue';
import Antd from 'ant-design-vue';
import { createEnchantDebug, createEnchantForge } from '@enchantforge/vue';
import App from './App.vue';

const forge = createEnchantForge({
  llm: {
    model: __LLM_MODEL__,
    configError: __LLM_CONFIG_ERROR__
      ? \`\${__LLM_CONFIG_ERROR__}，请检查 examples/vue/.env。\`
      : ''
  }
});

forge.use(createEnchantDebug());

createApp(App).use(Antd).use(forge).mount('#app');`;

const aiExpressFormCode = stripVueStyleBlock(aiExpressFormCodeRaw);
const focusViewCode = stripVueStyleBlock(focusViewDemoCodeRaw);

const originalTextToFormPageCode = `<script setup lang="ts">
import ExpressForm from './ExpressForm.vue';
import { shippingFormState } from './shippingFormStore';
</script>

<template>
  <a-card title="快递表单" size="small" class="demo-card">
    <ExpressForm v-model="shippingFormState" />
  </a-card>
</template>`;

const originalFocusViewCode = `<script setup lang="ts">
import { computed, ref } from 'vue';
import { k8sPanels, panelGroups, type K8sPanel } from './focus/k8sDashboard';
import EChart from './focus/EChart.vue';

const highlightedIds = ref<string[]>([]);
const activePanelId = ref('');
const composedPanelIds = ref<string[]>([]);

const activePanel = computed(() => k8sPanels.find((panel) => panel.id === activePanelId.value));
const composedPanels = computed(() =>
  composedPanelIds.value
    .map((id) => k8sPanels.find((panel) => panel.id === id))
    .filter((panel): panel is K8sPanel => Boolean(panel))
);

function latestValue(panel: K8sPanel) {
  return panel.values[panel.values.length - 1];
}

function openPanel(panelId: string) {
  activePanelId.value = panelId;
}

function closeDetail() {
  activePanelId.value = '';
}

function clearComposed() {
  composedPanelIds.value = [];
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
          <article
            v-for="panel in group.panels"
            :key="panel.id"
            class="metric-panel"
            :class="[
              'priority-' + panel.priority,
              { highlighted: highlightedIds.includes(panel.id), dimmed: highlightedIds.length && !highlightedIds.includes(panel.id) }
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
        </div>
      </section>
    </section>

    <a-modal :open="Boolean(activePanel)" :title="activePanel?.title" width="860px" :footer="null" @cancel="closeDetail">
      <EChart v-if="activePanel" class="detail-chart" :option="activePanel.option" />
      <a-alert v-if="activePanel" type="info" show-icon :message="activePanel.summary" />
    </a-modal>

    <a-drawer :open="composedPanels.length > 0" title="Focus Sub-dashboard" width="76vw" @close="clearComposed">
      <div class="composed-grid">
        <article v-for="panel in composedPanels" :key="panel.id" class="composed-panel">
          <h3>{{ panel.title }}</h3>
          <EChart class="composed-chart" :option="panel.option" />
          <p>{{ panel.summary }}</p>
        </article>
      </div>
    </a-drawer>
  </div>
</template>`;

const todo = (id: string, title: string, summary: string): DemoSpec => ({
  id,
  title,
  status: 'TODO',
  summary,
  component: TodoDemo,
  codeBlocks: []
});

export const demos: DemoSpec[] = [
  {
    id: 'text-to-form',
    title: '自动填表',
    status: '真实 API',
    summary: 'Enchant 自动扫描现有表单并发布字段 metadata 与受限填写 capability；Aura 使用当前页面 snapshot 完成字段映射和草稿写入。',
    component: TextToFormDemo,
    codeBlocks: [
      { key: 'form', tab: '表单组件', code: expressFormCode, language: 'xml' },
      { key: 'page-before', tab: '页面接入前', code: originalTextToFormPageCode, language: 'xml' },
      { key: 'wrapper', tab: '接入层组件', code: aiExpressFormCode, language: 'xml' },
      { key: 'forge', tab: '应用配置', code: forgeSetupCode, language: 'typescript' },
      { key: 'assistant', tab: '全局助手', code: assistantUsageCode('text-to-form'), language: 'xml' }
    ]
  },
  todo('asr-ticket', 'ASR 转工单', '等待接入真实 ASR 输入、工单表单和受限 executor。'),
  todo('validation-helper', '校验助手', '等待接入真实表单校验状态、错误解释和字段聚焦。'),
  todo('snapshot-restore', '语义快照', '等待实现快照解析、用户确认和真实页面状态回放。'),
  todo('workflow', '本地工作流', '等待实现动作计划审核、持久化和重复执行。'),
  {
    id: 'focus-view',
    title: 'K8s Focus View',
    status: '真实 API',
    summary: '页面只负责渲染图表和响应 page focus state。全局助手读取 panel metadata 后，直接执行高亮、打开和组合视图。',
    component: FocusViewDemo,
    codeBlocks: [
      { key: 'original', tab: '原组件', code: originalFocusViewCode, language: 'xml' },
      { key: 'component', tab: '接入组件', code: focusViewCode, language: 'xml', compareTo: 'original' },
      { key: 'assistant', tab: '全局助手', code: assistantUsageCode('focus-view'), language: 'xml' }
    ]
  }
];
