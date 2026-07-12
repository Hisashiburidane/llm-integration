<script setup lang="ts">
import { computed, ref } from 'vue';
import { BubbleList, Sender } from 'ant-design-x-vue';
import { LlmIntegration, useLlmScopeRegistry, type MetadataNode } from '@llm-ui/vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { createFocusPlan, type FocusAction } from '../llmClient';
import { k8sPanels, panelGroups, type K8sPanel } from './focus/k8sDashboard';
import CodeTabs from './CodeTabs.vue';
import type { DemoSpec } from './registry';

const props = defineProps<{ demo: DemoSpec }>();
use([CanvasRenderer, LineChart, BarChart, GridComponent, TooltipComponent]);

type ChatMessage = { key: number; role: 'assistant' | 'user'; content: string };

const scopes = useLlmScopeRegistry();
const input = ref('分析当前网络异常，高亮相关面板并组合一个子 dashboard');
const loading = ref(false);
const highlightedIds = ref<string[]>([]);
const activePanel = ref<K8sPanel>();
const composedPanels = ref<K8sPanel[]>([]);
const messages = ref<ChatMessage[]>([
  { key: 1, role: 'assistant', content: '我可以读取当前大屏中每个 panel wrapper 暴露的 metadata。试试让我排查网络、Pod 或存储问题。' }
]);

const bubbleRoles = {
  assistant: { placement: 'start' as const },
  user: { placement: 'end' as const, variant: 'filled' as const }
};
const registeredPanelScopes = computed(() => scopes.value.filter((scope) => k8sPanels.some((panel) => panel.id === scope.id)));

function panelMetadata(panel: K8sPanel): MetadataNode[] {
  return [
    { id: `${panel.id}:metric`, label: panel.metric, type: 'metric', aliases: panel.tags },
    { id: `${panel.id}:summary`, label: panel.summary, type: 'summary' },
    { id: `${panel.id}:priority`, label: panel.priority, type: 'priority' },
    { id: `${panel.id}:category`, label: panel.categoryLabel, type: 'category' }
  ];
}

function resolvePanels(ids: string[]) {
  return ids.map((id) => k8sPanels.find((panel) => panel.id === id)).filter((panel): panel is K8sPanel => Boolean(panel));
}

async function executeAction(action: FocusAction) {
  if (action.type === 'clear') {
    highlightedIds.value = [];
    activePanel.value = undefined;
    composedPanels.value = [];
  } else if (action.type === 'highlight') {
    highlightedIds.value = [...new Set(action.panelIds)];
  } else if (action.type === 'open') {
    activePanel.value = resolvePanels(action.panelIds)[0];
  } else if (action.type === 'compose') {
    composedPanels.value = resolvePanels(action.panelIds).slice(0, 6);
    highlightedIds.value = composedPanels.value.map((panel) => panel.id);
  }
  await new Promise((resolve) => globalThis.setTimeout(resolve, 260));
}

async function submit(message: string) {
  const question = message.trim();
  if (!question || loading.value) return;
  input.value = '';
  messages.value.push({ key: Date.now(), role: 'user', content: question });
  loading.value = true;
  try {
    const plan = await createFocusPlan(question, registeredPanelScopes.value);
    for (const action of plan.actions) await executeAction(action);
    messages.value.push({ key: Date.now() + 1, role: 'assistant', content: plan.message });
  } catch (error) {
    messages.value.push({
      key: Date.now() + 1,
      role: 'assistant',
      content: error instanceof Error ? `执行失败：${error.message}` : '执行失败：未知错误。'
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <LlmIntegration
    name="k8s-operations-dashboard"
    prompt="帮助用户从已注册的 Kubernetes 指标 panel 中创建 Focus View。"
    :register-global="false"
  >
    <div class="focus-shell">
      <section class="k8s-board">
        <header class="board-header">
          <div>
            <p class="board-kicker">PROD / CN-EAST-1</p>
            <h2>Kubernetes Operations Center</h2>
          </div>
          <div class="board-status">
            <span><i class="healthy-dot"></i> 47 / 48 nodes ready</span>
            <span>{{ registeredPanelScopes.length }} panel scopes</span>
          </div>
        </header>

        <section v-for="group in panelGroups" :key="group.category" class="metric-group">
          <div class="group-heading">
            <h3>{{ group.label }}</h3>
            <span>{{ group.panels.length }} panels</span>
          </div>
          <div class="panel-grid">
            <LlmIntegration
              v-for="panel in group.panels"
              :key="panel.id"
              :name="panel.id"
              :prompt="`Interpret ${panel.title} only in the current K8s dashboard context.`"
              :metadata="panelMetadata(panel)"
            >
              <article
                class="metric-panel"
                :class="[
                  `priority-${panel.priority}`,
                  { highlighted: highlightedIds.includes(panel.id), dimmed: highlightedIds.length && !highlightedIds.includes(panel.id) }
                ]"
                @dblclick="activePanel = panel"
              >
                <header>
                  <div><span>{{ panel.title }}</span><code>{{ panel.metric }}</code></div>
                  <a-tag :color="panel.priority === 'critical' ? 'red' : panel.priority === 'warning' ? 'orange' : 'green'">{{ panel.priority }}</a-tag>
                </header>
                <v-chart class="panel-chart" :option="panel.option" autoresize />
                <p>{{ panel.summary }}</p>
              </article>
            </LlmIntegration>
          </div>
        </section>
      </section>

      <aside class="focus-chat">
        <div class="chat-heading">
          <span class="chat-mark">AI</span>
          <div><strong>Focus View Assistant</strong><small>scope-aware workflow</small></div>
        </div>
        <BubbleList class="chat-messages" :items="messages" :roles="bubbleRoles" auto-scroll />
        <div class="prompt-chips">
          <button @click="submit('排查 Pod 重启和内存压力，组合相关面板')">Pod instability</button>
          <button @click="submit('打开最需要关注的存储面板')">Storage risk</button>
          <button @click="submit('清除当前 Focus View')">Clear focus</button>
        </div>
        <Sender v-model:value="input" :loading="loading" placeholder="描述你要关注的运维问题" @submit="submit" />
      </aside>
    </div>

    <CodeTabs :blocks="props.demo.codeBlocks" />

    <a-modal :open="Boolean(activePanel)" :title="activePanel?.title" width="860px" :footer="null" @cancel="activePanel = undefined">
      <v-chart v-if="activePanel" class="detail-chart" :option="activePanel.option" autoresize />
      <a-alert v-if="activePanel" type="info" show-icon :message="activePanel.summary" />
    </a-modal>

    <a-drawer :open="composedPanels.length > 0" title="AI Focus Sub-dashboard" width="76vw" @close="composedPanels = []">
      <div class="composed-grid">
        <article v-for="panel in composedPanels" :key="panel.id" class="composed-panel">
          <h3>{{ panel.title }}</h3>
          <v-chart class="composed-chart" :option="panel.option" autoresize />
          <p>{{ panel.summary }}</p>
        </article>
      </div>
    </a-drawer>
  </LlmIntegration>
</template>

<style scoped>
.focus-shell { display: grid; grid-template-columns: minmax(0, 1fr) 350px; gap: 18px; align-items: start; }
.k8s-board { min-width: 0; border: 1px solid #cad8d2; border-radius: 12px; background: #e9efec; overflow: hidden; }
.board-header { padding: 22px 24px; display: flex; justify-content: space-between; gap: 20px; color: #e9fff6; background: linear-gradient(120deg, #102f2a, #1d5145); }
.board-header h2 { margin: 4px 0 0; color: white; font: 700 24px/1.1 Georgia, serif; }
.board-kicker { margin: 0; color: #6ed7a3; font: 700 10px/1 monospace; letter-spacing: .14em; }
.board-status { display: flex; gap: 16px; align-items: center; color: #c1d8d0; font-size: 12px; }
.healthy-dot { display: inline-block; width: 7px; height: 7px; margin-right: 6px; border-radius: 50%; background: #62d79b; box-shadow: 0 0 0 4px #62d79b22; }
.metric-group { padding: 18px 18px 4px; }
.group-heading { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
.group-heading h3 { margin: 0; font: 700 13px/1 monospace; letter-spacing: .06em; text-transform: uppercase; }
.group-heading span { color: #718079; font-size: 11px; }
.panel-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.metric-panel { min-width: 0; padding: 13px; border: 1px solid #d4ded9; border-radius: 8px; background: #fff; transition: opacity .25s, transform .25s, border-color .25s, box-shadow .25s; cursor: default; }
.metric-panel header { display: flex; justify-content: space-between; gap: 8px; }
.metric-panel header span { display: block; font-weight: 700; font-size: 13px; }
.metric-panel header code { display: block; max-width: 170px; margin-top: 3px; overflow: hidden; color: #819089; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.metric-panel p { min-height: 32px; margin: 6px 0 0; color: #66736e; font-size: 10px; line-height: 1.45; }
.panel-chart { height: 132px; }
.metric-panel.highlighted { z-index: 1; border-color: #19a974; box-shadow: 0 0 0 3px #19a97422, 0 12px 24px #143e3020; transform: translateY(-3px); }
.metric-panel.dimmed { opacity: .22; filter: grayscale(.65); }
.focus-chat { position: sticky; top: 16px; display: flex; flex-direction: column; height: min(760px, calc(100vh - 110px)); padding: 16px; border: 1px solid #cbd9d3; border-radius: 12px; background: #f8fbfa; box-shadow: 0 18px 48px #183b3020; }
.chat-heading { display: flex; gap: 10px; align-items: center; padding-bottom: 13px; border-bottom: 1px solid #e0e8e4; }
.chat-heading small, .chat-heading strong { display: block; }
.chat-heading small { margin-top: 2px; color: #78867f; font-size: 10px; }
.chat-mark { display: grid; width: 36px; height: 36px; place-items: center; border-radius: 10px; color: white; background: #153f35; font: 700 11px/1 monospace; }
.chat-messages { flex: 1; min-height: 0; padding: 14px 0; overflow-y: auto; }
.prompt-chips { display: flex; gap: 6px; padding: 8px 0; overflow-x: auto; }
.prompt-chips button { flex: none; padding: 5px 8px; border: 1px solid #c9d8d2; border-radius: 999px; color: #31584c; background: white; font-size: 10px; cursor: pointer; }
.detail-chart { height: 480px; }
.composed-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.composed-panel { padding: 16px; border: 1px solid #dce5e1; border-radius: 10px; }
.composed-panel h3 { margin: 0; }
.composed-panel p { color: #66736e; }
.composed-chart { height: 260px; }
@media (max-width: 1200px) { .focus-shell { grid-template-columns: 1fr; } .focus-chat { position: static; height: 560px; } }
@media (max-width: 760px) { .panel-grid, .composed-grid { grid-template-columns: 1fr; } .board-status { display: none; } }
</style>
