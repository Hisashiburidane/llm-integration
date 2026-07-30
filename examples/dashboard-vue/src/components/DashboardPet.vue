<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { createLlmClient, useEnchantForge } from '@enchantforge/vue';
import {
  buildPetCapabilityCatalog,
  buildPetPageContext,
  generatePetTips,
  petContextSignature,
  type PetTip
} from '../runtime/pet-assistant';
import {
  clearPanelAttention,
  snapshotPanelAttention,
  usePanelAttentionVersion
} from '../runtime/panel-attention';

interface RouteMemory {
  signature: string;
  tips: PetTip[];
  capabilityCount: number;
  contextCount: number;
  generatedAt?: number;
  loading: boolean;
  error: string;
}

const props = defineProps<{
  page: string;
  route: string;
}>();

const forge = useEnchantForge();
const attentionVersion = usePanelAttentionVersion();
const memories = ref(new Map<string, RouteMemory>());
const open = ref(false);
const tipCursor = ref(0);
const memoryRevision = ref(0);
const client = createLlmClient({
  model: __LLM_MODEL__,
  configError: __LLM_CONFIG_ERROR__
    ? `${__LLM_CONFIG_ERROR__}，请检查 examples/dashboard-vue/.env。`
    : '',
  onDebug(event) {
    forge.trace({
      source: `pet:${event.requestId}`,
      kind: 'llm',
      title: `Pet LLM ${event.phase}`,
      detail: event
    });
  }
});

let generationTimer: ReturnType<typeof setTimeout> | undefined;
let rotationTimer: ReturnType<typeof setInterval> | undefined;
let controller: AbortController | undefined;

function emptyMemory(): RouteMemory {
  return {
    signature: '',
    tips: [],
    capabilityCount: 0,
    contextCount: 0,
    loading: false,
    error: ''
  };
}

function routeMemory() {
  memoryRevision.value;
  return memories.value.get(props.route);
}

const memory = computed(() => routeMemory() ?? emptyMemory());
const attention = computed(() => {
  attentionVersion.value;
  return snapshotPanelAttention(props.page);
});
const rankedTips = computed(() => {
  const panelWeights = new Map(attention.value.panels.map((panel, index) => [
    panel.panelId,
    Math.max(1, 12 - index * 2)
  ]));
  return memory.value.tips
    .map((tip, index) => ({
      tip,
      score: tip.relatedPanelIds.reduce((total, panelId) => total + (panelWeights.get(panelId) ?? 0), 0) - index * 0.01
    }))
    .sort((left, right) => right.score - left.score)
    .map((item) => item.tip);
});
const currentTip = computed(() => (
  rankedTips.value.length ? rankedTips.value[tipCursor.value % rankedTips.value.length] : undefined
));
const statusText = computed(() => {
  if (memory.value.loading) return '正在了解当前页面';
  if (memory.value.error) return '建议暂时不可用';
  if (memory.value.tips.length) return `${memory.value.tips.length} 条页面提示`;
  return '还没有页面记忆';
});

function updateMemory(route: string, patch: Partial<RouteMemory>) {
  const current = memories.value.get(route) ?? emptyMemory();
  memories.value.set(route, { ...current, ...patch });
  memoryRevision.value += 1;
}

function scheduleGeneration(force = false) {
  if (generationTimer) clearTimeout(generationTimer);
  controller?.abort();
  controller = undefined;
  generationTimer = setTimeout(() => {
    generationTimer = undefined;
    void generate(force);
  }, force ? 0 : 420);
}

async function generate(force: boolean) {
  const route = props.route;
  const page = props.page;
  const bundle = forge.captureContext({ scope: 'page', page, route });
  const context = buildPetPageContext(bundle.snapshot);
  const capabilities = buildPetCapabilityCatalog(bundle.snapshot);
  const signature = petContextSignature(context, capabilities);
  const existing = memories.value.get(route);
  if (!force && existing?.signature === signature && existing.tips.length) return;

  controller?.abort();
  const runController = new AbortController();
  controller = runController;
  updateMemory(route, {
    signature,
    capabilityCount: capabilities.length,
    contextCount: bundle.snapshot.enchantments.length,
    loading: true,
    error: ''
  });

  try {
    const tips = await generatePetTips({
      client,
      context,
      capabilities,
      attention: snapshotPanelAttention(page),
      signal: runController.signal
    });
    if (runController.signal.aborted || route !== props.route) return;
    updateMemory(route, {
      signature,
      tips,
      capabilityCount: capabilities.length,
      contextCount: bundle.snapshot.enchantments.length,
      generatedAt: Date.now(),
      loading: false,
      error: ''
    });
    tipCursor.value = 0;
  } catch (cause) {
    if (runController.signal.aborted || route !== props.route) return;
    updateMemory(route, {
      loading: false,
      error: cause instanceof Error ? cause.message : '页面提示生成失败。'
    });
  } finally {
    if (controller === runController) controller = undefined;
  }
}

function clearMemory() {
  controller?.abort();
  memories.value.clear();
  memoryRevision.value += 1;
  clearPanelAttention();
  tipCursor.value = 0;
}

function refresh() {
  scheduleGeneration(true);
}

function nextTip() {
  if (rankedTips.value.length > 1) tipCursor.value = (tipCursor.value + 1) % rankedTips.value.length;
}

function formatTime(value: number | undefined) {
  return value
    ? new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(value)
    : '--';
}

watch(
  [() => props.route, () => forge.registry.version.value],
  () => scheduleGeneration(),
  { immediate: true, flush: 'post' }
);

rotationTimer = setInterval(nextTip, 12000);

onBeforeUnmount(() => {
  if (generationTimer) clearTimeout(generationTimer);
  if (rotationTimer) clearInterval(rotationTimer);
  controller?.abort();
});
</script>

<template>
  <aside class="dashboard-pet" :class="{ open }" aria-label="页面向导">
    <section v-if="open" class="pet-console">
      <header>
        <div>
          <span>PAGE GUIDE</span>
          <strong>电子向导</strong>
        </div>
        <button type="button" aria-label="关闭页面向导" @click="open = false">×</button>
      </header>
      <div class="pet-status">
        <span class="status-light" :class="{ working: memory.loading, error: memory.error }"></span>
        <span>{{ statusText }}</span>
        <code>{{ page }}</code>
      </div>
      <div class="pet-actions">
        <button type="button" :disabled="memory.loading" @click="refresh">重新生成</button>
        <button type="button" :disabled="!memories.size && !attention.panels.length" @click="clearMemory">清空记忆</button>
      </div>
      <p v-if="memory.error" class="pet-error">{{ memory.error }}</p>
      <ol v-else-if="rankedTips.length" class="pet-tip-list">
        <li v-for="tip in rankedTips" :key="tip.id">
          <span>{{ tip.category }}</span>
          <strong>{{ tip.title }}</strong>
          <p>{{ tip.body }}</p>
          <small v-if="tip.relatedTools.length">{{ tip.relatedTools.join(' · ') }}</small>
        </li>
      </ol>
      <div v-else class="pet-empty">切换页面或点击“重新生成”，向导会读取当前页面公开的信息</div>
      <footer>
        <span>{{ memory.contextCount }} contexts</span>
        <span>{{ memory.capabilityCount }} tools</span>
        <span>{{ formatTime(memory.generatedAt) }}</span>
      </footer>
    </section>

    <button
      v-if="currentTip || memory.loading || memory.error"
      type="button"
      class="pet-speech"
      :aria-label="currentTip ? `提示：${currentTip.title}` : statusText"
      @click="open = true"
    >
      <template v-if="currentTip">
        <strong>{{ currentTip.title }}</strong>
        <span>{{ currentTip.body }}</span>
      </template>
      <span v-else>{{ statusText }}</span>
    </button>

    <button type="button" class="pet-avatar" :aria-expanded="open" aria-label="打开页面向导" @click="open = !open">
      <span class="pet-antenna"></span>
      <span class="pet-screen">
        <i></i>
        <i></i>
        <b></b>
      </span>
      <span class="pet-label">GUIDE</span>
    </button>
  </aside>
</template>

<style scoped>
.dashboard-pet {
  position: fixed;
  z-index: 950;
  bottom: 20px;
  left: 20px;
  display: flex;
  align-items: flex-end;
  gap: 12px;
  font-family: "IBM Plex Sans", sans-serif;
}
.pet-avatar {
  position: relative;
  width: 58px;
  height: 66px;
  padding: 9px 8px 7px;
  border: 1px solid #8ba2bc;
  border-radius: 12px 12px 16px 16px;
  color: #d8f3ff;
  background: #18314f;
  box-shadow: 0 10px 28px rgb(15 39 67 / 24%);
  cursor: pointer;
}
.pet-avatar:hover { background: #204166; }
.pet-antenna {
  position: absolute;
  top: -9px;
  left: 27px;
  width: 2px;
  height: 10px;
  background: #4f6f91;
}
.pet-antenna::before {
  position: absolute;
  top: -3px;
  left: -2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #63d5ff;
  box-shadow: 0 0 8px rgb(99 213 255 / 70%);
  content: "";
}
.pet-screen {
  display: grid;
  height: 34px;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 8px;
  place-items: center;
  border: 1px solid #426789;
  border-radius: 6px;
  background: #0a1c2d;
}
.pet-screen i {
  width: 5px;
  height: 7px;
  background: #6ee7ff;
  box-shadow: 0 0 5px rgb(110 231 255 / 72%);
}
.pet-screen b {
  width: 14px;
  height: 4px;
  grid-column: 1 / -1;
  border-bottom: 2px solid #6ee7ff;
  border-radius: 50%;
}
.pet-label {
  display: block;
  margin-top: 6px;
  color: #9dc0dc;
  font: 700 8px/1 "IBM Plex Mono", monospace;
  letter-spacing: .16em;
}
.pet-speech {
  position: relative;
  width: min(320px, calc(100vw - 112px));
  padding: 12px 14px;
  border: 1px solid #cbd8e6;
  border-radius: 14px 14px 4px 14px;
  color: #3d526a;
  background: #fff;
  box-shadow: 0 10px 30px rgb(26 50 78 / 14%);
  cursor: pointer;
  text-align: left;
}
.pet-speech::after {
  position: absolute;
  right: -9px;
  bottom: 10px;
  width: 16px;
  height: 16px;
  border-right: 1px solid #cbd8e6;
  border-bottom: 1px solid #cbd8e6;
  background: #fff;
  content: "";
  transform: rotate(-45deg);
}
.pet-speech strong, .pet-speech span { display: block; }
.pet-speech strong { margin-bottom: 4px; color: #18314f; font-size: 11px; }
.pet-speech span { font-size: 10px; line-height: 1.55; }
.pet-console {
  position: absolute;
  bottom: 78px;
  left: 0;
  width: min(360px, calc(100vw - 32px));
  max-height: min(620px, calc(100vh - 120px));
  overflow: hidden;
  border: 1px solid #cbd8e6;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 22px 54px rgb(22 46 73 / 22%);
}
.pet-console header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  color: #e7f1fb;
  background: #18314f;
}
.pet-console header span, .pet-console header strong { display: block; }
.pet-console header span { margin-bottom: 4px; color: #8fb5d5; font: 700 8px/1 "IBM Plex Mono", monospace; letter-spacing: .14em; }
.pet-console header strong { font-size: 13px; }
.pet-console header button {
  border: 0;
  color: #b8cadb;
  background: transparent;
  cursor: pointer;
  font-size: 20px;
}
.pet-status {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid #e7edf3;
  color: #64748b;
  font-size: 10px;
}
.pet-status code { max-width: 120px; overflow: hidden; color: #8192a7; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.status-light { width: 7px; height: 7px; border-radius: 50%; background: #38a169; }
.status-light.working { background: #3b82f6; box-shadow: 0 0 0 4px rgb(59 130 246 / 12%); }
.status-light.error { background: #dc2626; }
.pet-actions { display: flex; gap: 8px; padding: 11px 14px 0; }
.pet-actions button {
  padding: 5px 8px;
  border: 1px solid #d6e0ea;
  border-radius: 5px;
  color: #4b6179;
  background: #fff;
  cursor: pointer;
  font-size: 9px;
}
.pet-actions button:hover:not(:disabled) { border-color: #8fb7ed; color: #1d5f9f; }
.pet-actions button:disabled { cursor: not-allowed; opacity: .45; }
.pet-tip-list {
  display: grid;
  max-height: 430px;
  gap: 8px;
  padding: 12px 14px;
  margin: 0;
  overflow: auto;
  list-style: none;
}
.pet-tip-list li { padding: 10px 11px; border: 1px solid #e1e8ef; border-radius: 7px; background: #f9fbfd; }
.pet-tip-list li > span { color: #3978b8; font: 700 8px/1 "IBM Plex Mono", monospace; text-transform: uppercase; }
.pet-tip-list strong { display: block; margin-top: 5px; color: #263d56; font-size: 11px; }
.pet-tip-list p { margin: 5px 0 0; color: #64748b; font-size: 10px; line-height: 1.55; }
.pet-tip-list small { display: block; margin-top: 7px; overflow: hidden; color: #8495a8; font: 8px/1.4 "IBM Plex Mono", monospace; text-overflow: ellipsis; white-space: nowrap; }
.pet-empty, .pet-error { margin: 12px 14px; padding: 18px 14px; border-radius: 7px; font-size: 10px; line-height: 1.6; }
.pet-empty { color: #7b8da1; background: #f7f9fc; }
.pet-error { color: #a22b2b; background: #fff3f3; }
.pet-console footer { display: flex; gap: 14px; padding: 10px 14px; border-top: 1px solid #e7edf3; color: #8495a8; font: 8px/1 "IBM Plex Mono", monospace; }
@media (max-width: 620px) {
  .dashboard-pet { bottom: 14px; left: 14px; }
  .pet-speech { width: min(250px, calc(100vw - 96px)); }
  .pet-console { bottom: 74px; }
}
</style>
