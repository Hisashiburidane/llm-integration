import type { Component } from 'vue';
import TextToFormDemo from './TextToFormDemo.vue';
import DomTextToFormDemo from './DomTextToFormDemo.vue';
import TodoDemo from './TodoDemo.vue';
import FocusViewDemo from './FocusViewDemo.vue';

import expressFormCode from './text-to-form/ExpressForm.vue?raw';
import enchantExpressFormCodeRaw from './text-to-form/EnchantExpressForm.vue?raw';
import apiExpressFormCodeRaw from './text-to-form/ApiExpressForm.vue?raw';
import domScanExpressFormCodeRaw from './text-to-form/DomScanExpressForm.vue?raw';
import focusViewDemoCodeRaw from './FocusViewDemo.vue?raw';
import focusViewCapabilitiesCodeRaw from './focus/focus-view-capabilities.ts?raw';

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
  suggestions: string[];
  component: Component;
  codeBlocks: CodeBlock[];
};

function stripVueStyleBlock(code: string) {
  return code.replace(/\n<style[\s\S]*?<\/style>\s*$/i, '').trimEnd();
}

function assistantUsageCode(page: string, suggestions: string[]) {
  return `<script setup lang="ts">
import { Aura } from '@enchantforge/vue';

const suggestions = ${JSON.stringify(suggestions, null, 2)};
</script>

<template>
  <Aura page="${page}" :suggestions="suggestions" />
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

const enchantExpressFormCode = stripVueStyleBlock(enchantExpressFormCodeRaw);
const apiExpressFormCode = stripVueStyleBlock(apiExpressFormCodeRaw);
const domScanExpressFormCode = stripVueStyleBlock(domScanExpressFormCodeRaw);
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

const shippingSuggestions = [
  '阿尔萨斯·米奈希尔，13800138000，黑龙江省哈尔滨市道里区冰封大道 9 号。霜之哀伤，易碎。',
  '伊利丹·怒风，18600001234，上海市浦东新区张江路 88 号。双刃光剑，放门口。',
  '亚瑟·摩根，13912345678，内蒙古自治区呼伦贝尔市额尔古纳市黑水镇马掌路 2 号。马匹复苏剂，迈卡拒收。'
];

const focusViewSuggestions = [
  '高亮当前所有 critical 状态的监控面板。',
  '定位节点内存压力和 Pod OOM 相关面板。',
  '打开 Ingress 5xx Rate 面板查看详情。',
  '组合一个包含节点 CPU、节点内存和 Pending Pods 的子 Dashboard。'
];

const todo = (id: string, title: string, summary: string): DemoSpec => ({
  id,
  title,
  status: 'TODO',
  summary,
  suggestions: [],
  component: TodoDemo,
  codeBlocks: []
});

export const demos: DemoSpec[] = [
  {
    id: 'text-to-form',
    title: '快递填表：组件 API',
    status: '真实 API',
    summary: '推荐接入方式。表单通过 useEnchantForm 提供字段 metadata 和响应式写入 capability，不读取 DOM。',
    suggestions: shippingSuggestions,
    component: TextToFormDemo,
    codeBlocks: [
      { key: 'form', tab: '原表单组件', code: expressFormCode, language: 'xml' },
      { key: 'enhanced-form', tab: '接入后的表单', code: enchantExpressFormCode, language: 'xml', compareTo: 'form' },
      { key: 'wrapper', tab: 'Enchant 边界', code: apiExpressFormCode, language: 'xml' },
      { key: 'forge', tab: '应用配置', code: forgeSetupCode, language: 'typescript' },
      { key: 'assistant', tab: '全局助手', code: assistantUsageCode('text-to-form', shippingSuggestions), language: 'xml' }
    ]
  },
  {
    id: 'text-to-form-dom',
    title: '快递填表：DOM 扫描',
    status: '真实 API',
    summary: '最低改造成本的兼容模式。显式配置 scan="auto" 后扫描局部 DOM，并通过浏览器 input/change/blur 事件写入表单。',
    suggestions: shippingSuggestions,
    component: DomTextToFormDemo,
    codeBlocks: [
      { key: 'form', tab: '表单组件', code: expressFormCode, language: 'xml' },
      { key: 'page-before', tab: '页面接入前', code: originalTextToFormPageCode, language: 'xml' },
      { key: 'wrapper', tab: 'DOM 扫描接入', code: domScanExpressFormCode, language: 'xml' },
      { key: 'forge', tab: '应用配置', code: forgeSetupCode, language: 'typescript' },
      { key: 'assistant', tab: '全局助手', code: assistantUsageCode('text-to-form-dom', shippingSuggestions), language: 'xml' }
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
    summary: 'Enchant 负责采集 panel metadata；Dashboard 在应用层注册高亮、详情和组合 capability，并拥有对应视图状态。',
    suggestions: focusViewSuggestions,
    component: FocusViewDemo,
    codeBlocks: [
      { key: 'original', tab: '原组件', code: originalFocusViewCode, language: 'xml' },
      { key: 'component', tab: '接入组件', code: focusViewCode, language: 'xml', compareTo: 'original' },
      { key: 'capabilities', tab: '页面能力', code: focusViewCapabilitiesCodeRaw, language: 'typescript' },
      { key: 'assistant', tab: '全局助手', code: assistantUsageCode('focus-view', focusViewSuggestions), language: 'xml' }
    ]
  }
];
