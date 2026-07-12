<script setup lang="ts">
import { computed, ref } from 'vue';
import { BubbleList, Sender } from 'ant-design-x-vue';
import { LlmIntegration, useLlmScopeRegistry, type MetadataNode } from '@llm-ui/vue';
import { createFocusPlan, type FocusAction } from '../llmClient';
import { k8sPanels, panelGroups, type K8sPanel } from './focus/k8sDashboard';
import EChart from './focus/EChart.vue';
import CodeTabs from './CodeTabs.vue';
import type { DemoSpec } from './registry';

const props = defineProps<{ demo: DemoSpec }>();

type ChatMessage = { key: number; role: 'assistant' | 'user'; content: string };

const scopes = useLlmScopeRegistry();
const input = ref('分析当前网络异常，高亮相关面板并组合一个子 dashboard');
const loading = ref(false);
const assistantOpen = ref(false);
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

function latestValue(panel: K8sPanel) {
  return panel.values[panel.values.length - 1];
}

function panelMetadata(panel: K8sPanel): MetadataNode[] {
  return [
    { id: `${panel.id}:metric`, label: panel.metric, type: 'metric', aliases: panel.tags },
    { id: `${panel.id}:summary`, label: panel.summary, type: 'summary' },
    { id: `${panel.id}:priority`, label: panel.priority, type: 'priority' },
    { id: `${panel.id}:current`, label: `${latestValue(panel)}${panel.unit}`, type: 'currentValue' },
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
                <div class="panel-value"><strong>{{ latestValue(panel) }}</strong><span>{{ panel.unit }}</span></div>
                <EChart class="panel-chart" :option="panel.option" />
                <p>{{ panel.summary }}</p>
              </article>
            </LlmIntegration>
          </div>
        </section>
      </section>

      <button v-if="!assistantOpen" class="assistant-launch" type="button" @click="assistantOpen = true">
        <span>AI</span><strong>Focus Assistant</strong><i></i>
      </button>
      <aside v-else class="focus-chat">
        <div class="chat-heading">
          <span class="chat-mark">AI</span>
          <div><strong>Focus View Assistant</strong><small>scope-aware workflow</small></div>
          <button class="chat-close" type="button" aria-label="关闭助手" @click="assistantOpen = false">×</button>
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
      <EChart v-if="activePanel" class="detail-chart" :option="activePanel.option" />
      <a-alert v-if="activePanel" type="info" show-icon :message="activePanel.summary" />
    </a-modal>

    <a-drawer :open="composedPanels.length > 0" title="AI Focus Sub-dashboard" width="76vw" @close="composedPanels = []">
      <div class="composed-grid">
        <article v-for="panel in composedPanels" :key="panel.id" class="composed-panel">
          <h3>{{ panel.title }}</h3>
          <EChart class="composed-chart" :option="panel.option" />
          <p>{{ panel.summary }}</p>
        </article>
      </div>
    </a-drawer>
  </LlmIntegration>
</template>

<style scoped>
.focus-shell { position: relative; }
.k8s-board { min-width: 0; border: 1px solid #d8d9da; border-radius: 4px; background: #f4f5f5; overflow: hidden; box-shadow: 0 1px 3px #1b1b1b1a; }
.board-header { padding: 22px 24px; display: flex; justify-content: space-between; gap: 20px; color: #52545c; background: #ffffff; border-bottom: 1px solid #d8d9da; }
.board-header h2 { margin: 4px 0 0; color: #24292e; font: 600 22px/1.1 "IBM Plex Sans", sans-serif; }
.board-kicker { margin: 0; color: #5794f2; font: 700 10px/1 monospace; letter-spacing: .14em; }
.board-status { display: flex; gap: 16px; align-items: center; color: #c1d8d0; font-size: 12px; }
.healthy-dot { display: inline-block; width: 7px; height: 7px; margin-right: 6px; border-radius: 50%; background: #62d79b; box-shadow: 0 0 0 4px #62d79b22; }
.metric-group { padding: 18px 18px 4px; }
.group-heading { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
.group-heading h3 { margin: 0; color: #52545c; font: 700 12px/1 monospace; letter-spacing: .06em; text-transform: uppercase; }
.group-heading span { color: #8e8e8e; font: 10px/1 monospace; }
.panel-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.metric-panel { position: relative; min-width: 0; padding: 13px; border: 1px solid #d8d9da; border-radius: 3px; background: #ffffff; transition: opacity .25s, transform .25s, border-color .25s, box-shadow .25s; cursor: default; overflow: hidden; }
.metric-panel header { display: flex; justify-content: space-between; gap: 8px; }
.metric-panel header { position: relative; z-index: 1; }
.metric-panel header span { display: block; color: #24292e; font-weight: 600; font-size: 13px; }
.metric-panel header code { display: block; max-width: 170px; margin-top: 3px; overflow: hidden; color: #8e8e8e; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.metric-panel p { position: relative; z-index: 1; min-height: 32px; margin: 6px 0 0; color: #6e6e6e; font-size: 10px; line-height: 1.45; }
.panel-value { position: absolute; z-index: 2; top: 48px; left: 16px; color: #24292e; font-family: "IBM Plex Mono", monospace; }
.panel-value strong { font-size: 22px; letter-spacing: -.04em; }
.panel-value span { margin-left: 3px; color: #8e8e8e; font-size: 9px; }
.panel-chart { height: 132px; }
.metric-panel.highlighted { z-index: 1; border-color: #5794f2; box-shadow: 0 0 0 2px #5794f233, 0 8px 20px #5794f226; transform: translateY(-3px); }
.metric-panel.dimmed { opacity: .22; filter: grayscale(.65); }
.assistant-launch { position: fixed; z-index: 30; right: 24px; bottom: 24px; display: flex; gap: 10px; align-items: center; padding: 9px 14px 9px 9px; border: 1px solid #327e68; border-radius: 999px; color: #eafff7; background: #0c3028; box-shadow: 0 12px 38px #071f18a8, 0 0 0 4px #2df2ae17; cursor: pointer; }
.assistant-launch span { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 50%; color: #08251d; background: #68e9b5; font: 800 10px/1 monospace; }
.assistant-launch strong { font-size: 12px; }
.assistant-launch i { width: 7px; height: 7px; border-radius: 50%; background: #5df1b5; box-shadow: 0 0 10px #5df1b5; }
.focus-chat { position: fixed; z-index: 30; right: 24px; bottom: 24px; display: flex; flex-direction: column; width: min(380px, calc(100vw - 32px)); height: min(620px, calc(100vh - 110px)); padding: 16px; border: 1px solid #b9cec6; border-radius: 14px; background: #f8fbfa; box-shadow: 0 24px 70px #071f1866; animation: assistant-in .22s ease-out both; }
.chat-heading { display: flex; gap: 10px; align-items: center; padding-bottom: 13px; border-bottom: 1px solid #e0e8e4; }
.chat-heading small, .chat-heading strong { display: block; }
.chat-heading small { margin-top: 2px; color: #78867f; font-size: 10px; }
.chat-close { margin-left: auto; border: 0; color: #587168; background: transparent; font-size: 25px; line-height: 1; cursor: pointer; }
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
@keyframes assistant-in { from { opacity: 0; transform: translateY(12px) scale(.97); } }
@media (max-width: 760px) { .panel-grid, .composed-grid { grid-template-columns: 1fr; } .board-status { display: none; } }
</style>
