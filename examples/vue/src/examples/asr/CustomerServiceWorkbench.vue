<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import type { EnchantProgressEvent } from '@enchantforge/vue';
import { asrSimulation } from './asr-simulation';
import {
  useCustomerServiceAgent,
  type AssistantNotice,
  type TicketDraft,
  type TicketField
} from './useCustomerServiceAgent';

type SimulationPhase = 'idle' | 'listening' | 'analyzing' | 'completed';

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
let runId = 0;
let controller: AbortController | undefined;

const { analyzeTranscript } = useCustomerServiceAgent(draft, highlightedFields, notices);

const phaseLabel = computed(() => ({
  idle: '待机',
  listening: '在线识别',
  analyzing: 'Agent 分析',
  completed: '通话结束'
}[phase.value]));

const isRunning = computed(() => phase.value === 'listening' || phase.value === 'analyzing');
const completion = computed(() => Math.round((activeUtterance.value / asrSimulation.length) * 100));
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

function progressLabel(event: EnchantProgressEvent) {
  if (event.detail) return event.detail;
  if (event.capabilityLabel) return event.capabilityLabel;
  return {
    capturing: '正在读取客服工作台上下文',
    planning: '正在理解离线转写',
    authorizing: '正在检查工具权限',
    executing: '正在更新工单草稿',
    responding: '正在整理坐席建议',
    completed: '本轮分析完成',
    failed: '本轮分析失败'
  }[event.phase];
}

async function startSimulation() {
  reset();
  const currentRun = runId;
  const runController = new AbortController();
  controller = runController;
  phase.value = 'listening';
  asrStatus.value = '客户已接入，正在监听';
  let analysisQueue = Promise.resolve();

  function enqueueAnalysis(latest: string, transcript: string) {
    analysisQueue = analysisQueue.then(async () => {
      if (currentRun !== runId || runController.signal.aborted) return;
      agentRunning.value = true;
      agentStatus.value = '业务组件已触发 Agent';
      try {
        await analyzeTranscript({
          latest,
          transcript,
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
    });
  }

  for (const [utteranceIndex, utterance] of asrSimulation.entries()) {
    if (currentRun !== runId) return;
    activeUtterance.value = utteranceIndex + 1;

    for (const partial of utterance.partials) {
      if (currentRun !== runId) return;
      onlineText.value = partial;
      asrStatus.value = '接收 online partial';
      await delay(480);
    }

    offlineSegments.value.push({ id: utterance.id, text: utterance.final });
    onlineText.value = '';
    asrStatus.value = 'offline 结果已确认';

    if (utterance.analyze) {
      enqueueAnalysis(
        utterance.final,
        offlineSegments.value.map((segment) => segment.text).join('\n')
      );
    }
    await delay(360);
  }

  if (currentRun !== runId) return;
  phase.value = 'analyzing';
  asrStatus.value = '通话已结束，等待分析队列';
  await analysisQueue;
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
        <span class="console-kicker">Live assistance / call 10086-0728</span>
        <h2>售后热线坐席工作台</h2>
        <p>模拟 ASR partial/final 数据流，业务组件在离线结果到达后主动触发 Agent。</p>
      </div>
      <div class="console-actions">
        <a-button :disabled="isRunning" type="primary" @click="startSimulation">
          {{ phase === 'completed' ? '重新模拟' : '开始模拟' }}
        </a-button>
        <a-button :disabled="phase === 'idle'" @click="reset">重置</a-button>
      </div>
    </header>

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
            <div><span>客户</span><code>offline</code></div>
            <p>{{ segment.text }}</p>
          </article>
          <article v-if="onlineText" class="transcript-item partial">
            <div><span>客户</span><code>online</code></div>
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
            <p>助手不会监听每个 partial；业务组件决定何时提交稳定转写。</p>
          </div>
          <article v-for="notice in notices" :key="notice.id" :class="['assistant-notice', notice.kind]">
            <div>
              <strong>{{ notice.title }}</strong>
              <time>{{ notice.timestamp }}</time>
            </div>
            <p>{{ notice.content }}</p>
          </article>
        </div>

        <footer>
          <span>执行边界</span>
          <strong>读取 · 填写草稿 · 高亮</strong>
          <small>未提供提交、退款或换新审批工具</small>
        </footer>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.service-console {
  overflow: hidden;
  border: 1px solid #ccd6e2;
  border-radius: 10px;
  color: #162235;
  background: #f4f7fa;
  box-shadow: 0 18px 50px #31506f14;
}
.console-header {
  display: flex;
  gap: 24px;
  align-items: center;
  justify-content: space-between;
  padding: 20px 22px;
  border-bottom: 1px solid #d9e1ea;
  background: #fff;
}
.console-header h2 { margin: 4px 0 3px; font-size: 20px; }
.console-header p { margin: 0; color: #65758a; font-size: 12px; }
.console-kicker, .workspace-panel header span, .runtime-strip code {
  color: #6b7d91;
  font: 700 9px/1.2 "IBM Plex Mono", monospace;
  letter-spacing: .1em;
  text-transform: uppercase;
}
.console-actions { display: flex; flex: 0 0 auto; gap: 8px; }
.runtime-strip {
  display: grid;
  grid-template-columns: auto 84px 1fr auto;
  gap: 14px;
  align-items: center;
  min-height: 42px;
  padding: 8px 18px;
  border-bottom: 1px solid #d9e1ea;
  color: #506176;
  background: #edf2f7;
  font-size: 11px;
}
.runtime-state { display: inline-flex; gap: 7px; align-items: center; font-weight: 700; }
.runtime-state i { width: 7px; height: 7px; border-radius: 50%; background: #94a3b8; }
.runtime-state.listening i { background: #1f8f67; box-shadow: 0 0 0 4px #1f8f6718; }
.runtime-state.analyzing i { background: #2878c8; box-shadow: 0 0 0 4px #2878c818; }
.runtime-state.completed i { background: #60758c; }
.signal-bars { display: flex; height: 20px; gap: 3px; align-items: center; }
.signal-bars i {
  width: 3px;
  height: 4px;
  border-radius: 2px;
  background: #9eabb9;
}
.signal-bars.active i {
  background: #27906b;
  animation: signal 800ms ease-in-out infinite alternate;
  animation-delay: calc(var(--bar) * -55ms);
}
.workbench-grid {
  display: grid;
  grid-template-columns: minmax(250px, .88fr) minmax(390px, 1.35fr) minmax(260px, .92fr);
  min-height: 520px;
}
.workspace-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  border-right: 1px solid #d9e1ea;
  background: #fff;
}
.workspace-panel:last-child { border-right: 0; }
.workspace-panel > header {
  display: flex;
  min-height: 62px;
  padding: 14px 16px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e2e8ef;
}
.workspace-panel header div > span, .workspace-panel header strong { display: block; }
.workspace-panel header strong { margin-top: 4px; font-size: 13px; }
.transcript-feed, .assistant-feed {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  overflow-y: auto;
}
.empty-state {
  margin: auto;
  color: #91a0b1;
  font-size: 12px;
  text-align: center;
}
.transcript-item {
  padding: 11px 12px;
  border: 1px solid #dce4ec;
  border-radius: 7px;
  background: #f8fafc;
}
.transcript-item > div { display: flex; align-items: center; justify-content: space-between; }
.transcript-item span { color: #2e4660; font-size: 11px; font-weight: 700; }
.transcript-item code { color: #268160; font: 700 9px/1 monospace; }
.transcript-item p { margin: 7px 0 0; color: #34465a; font-size: 12px; line-height: 1.65; }
.transcript-item.partial { border-style: dashed; border-color: #e0ad55; background: #fffaf0; }
.transcript-item.partial code { color: #b57518; }
.ticket-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 16px;
}
.ticket-fields label {
  position: relative;
  display: block;
  padding: 9px 10px;
  border: 1px solid #dce3eb;
  border-radius: 6px;
  background: #fbfcfd;
  transition: border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
}
.ticket-fields label.wide { grid-column: 1 / -1; }
.ticket-fields label.highlighted {
  border-color: #3d86cf;
  background: #f4f9ff;
  box-shadow: 0 0 0 2px #3d86cf20;
}
.ticket-fields label > span {
  display: block;
  margin-bottom: 5px;
  color: #65758a;
  font: 700 10px/1.2 "IBM Plex Mono", monospace;
}
.ticket-fields input, .ticket-fields textarea {
  width: 100%;
  padding: 0;
  border: 0;
  outline: 0;
  color: #1f3145;
  background: transparent;
  font-size: 12px;
  line-height: 1.5;
  resize: none;
}
.ticket-fields input::placeholder, .ticket-fields textarea::placeholder { color: #b2bdc9; }
.ticket-fields small {
  position: absolute;
  top: 7px;
  right: 8px;
  color: #2878c8;
  font: 700 8px/1 monospace;
  text-transform: uppercase;
}
.assistant-panel { background: #f8fafc; }
.assistant-mark, .assistant-orb {
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: #176b55;
  font: 700 11px/1 "IBM Plex Mono", monospace;
}
.assistant-mark { width: 29px; height: 29px; }
.assistant-mark.running {
  box-shadow: 0 0 0 6px #176b5514;
  animation: assistant-pulse 1s ease-in-out infinite alternate;
}
.assistant-idle { margin: auto 12px; color: #65758a; text-align: center; }
.assistant-orb { width: 42px; height: 42px; margin: 0 auto 12px; box-shadow: 0 0 0 7px #176b5512; }
.assistant-idle strong { display: block; color: #35485d; font-size: 12px; }
.assistant-idle p { margin: 7px auto 0; max-width: 230px; font-size: 11px; line-height: 1.6; }
.assistant-notice {
  padding: 12px;
  border: 1px solid #cfe0da;
  border-left: 3px solid #25805f;
  border-radius: 6px;
  background: #fff;
}
.assistant-notice.result { border-color: #cddcec; border-left-color: #347fc8; }
.assistant-notice.error { border-color: #eed0d0; border-left-color: #c24444; }
.assistant-notice > div { display: flex; align-items: center; justify-content: space-between; }
.assistant-notice strong { font-size: 11px; }
.assistant-notice time { color: #8b99aa; font: 9px/1 monospace; }
.assistant-notice p { margin: 8px 0 0; color: #475a6e; font-size: 11px; line-height: 1.65; }
.assistant-panel footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 15px;
  border-top: 1px solid #dce4ec;
  background: #fff;
}
.assistant-panel footer span { color: #8593a3; font: 700 9px/1 monospace; text-transform: uppercase; }
.assistant-panel footer strong { color: #35485d; font-size: 11px; }
.assistant-panel footer small { color: #8492a3; font-size: 10px; }
@keyframes signal {
  from { height: 4px; opacity: .55; }
  to { height: 18px; opacity: 1; }
}
@keyframes assistant-pulse {
  from { transform: scale(.94); }
  to { transform: scale(1.04); }
}
@media (max-width: 1100px) {
  .workbench-grid { grid-template-columns: 1fr 1.35fr; }
  .assistant-panel { min-height: 320px; grid-column: 1 / -1; border-top: 1px solid #d9e1ea; }
}
@media (max-width: 760px) {
  .console-header { align-items: flex-start; flex-direction: column; }
  .runtime-strip { grid-template-columns: auto 1fr auto; }
  .signal-bars { display: none; }
  .workbench-grid { grid-template-columns: 1fr; }
  .workspace-panel { min-height: 360px; border-right: 0; border-bottom: 1px solid #d9e1ea; }
  .assistant-panel { grid-column: auto; }
}
</style>
