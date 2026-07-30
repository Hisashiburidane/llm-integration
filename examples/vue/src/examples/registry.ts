import type { Component } from 'vue';
import TextToFormDemo from './TextToFormDemo.vue';
import UseEnchantActionDemo from './UseEnchantActionDemo.vue';
import FocusViewDemo from './FocusViewDemo.vue';
import AsrCustomerServiceDemo from './AsrCustomerServiceDemo.vue';

import expressFormCode from './text-to-form/ExpressForm.vue?raw';
import enchantExpressFormCodeRaw from './text-to-form/EnchantExpressForm.vue?raw';
import apiExpressFormCodeRaw from './text-to-form/ApiExpressForm.vue?raw';
import actionExpressFormCodeRaw from './text-to-form/ActionExpressForm.vue?raw';
import apiActionExpressFormCodeRaw from './text-to-form/ApiActionExpressForm.vue?raw';
import asrDemoCodeRaw from './AsrCustomerServiceDemo.vue?raw';

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
  status: '可运行' | 'TODO';
  summary: string;
  suggestions: string[];
  showAura?: boolean;
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
    timeout: __LLM_TIMEOUT_MS__,
    maxTokens: __LLM_MAX_TOKENS__,
    configError: __LLM_CONFIG_ERROR__
      ? \`\${__LLM_CONFIG_ERROR__}，请检查 examples/vue/.env。\`
      : ''
  }
});

forge.use(createEnchantDebug());

createApp(App).use(Antd).use(forge).mount('#app');`;

const enchantExpressFormCode = stripVueStyleBlock(enchantExpressFormCodeRaw);
const apiExpressFormCode = stripVueStyleBlock(apiExpressFormCodeRaw);
const actionExpressFormCode = stripVueStyleBlock(actionExpressFormCodeRaw);
const apiActionExpressFormCode = stripVueStyleBlock(apiActionExpressFormCodeRaw);
const asrDemoCode = stripVueStyleBlock(asrDemoCodeRaw);

const customerServiceAgentCode = `<script setup lang="ts">
import { useEnchant, useEnchantAction, useEnchantForge } from '@enchantforge/vue';

const enchant = useEnchant();
const forge = useEnchantForge();

useEnchantAction({
  name: 'support.search_knowledge',
  description: '客户描述具体问题后，检索匹配的售后规则。',
  effect: 'read',
  inputSchema: knowledgeQuerySchema,
  execute: ({ query }, context) => forge.retrieveKnowledge({
    query,
    topK: 3,
    signal: context.signal
  })
});

useEnchantAction({
  name: 'support.update_ticket_draft',
  description: '把 ASR 或读取工具确认的信息写入工单草稿，不提交。',
  effect: 'draft',
  inputSchema: ticketDraftSchema,
  execute: updateTicketDraft
});

useEnchantAction({
  name: 'support.present_coaching',
  description: '向人工坐席显示一条下一步建议并高亮相关字段。',
  effect: 'visual',
  inputSchema: coachingSchema,
  execute: presentCoaching
});

useEnchantAction({
  name: 'support.present_emotion_guidance',
  description: '根据累计 ASR 的语言信号更新情绪 Pet。',
  effect: 'visual',
  inputSchema: emotionGuidanceSchema,
  execute: updateEmotionPet
});

async function onOfflineTranscript(latest: string, transcript: string) {
  await enchant.run({
    input: \`本次新增：\${latest}\\n累计转写：\${transcript}\`,
    prompt: [
      '出现订单号时先查询订单 API。',
      '出现具体问题时再检索售后知识库。',
      '只使用 ASR 原文和读取工具返回的事实。',
      '更新工单草稿，并根据订单或规则结果给坐席建议。',
      '根据累计文本更新情绪 Pet，不推断未出现的声学特征。',
      '不得提交工单或承诺退款、换新已经获批。'
    ].join('\\n')
  });
}
</script>`;

const knowledgeProviderCode = `import {
  createEnchantForge,
  createHttpKnowledgeProvider,
  createStaticKnowledgeProvider
} from '@enchantforge/vue';

// 示例与测试：零后端的静态规则。
const knowledge = createStaticKnowledgeProvider({
  id: 'support-demo',
  documents: supportDocuments
});

// 生产环境：后端可以使用 Elasticsearch、OpenSearch、
// Qdrant、Milvus 或其他 hybrid retrieval 实现。
const productionKnowledge = createHttpKnowledgeProvider({
  id: 'support-rag',
  endpoint: '/api/knowledge/retrieve'
});

const forge = createEnchantForge({ knowledge });`;

const supportApiCode = `import {
  createEnchantForge,
  defineEnchantAction,
  defineEnchantApi
} from '@enchantforge/vue';
import { orderService } from './order-service';

const getOrderDetail = defineEnchantAction({
  name: 'support.get_order_detail',
  description: '根据完整订单号查询后台订单详情。',
  effect: 'read',
  inputSchema: {
    type: 'object',
    required: ['orderNo'],
    properties: {
      orderNo: { type: 'string', description: '完整订单号' },
      refresh: {
        type: 'boolean',
        description: '明确要求最新状态时绕过缓存'
      }
    }
  },
  execute: ({ orderNo }, context) =>
    orderService.getOrderDetail(orderNo, context.signal)
});

export const supportApi = defineEnchantApi({
  id: 'customer-service',
  page: 'asr-customer-service',
  actions: [getOrderDetail]
});

// main.ts：安装一次，页面内的 Agent 自动获得这些 tools。
const forge = createEnchantForge().use(supportApi);
createApp(App).use(forge).mount('#app');`;

const supportExecutionPolicyCode = `export const supportExecutionPolicy = {
  name: 'support:execution-policy',
  setup(forge) {
    const recent = new Map();
    return forge.registerExecutionMiddleware(
      async ({ capability, input }, next) => {
        if (capability.name !== 'support.get_order_detail') {
          return next();
        }
        if (input.refresh) return next();

        const key = input.orderNo.trim().toUpperCase();
        const cached = recent.get(key);
        if (cached?.pending) return cached.pending;
        if (cached?.expiresAt > Date.now()) return cached.value;

        const pending = Promise.resolve(next());
        recent.set(key, { pending });
        try {
          const value = await pending;
          recent.set(key, {
            value,
            expiresAt: Date.now() + 5 * 60_000
          });
          return value;
        } catch (error) {
          recent.delete(key);
          throw error;
        }
      }
    );
  }
};

forge.use(supportExecutionPolicy);`;

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

export const demos: DemoSpec[] = [
  {
    id: 'text-to-form',
    title: '快递填表：组件 API',
    status: '可运行',
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
    id: 'use-enchant-action',
    title: '快递填表：定制 Action',
    status: '可运行',
    summary: '只暴露一个应用拥有的异步填表函数，不暴露 model 或通用字段写入能力；执行进度通过 Aura 实时展示。',
    suggestions: shippingSuggestions,
    component: UseEnchantActionDemo,
    codeBlocks: [
      { key: 'form', tab: '原表单组件', code: expressFormCode, language: 'xml' },
      { key: 'action', tab: '定制 Action', code: actionExpressFormCode, language: 'xml', compareTo: 'form' },
      { key: 'wrapper', tab: 'Enchant 边界', code: apiActionExpressFormCode, language: 'xml' },
      { key: 'forge', tab: '应用配置', code: forgeSetupCode, language: 'typescript' },
      { key: 'assistant', tab: '全局助手', code: assistantUsageCode('use-enchant-action', shippingSuggestions), language: 'xml' }
    ]
  },
  {
    id: 'asr-customer-service',
    title: '实时坐席辅助',
    status: '可运行',
    summary: '三种人物语速的 ASR online/offline 数据流；业务组件主动触发 Agent，查询订单 API、检索售后知识、识别表达情绪、更新工单草稿并提示人工坐席。',
    suggestions: [],
    showAura: false,
    component: AsrCustomerServiceDemo,
    codeBlocks: [
      { key: 'wrapper', tab: 'Enchant 边界', code: asrDemoCode, language: 'xml' },
      { key: 'agent', tab: '业务触发与 Tools', code: customerServiceAgentCode, language: 'typescript' },
      { key: 'app-api', tab: '应用 API', code: supportApiCode, language: 'typescript' },
      { key: 'execution-policy', tab: '执行策略', code: supportExecutionPolicyCode, language: 'typescript' },
      { key: 'knowledge', tab: 'Knowledge Provider', code: knowledgeProviderCode, language: 'typescript' }
    ]
  },
  {
    id: 'focus-view',
    title: 'K8s Focus View',
    status: '可运行',
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
