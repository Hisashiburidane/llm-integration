import type { Component } from 'vue';
import TextToFormDemo from './TextToFormDemo.vue';
import DomTextToFormDemo from './DomTextToFormDemo.vue';
import TodoDemo from './TodoDemo.vue';
import FocusViewDemo from './FocusViewDemo.vue';

import expressFormCode from './text-to-form/ExpressForm.vue?raw';
import enchantExpressFormCodeRaw from './text-to-form/EnchantExpressForm.vue?raw';
import apiExpressFormCodeRaw from './text-to-form/ApiExpressForm.vue?raw';
import domScanExpressFormCodeRaw from './text-to-form/DomScanExpressForm.vue?raw';

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
import '@enchantforge/vue/style.css';
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
import { panelGroups } from './focus/k8sDashboard';
</script>

<template>
  <section class="k8s-board">
    <section v-for="group in panelGroups" :key="group.category">
      <article v-for="panel in group.panels" :key="panel.id">
        <!-- 原有 Panel 内容 -->
      </article>
    </section>
  </section>
</template>`;

const focusViewIntegrationCode = `<script setup lang="ts">
import { Enchant } from '@enchantforge/vue';
import { focusViewCapabilities } from './focus/focus-view-capabilities';
import { panelGroups } from './focus/k8sDashboard';
</script>

<template>
  <Enchant
    name="focus-dashboard"
    page="focus-view"
    kind="page"
    prompt="根据用户要求高亮、打开或组合监控面板。"
    :capabilities="focusViewCapabilities"
  >
    <section class="k8s-board">
      <section v-for="group in panelGroups" :key="group.category">
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
            priority: panel.priority
          }]"
        >
          <!-- 原有 Panel 内容保持不变 -->
        </Enchant>
      </section>
    </section>
  </Enchant>
</template>`;

const focusViewCapabilityCode = `import { reactive } from 'vue';
import type { EnchantCapabilityDefinition } from '@enchantforge/vue';
import { k8sPanels, type K8sPanel } from './k8sDashboard';

const focusViewState = reactive({
  highlightedPanelIds: [] as string[]
});

const highlightCapability: EnchantCapabilityDefinition = {
  id: 'focus-view:highlight-panels',
  owner: 'application',
  provider: 'focus-view',
  name: 'dashboard.highlight',
  label: '高亮监控面板',
  description: '根据 panelIds 或 priority 高亮相关面板。',
  effect: 'visual',
  inputSchema: {
    type: 'object',
    properties: {
      panelIds: { type: 'array', items: { type: 'string' } },
      priority: {
        type: 'string',
        enum: ['normal', 'warning', 'critical']
      }
    }
  },
  execute(input) {
    const selection = input as {
      panelIds?: string[];
      priority?: K8sPanel['priority'];
    };
    const panelIds = selection.priority
      ? k8sPanels
          .filter((panel) => panel.priority === selection.priority)
          .map((panel) => panel.id)
      : selection.panelIds ?? [];

    focusViewState.highlightedPanelIds = panelIds;
    return {
      status: 'success',
      summary: \`已高亮 \${panelIds.length} 个面板。\`
    };
  }
};`;

const shippingSuggestions = [
  '阿尔萨斯·米奈希尔，13800138000，黑龙江省哈尔滨市道里区冰封大道 9 号。1:1 霜之哀伤复刻模型，木箱加固。',
  '伊利丹·怒风，18600001234，上海市浦东新区张江路 88 号。星战双刃光剑模型，配 GP 超霸 Greencell 电池。',
  '亚瑟·摩根，13912345678，内蒙古自治区呼伦贝尔市额尔古纳市黑水镇马掌路 2 号。全套 144 张香烟卡，防潮勿折。'
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
      { key: 'component', tab: '接入组件', code: focusViewIntegrationCode, language: 'xml', compareTo: 'original' },
      { key: 'capabilities', tab: '语义高亮', code: focusViewCapabilityCode, language: 'typescript' },
      { key: 'forge', tab: '应用配置', code: forgeSetupCode, language: 'typescript' },
      { key: 'assistant', tab: '全局助手', code: assistantUsageCode('focus-view', focusViewSuggestions), language: 'xml' }
    ]
  }
];
