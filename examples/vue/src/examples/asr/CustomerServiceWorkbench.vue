<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import type { EnchantProgressEvent } from '@enchantforge/vue';
import { asrScenarios } from './asr-simulation';
import {
  useCustomerServiceAgent,
  type AssistantNotice,
  type TicketDraft,
  type TicketField
} from './useCustomerServiceAgent';

type SimulationPhase = 'idle' | 'listening' | 'analyzing' | 'completed';
type PendingAnalysis = { latest: string; transcript: string };

const emptyDraft = (): TicketDraft => ({
  customerName: '',
  orderNo: '',
  category: '',
  product: '',
  issue: '',
  request: '',
  contactWindow: '',
  urgency: ''
});

const fieldRows: Array<{ key: TicketField; label: string; multiline?: boolean }> = [
  { key: 'customerName', label: '客户姓名' },
  { key: 'orderNo', label: '订单号' },
  { key: 'category', label: '问题分类' },
  { key: 'product', label: '相关商品' },
  { key: 'issue', label: '问题描述', multiline: true },
  { key: 'request', label: '客户诉求' },
  { key: 'contactWindow', label: '联系时段' },
  { key: 'urgency', label: '紧急程度' }
];

const draft = reactive<TicketDraft>(emptyDraft());
const offlineSegments = ref<Array<{ id: string; text: string }>>([]);
const onlineText = ref('');
const highlightedFields = ref<TicketField[]>([]);
const notices = ref<AssistantNotice[]>([]);
const phase = ref<SimulationPhase>('idle');
const asrStatus = ref('等待通话接入');
const agentStatus = ref('等待稳定的 offline 文本');
const agentRunning = ref(false);
const activeUtterance = ref(0);
const selectedScenarioId = ref(asrScenarios[0].id);
let runId = 0;
let controller: AbortController | undefined;

const { analyzeTranscript } = useCustomerServiceAgent(draft, highlightedFields, notices);
const scenario = computed(() =>
  asrScenarios.find((item) => item.id === selectedScenarioId.value) ?? asrScenarios[0]);

const phaseLabel = computed(() => ({
  idle: '待机',
  listening: '在线识别',
  analyzing: 'Agent 分析',
  completed: '通话结束'
}[phase.value]));

const isRunning = computed(() => phase.value === 'listening' || phase.value === 'analyzing');
const completion = computed(() => Math.round((activeUtterance.value / scenario.value.utterances.length) * 100));
const checkpointCount = computed(() =>
  scenario.value.utterances.filter((utterance) => utterance.checkpoint).length);
const runtimeDetail = computed(() => agentRunning.value
  ? `ASR：${asrStatus.value} / Agent：${agentStatus.value}`
  : asrStatus.value);

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

function reset() {
  runId += 1;
  controller?.abort(new Error('模拟已重置。'));
  controller = undefined;
  Object.assign(draft, emptyDraft());
  offlineSegments.value = [];
  onlineText.value = '';
  highlightedFields.value = [];
  notices.value = [];
  phase.value = 'idle';
  asrStatus.value = '等待通话接入';
  agentStatus.value = '等待稳定的 offline 文本';
  agentRunning.value = false;
  activeUtterance.value = 0;
}

function selectScenario(scenarioId: string) {
  if (isRunning.value || scenarioId === selectedScenarioId.value) return;
  reset();
  selectedScenarioId.value = scenarioId;
}

function progressLabel(event: EnchantProgressEvent) {
  if (event.detail) return event.detail;
  if (event.capabilityLabel) return event.capabilityLabel;
  return {
    capturing: '正在读取客服工作台上下文',
    planning: '正在理解离线转写',
    authorizing: '正在检查工具权限',
    executing: '正在调用业务工具',
    responding: '正在整理坐席建议',
    completed: '本轮分析完成',
    failed: '本轮分析失败'
  }[event.phase];
}

async function startSimulation() {
  reset();
  const currentRun = runId;
  const runController = new AbortController();
  const activeScenario = scenario.value;
  controller = runController;
  phase.value = 'listening';
  asrStatus.value = '客户已接入，正在监听';
  let pendingAnalysis: PendingAnalysis | undefined;
  let analysisWorker: Promise<void> | undefined;

  async function runAnalysis(request: PendingAnalysis) {
    if (currentRun !== runId || runController.signal.aborted) return;
    agentRunning.value = true;
    agentStatus.value = '业务组件已触发 Agent';
    try {
      await analyzeTranscript({
        ...request,
        signal: runController.signal,
        onProgress(event) {
          agentStatus.value = progressLabel(event);
        }
      });
    } catch (error) {
      if (runController.signal.aborted || currentRun !== runId) return;
      notices.value = [{
        id: `error-${Date.now()}`,
        kind: 'error',
        title: 'Agent 调用失败',
        content: error instanceof Error ? error.message : '无法调用 LLM 服务。',
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false })
      }, ...notices.value];
      agentStatus.value = '调用失败，ASR 继续运行';
    } finally {
      agentRunning.value = false;
    }
  }

  async function drainAnalysis() {
    while (pendingAnalysis && currentRun === runId && !runController.signal.aborted) {
      const request = pendingAnalysis;
      pendingAnalysis = undefined;
      await runAnalysis(request);
    }
  }

  function enqueueAnalysis(latest: string, transcript: string) {
    pendingAnalysis = { latest, transcript };
    if (!analysisWorker) {
      analysisWorker = drainAnalysis().finally(() => {
        analysisWorker = undefined;
      });
    } else {
      agentStatus.value = '已有分析运行，保留最新累计上下文';
    }
  }

  for (const [utteranceIndex, utterance] of activeScenario.utterances.entries()) {
    if (currentRun !== runId) return;
    activeUtterance.value = utteranceIndex + 1;

    for (const partial of utterance.partials) {
      if (currentRun !== runId) return;
      onlineText.value = partial;
      asrStatus.value = '接收 online partial';
      await delay(activeScenario.partialDelayMs);
    }

    asrStatus.value = '等待 offline final 确认';
    await delay(activeScenario.finalizationDelayMs);
    if (currentRun !== runId) return;
    offlineSegments.value.push({ id: utterance.id, text: utterance.final });
    onlineText.value = '';
    asrStatus.value = 'offline 结果已确认';

    if (utterance.checkpoint) {
      enqueueAnalysis(
        utterance.final,
        offlineSegments.value.map((segment) => segment.text).join('\n')
      );
    }
    await delay(utterance.pauseAfterMs ?? activeScenario.utterancePauseMs);
  }

  if (currentRun !== runId) return;
  phase.value = 'analyzing';
  asrStatus.value = '通话已结束，等待分析队列';
  await analysisWorker;
  if (currentRun !== runId) return;
  phase.value = 'completed';
  asrStatus.value = 'ASR 与 Agent 队列均已完成，工单仍为草稿';
  onlineText.value = '';
  controller = undefined;
}

onBeforeUnmount(() => {
  runId += 1;
  controller?.abort(new Error('页面已离开。'));
});
</script>

<template>
  <section class="service-console">
    <header class="console-header">
      <div>
        <span class="console-kicker">Live assistance / {{ scenario.id }}-0728</span>
        <h2>售后热线坐席工作台</h2>
        <p>离线 ASR 到达后由业务组件触发 Agent，自动查询订单 API、售后规则并更新草稿。</p>
      </div>
      <div class="console-actions">
        <a-button :disabled="isRunning" type="primary" @click="startSimulation">
          {{ phase === 'completed' ? '重新模拟' : '开始模拟' }}
        </a-button>
        <a-button :disabled="phase === 'idle'" @click="reset">重置</a-button>
      </div>
    </header>

    <nav class="scenario-switcher" aria-label="选择售后模拟场景">
      <button
        v-for="item in asrScenarios"
        :key="item.id"
        type="button"
        :disabled="isRunning"
        :class="{ active: item.id === selectedScenarioId }"
        @click="selectScenario(item.id)"
      >
        <strong>{{ item.speaker }}</strong>
        <span>{{ item.product }}</span>
        <small>{{ item.voice }} · partial {{ item.partialDelayMs }}ms · final {{ item.finalizationDelayMs }}ms</small>
      </button>
    </nav>

    <div class="runtime-strip">
      <span class="runtime-state" :class="phase">
        <i></i>{{ phaseLabel }}
      </span>
      <div class="signal-bars" :class="{ active: phase === 'listening' }" aria-hidden="true">
        <i v-for="index in 12" :key="index" :style="{ '--bar': index }"></i>
      </div>
      <span>{{ runtimeDetail }}</span>
      <code>{{ completion }}%</code>
    </div>
    <div class="analysis-policy">
      <span><b>触发</b>{{ checkpointCount }} 个语义检查点</span>
      <span><b>上下文</b>本次新增 + 累计 offline</span>
      <span><b>数据</b>订单 API + Knowledge Provider</span>
      <span><b>队列</b>串行执行 · pending latest-wins</span>
    </div>

    <div class="workbench-grid">
      <section class="workspace-panel transcript-panel">
        <header>
          <div>
            <span>01 / ASR STREAM</span>
            <strong>实时转写</strong>
          </div>
          <a-tag :color="phase === 'listening' ? 'processing' : 'default'">online → offline</a-tag>
        </header>

        <div class="transcript-feed">
          <div v-if="!offlineSegments.length && !onlineText" class="empty-state">
            点击“开始模拟”接入客户通话
          </div>
          <article v-for="segment in offlineSegments" :key="segment.id" class="transcript-item final">
            <div><span>{{ scenario.shortName }}</span><code>offline</code></div>
            <p>{{ segment.text }}</p>
          </article>
          <article v-if="onlineText" class="transcript-item partial">
            <div><span>{{ scenario.shortName }}</span><code>online</code></div>
            <p>{{ onlineText }}</p>
          </article>
        </div>
      </section>

      <section class="workspace-panel ticket-panel">
        <header>
          <div>
            <span>02 / TICKET DRAFT</span>
            <strong>售后工单</strong>
          </div>
          <a-tag color="blue">未提交</a-tag>
        </header>

        <div class="ticket-fields">
          <label
            v-for="field in fieldRows"
            :key="field.key"
            :class="{ highlighted: highlightedFields.includes(field.key), wide: field.multiline }"
          >
            <span>{{ field.label }}</span>
            <textarea
              v-if="field.multiline"
              v-model="draft[field.key]"
              rows="3"
              :placeholder="`${field.label}待识别`"
            ></textarea>
            <input v-else v-model="draft[field.key]" :placeholder="`${field.label}待识别`" />
            <small v-if="highlightedFields.includes(field.key)">Agent updated</small>
          </label>
        </div>
      </section>

      <aside class="workspace-panel assistant-panel">
        <header>
          <div>
            <span>03 / AGENT OUTPUT</span>
            <strong>坐席辅助</strong>
          </div>
          <span class="assistant-mark" :class="{ running: agentRunning }">A</span>
        </header>

        <div class="assistant-feed">
          <div v-if="!notices.length" class="assistant-idle">
            <span class="assistant-orb">A</span>
            <strong>等待可分析的 offline 文本</strong>
            <p>订单事实来自业务 API，处理规则来自知识库；业务组件决定何时提交稳定转写。</p>
          </div>
          <TransitionGroup name="assistant-slide" tag="div" class="assistant-list">
            <article v-for="notice in notices" :key="notice.id" :class="['assistant-notice', notice.kind]">
              <div>
                <strong>{{ notice.title }}</strong>
                <time>{{ notice.timestamp }}</time>
              </div>
              <p class="notice-content">{{ notice.content }}</p>
            </article>
          </TransitionGroup>
        </div>

        <footer>
          <span>执行边界</span>
          <strong>查询订单 · 检索知识 · 填写草稿 · 高亮</strong>
          <small>Order API: demo-order-api</small>
          <small>Knowledge: demo-support-knowledge</small>
          <small>未提供提交、退款或换新审批工具</small>
        </footer>
      </aside>
    </div>
  </section>
</template>

<style scoped src="./CustomerServiceWorkbench.css"></style>
