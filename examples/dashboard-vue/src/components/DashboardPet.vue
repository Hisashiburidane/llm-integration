<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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

type PetAction = 'idle' | 'look' | 'hop' | 'scan' | 'nap';
type PetVariant = 'robot' | 'cat' | 'ghost' | 'slime' | 'husky' | 'morgana' | 'bb8' | 'retro-pc';

const PET_POSITION_KEY = 'enchantforge.dashboard-pet.position';
const PET_SILENT_KEY = 'enchantforge.dashboard-pet.silent';
const PET_VARIANT_KEY = 'enchantforge.dashboard-pet.variant';
const PET_WIDTH = 58;
const PET_HEIGHT = 66;
const EDGE_GAP = 12;
const TIP_MIN_DELAY = 18_000;
const TIP_MAX_DELAY = 30_000;
const petVariants: Array<{ id: PetVariant; name: string; badge: string }> = [
  { id: 'robot', name: '机器人', badge: 'GUIDE' },
  { id: 'cat', name: '终端猫', badge: 'CAT.EXE' },
  { id: 'ghost', name: '小幽灵', badge: 'BOO' },
  { id: 'slime', name: '史莱姆', badge: 'SLIME' },
  { id: 'husky', name: '哈士奇', badge: 'HUSKY' },
  { id: 'morgana', name: '摩尔加纳', badge: 'MONA' },
  { id: 'bb8', name: 'BB-8', badge: 'BB-8' },
  { id: 'retro-pc', name: '复古机箱', badge: 'ATX 98' }
];

const props = defineProps<{
  page: string;
  route: string;
}>();

const forge = useEnchantForge();
const attentionVersion = usePanelAttentionVersion();
const memories = ref(new Map<string, RouteMemory>());
const open = ref(false);
const appearanceOpen = ref(false);
const silent = ref(false);
const bubbleVisible = ref(false);
const visibleTipId = ref('');
const positioned = ref(false);
const dragging = ref(false);
const petAction = ref<PetAction>('idle');
const petVariant = ref<PetVariant>('retro-pc');
const position = ref({ x: 20, y: 20 });
const viewport = ref({ width: 0, height: 0 });
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
let tipTimer: ReturnType<typeof setTimeout> | undefined;
let attentionTimer: ReturnType<typeof setTimeout> | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let actionTimer: ReturnType<typeof setTimeout> | undefined;
let actionFrame: number | undefined;
let controller: AbortController | undefined;
let suppressClick = false;
let dragStart: {
  pointerId: number;
  clientX: number;
  clientY: number;
  x: number;
  y: number;
} | undefined;

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
const scoredTips = computed(() => {
  const panelWeights = new Map(attention.value.panels.map((panel, index) => [
    panel.panelId,
    Math.max(1, 12 - index * 2)
  ]));
  return memory.value.tips
    .map((tip, index) => ({
      tip,
      score: 1 + tip.relatedPanelIds.reduce((total, panelId) => total + (panelWeights.get(panelId) ?? 0), 0) - index * 0.001
    }));
});
const rankedTips = computed(() => [...scoredTips.value].sort((left, right) => right.score - left.score).map((item) => item.tip));
const currentTip = computed(() => (
  memory.value.tips.find((tip) => tip.id === visibleTipId.value) ?? rankedTips.value[0]
));
const petWidth = computed(() => petVariant.value === 'retro-pc' ? 80 : PET_WIDTH);
const variantDefinition = computed(() => (
  petVariants.find((variant) => variant.id === petVariant.value) ?? petVariants[0]!
));
const statusText = computed(() => {
  if (memory.value.loading) return '正在对齐页面颗粒度';
  if (memory.value.error) return '建议暂时不可用';
  if (memory.value.tips.length) return `${memory.value.tips.length} 条页面提示`;
  return '还没有页面记忆';
});
const showSpeech = computed(() => (
  !silent.value
  && bubbleVisible.value
  && Boolean(currentTip.value || memory.value.loading || memory.value.error)
));
const bubbleOnLeft = computed(() => {
  const availableWidth = Math.min(320, Math.max(220, viewport.value.width - 112));
  return position.value.x + petWidth.value + availableWidth + 28 > viewport.value.width;
});
const consoleOnLeft = computed(() => position.value.x + 360 + EDGE_GAP > viewport.value.width);
const consoleBelow = computed(() => position.value.y < Math.min(430, viewport.value.height * 0.56));
const rootStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`,
  width: `${petWidth.value}px`
}));
const rootClasses = computed(() => ({
  open: open.value,
  'appearance-open': appearanceOpen.value,
  positioned: positioned.value,
  dragging: dragging.value,
  working: memory.value.loading,
  silent: silent.value,
  'bubble-left': bubbleOnLeft.value,
  'console-left': consoleOnLeft.value,
  'console-below': consoleBelow.value,
  [`avatar-${petVariant.value}`]: true,
  [`action-${petAction.value}`]: true
}));

function updateMemory(route: string, patch: Partial<RouteMemory>) {
  const current = memories.value.get(route) ?? emptyMemory();
  memories.value.set(route, { ...current, ...patch });
  memoryRevision.value += 1;
}

function scheduleGeneration(force = false) {
  if (generationTimer) clearTimeout(generationTimer);
  controller?.abort();
  controller = undefined;
  stopTipSchedule();
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
  if (!force && existing?.signature === signature && existing.tips.length) {
    if (!bubbleVisible.value) showNextTip();
    scheduleTip();
    return;
  }

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
    showNextTip();
    scheduleTip();
  } catch (cause) {
    if (runController.signal.aborted || route !== props.route) return;
    updateMemory(route, {
      loading: false,
      error: cause instanceof Error ? cause.message : '页面提示生成失败。'
    });
    if (!silent.value) bubbleVisible.value = true;
  } finally {
    if (controller === runController) controller = undefined;
  }
}

function clearMemory() {
  controller?.abort();
  stopTipSchedule();
  memories.value.clear();
  memoryRevision.value += 1;
  clearPanelAttention();
  visibleTipId.value = '';
  bubbleVisible.value = false;
}

function refresh() {
  stopTipSchedule();
  if (!silent.value) bubbleVisible.value = true;
  scheduleGeneration(true);
}

function showNextTip() {
  if (silent.value || !scoredTips.value.length) return;
  const alternatives = scoredTips.value.length > 1
    ? scoredTips.value.filter((item) => item.tip.id !== visibleTipId.value)
    : scoredTips.value;
  const total = alternatives.reduce((sum, item) => sum + Math.max(0.1, item.score), 0);
  let cursor = Math.random() * total;
  const selected = alternatives.find((item) => {
    cursor -= Math.max(0.1, item.score);
    return cursor <= 0;
  }) ?? alternatives[alternatives.length - 1];
  visibleTipId.value = selected?.tip.id ?? '';
  bubbleVisible.value = Boolean(selected);
}

function dismissBubble() {
  bubbleVisible.value = false;
  scheduleTip();
}

function stopTipSchedule() {
  if (tipTimer) clearTimeout(tipTimer);
  tipTimer = undefined;
}

function scheduleTip() {
  stopTipSchedule();
  if (
    silent.value
    || memory.value.loading
    || Boolean(memory.value.error)
    || !memory.value.tips.length
  ) return;
  const delay = TIP_MIN_DELAY + Math.round(Math.random() * (TIP_MAX_DELAY - TIP_MIN_DELAY));
  tipTimer = setTimeout(() => {
    tipTimer = undefined;
    showNextTip();
    scheduleTip();
  }, delay);
}

function toggleSilent() {
  silent.value = !silent.value;
  try {
    window.localStorage.setItem(PET_SILENT_KEY, silent.value ? '1' : '0');
  } catch {
    // Storage is optional.
  }
  if (silent.value) {
    stopTipSchedule();
    bubbleVisible.value = false;
  } else {
    showNextTip();
    scheduleTip();
  }
}

function selectPetVariant(variant: PetVariant) {
  petVariant.value = variant;
  position.value = clampPosition(position.value);
  try {
    window.localStorage.setItem(PET_VARIANT_KEY, variant);
  } catch {
    // Storage is optional.
  }
  performPetAction('hop');
}

function clampPosition(value: { x: number; y: number }) {
  return {
    x: Math.min(Math.max(EDGE_GAP, value.x), Math.max(EDGE_GAP, viewport.value.width - petWidth.value - EDGE_GAP)),
    y: Math.min(Math.max(EDGE_GAP, value.y), Math.max(EDGE_GAP, viewport.value.height - PET_HEIGHT - EDGE_GAP))
  };
}

function savePosition() {
  try {
    window.localStorage.setItem(PET_POSITION_KEY, JSON.stringify(position.value));
  } catch {
    // Storage is optional.
  }
}

function handleResize() {
  viewport.value = { width: window.innerWidth, height: window.innerHeight };
  position.value = clampPosition(position.value);
}

function startDrag(event: PointerEvent) {
  if (event.button !== 0) return;
  dragStart = {
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
    x: position.value.x,
    y: position.value.y
  };
  suppressClick = false;
  petAction.value = 'idle';
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function movePet(event: PointerEvent) {
  if (!dragStart || dragStart.pointerId !== event.pointerId) return;
  const deltaX = event.clientX - dragStart.clientX;
  const deltaY = event.clientY - dragStart.clientY;
  if (!dragging.value && Math.hypot(deltaX, deltaY) < 4) return;
  dragging.value = true;
  suppressClick = true;
  position.value = clampPosition({
    x: dragStart.x + deltaX,
    y: dragStart.y + deltaY
  });
}

function endDrag(event: PointerEvent) {
  if (!dragStart || dragStart.pointerId !== event.pointerId) return;
  if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) {
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }
  dragStart = undefined;
  const didDrag = dragging.value;
  if (didDrag) savePosition();
  dragging.value = false;
  if (didDrag) {
    window.setTimeout(() => {
      suppressClick = false;
    }, 0);
  }
}

function toggleOpen() {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  if (open.value) appearanceOpen.value = false;
  open.value = !open.value;
}

function closeConsole() {
  appearanceOpen.value = false;
  open.value = false;
}

function performPetAction(action: Exclude<PetAction, 'idle'>) {
  if (actionTimer) clearTimeout(actionTimer);
  if (actionFrame) cancelAnimationFrame(actionFrame);
  petAction.value = 'idle';
  actionFrame = requestAnimationFrame(() => {
    actionFrame = undefined;
    petAction.value = action;
    actionTimer = setTimeout(() => {
      petAction.value = 'idle';
      actionTimer = undefined;
    }, action === 'nap' ? 2600 : 1300);
  });
}

function scheduleIdleAction() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!dragging.value && !memory.value.loading) {
      const actions: Array<Exclude<PetAction, 'idle'>> = ['look', 'hop', 'scan', 'nap'];
      performPetAction(actions[Math.floor(Math.random() * actions.length)] ?? 'look');
    }
    scheduleIdleAction();
  }, 4200 + Math.round(Math.random() * 5200));
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

watch(attentionVersion, () => {
  if (attentionTimer) clearTimeout(attentionTimer);
  attentionTimer = setTimeout(() => {
    showNextTip();
    scheduleTip();
  }, 900);
});

watch(() => props.route, () => {
  stopTipSchedule();
  visibleTipId.value = '';
  bubbleVisible.value = false;
});

onMounted(() => {
  viewport.value = { width: window.innerWidth, height: window.innerHeight };
  let restoredPosition: { x?: unknown; y?: unknown } | undefined;
  try {
    restoredPosition = JSON.parse(window.localStorage.getItem(PET_POSITION_KEY) ?? 'null') as { x?: unknown; y?: unknown } | undefined;
    silent.value = window.localStorage.getItem(PET_SILENT_KEY) === '1';
    const restoredVariant = window.localStorage.getItem(PET_VARIANT_KEY);
    if (petVariants.some((variant) => variant.id === restoredVariant)) {
      petVariant.value = restoredVariant as PetVariant;
    }
  } catch {
    restoredPosition = undefined;
  }
  position.value = clampPosition({
    x: typeof restoredPosition?.x === 'number' ? restoredPosition.x : 20,
    y: typeof restoredPosition?.y === 'number' ? restoredPosition.y : window.innerHeight - PET_HEIGHT - 20
  });
  positioned.value = true;
  window.addEventListener('resize', handleResize);
  scheduleIdleAction();
});

onBeforeUnmount(() => {
  if (generationTimer) clearTimeout(generationTimer);
  stopTipSchedule();
  if (attentionTimer) clearTimeout(attentionTimer);
  if (idleTimer) clearTimeout(idleTimer);
  if (actionTimer) clearTimeout(actionTimer);
  if (actionFrame) cancelAnimationFrame(actionFrame);
  window.removeEventListener('resize', handleResize);
  controller?.abort();
});
</script>

<template>
  <aside class="dashboard-pet" :class="rootClasses" :style="rootStyle" aria-label="页面向导">
    <section v-if="open" class="pet-console">
      <header>
        <div>
          <span>PAGE GUIDE</span>
          <strong>电子向导</strong>
        </div>
        <button type="button" aria-label="关闭页面向导" @click="closeConsole">×</button>
      </header>
      <div class="pet-status">
        <span class="status-light" :class="{ working: memory.loading, error: memory.error }"></span>
        <span>{{ statusText }}</span>
        <code>{{ page }}</code>
      </div>
      <div class="pet-actions">
        <button type="button" :disabled="memory.loading" @click="refresh">重新生成</button>
        <button type="button" @click="toggleSilent">{{ silent ? '恢复提示' : '静默提示' }}</button>
        <button type="button" :disabled="!memories.size && !attention.panels.length" @click="clearMemory">清空记忆</button>
      </div>
      <div class="pet-moves">
        <span>待机动作</span>
        <button type="button" @click="performPetAction('look')">看看</button>
        <button type="button" @click="performPetAction('hop')">蹦一下</button>
        <button type="button" @click="performPetAction('scan')">扫描</button>
        <button type="button" @click="performPetAction('nap')">打盹</button>
      </div>
      <div v-if="appearanceOpen" class="pet-variants">
        <span>选择形象</span>
        <button
          v-for="variant in petVariants"
          :key="variant.id"
          type="button"
          :class="{ active: petVariant === variant.id }"
          @click="selectPetVariant(variant.id)"
        >
          {{ variant.name }}
        </button>
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
        <button
          type="button"
          :aria-expanded="appearanceOpen"
          aria-label="更多设置"
          title="更多设置"
          @click="appearanceOpen = !appearanceOpen"
        >
          ···
        </button>
      </footer>
    </section>

    <button
      v-if="showSpeech"
      :key="currentTip?.id ?? statusText"
      type="button"
      class="pet-speech"
      :aria-label="currentTip ? `关闭提示：${currentTip.title}` : `关闭提示：${statusText}`"
      @click="dismissBubble"
    >
      <span class="speech-close" aria-hidden="true">×</span>
      <template v-if="currentTip">
        <strong>{{ currentTip.title }}</strong>
        <span>{{ currentTip.body }}</span>
      </template>
      <span v-else>{{ statusText }}</span>
    </button>

    <button
      type="button"
      class="pet-avatar"
      :aria-expanded="open"
      :aria-grabbed="dragging"
      :aria-label="`打开或拖动${variantDefinition.name}`"
      @pointerdown="startDrag"
      @pointermove="movePet"
      @pointerup="endDrag"
      @pointercancel="endDrag"
      @click="toggleOpen"
    >
      <span class="pet-antenna"></span>
      <span class="pet-z" aria-hidden="true">Z</span>
      <span class="pet-screen">
        <i></i>
        <i></i>
        <b></b>
      </span>
      <span class="pet-label">{{ variantDefinition.badge }}</span>
      <span class="pet-feet" aria-hidden="true"><i></i><i></i></span>
    </button>
  </aside>
</template>

<style scoped>
.dashboard-pet {
  position: fixed;
  z-index: 950;
  width: 58px;
  height: 66px;
  opacity: 0;
  transition: opacity 120ms ease;
  font-family: "IBM Plex Sans", sans-serif;
}
.dashboard-pet.positioned { opacity: 1; }
.pet-avatar {
  position: relative;
  width: 58px;
  height: 66px;
  padding: 10px 8px 8px;
  border: 2px solid #091c30;
  border-radius: 0;
  color: #d8f3ff;
  background: #18314f;
  box-shadow:
    inset 2px 2px 0 #52718f,
    inset -3px -3px 0 #0e2842,
    4px 4px 0 rgb(9 28 48 / 34%);
  cursor: grab;
  image-rendering: pixelated;
  touch-action: none;
  user-select: none;
  animation: pet-idle 2.4s steps(2, end) infinite;
}
.pet-avatar:hover { background: #204166; }
.pet-avatar::after {
  position: absolute;
  z-index: -1;
  right: 5px;
  bottom: -10px;
  left: 5px;
  height: 4px;
  background: rgb(12 31 52 / 28%);
  box-shadow:
    5px 3px 0 rgb(12 31 52 / 16%),
    -5px 3px 0 rgb(12 31 52 / 16%);
  content: "";
  animation: pet-shadow 2.4s steps(2, end) infinite;
}
.dragging .pet-avatar { cursor: grabbing; animation: none; }
.dragging .pet-avatar::after { animation: none; }
.working .pet-avatar { animation: pet-work 700ms steps(2, end) infinite; }
.working .pet-avatar::after { animation: pet-work-shadow 700ms steps(2, end) infinite; }
.pet-antenna {
  position: absolute;
  top: -10px;
  left: 26px;
  width: 4px;
  height: 10px;
  background: #4f6f91;
}
.pet-antenna::before {
  position: absolute;
  top: -4px;
  left: -2px;
  width: 8px;
  height: 6px;
  background: #63d5ff;
  box-shadow:
    2px -2px 0 #b7efff,
    -2px 2px 0 #287fa3;
  content: "";
  animation: pet-signal 1.6s steps(3, end) infinite;
}
.pet-screen {
  display: grid;
  height: 34px;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 8px;
  place-items: center;
  border: 2px solid #071522;
  border-radius: 0;
  background: #0a1c2d;
  box-shadow:
    inset 2px 2px 0 #153b59,
    2px 2px 0 #2d5372;
}
.pet-screen i {
  width: 6px;
  height: 6px;
  background: #6ee7ff;
  box-shadow:
    2px 0 0 #257e9a,
    0 2px 0 #257e9a;
  animation: pet-blink 5.2s steps(1, end) infinite;
}
.pet-screen b {
  width: 10px;
  height: 2px;
  grid-column: 1 / -1;
  background: #6ee7ff;
  box-shadow:
    -3px -2px 0 #6ee7ff,
    3px -2px 0 #6ee7ff;
}
.pet-label {
  display: block;
  margin-top: 6px;
  color: #9dc0dc;
  font: 800 8px/1 "IBM Plex Mono", monospace;
  letter-spacing: .12em;
  text-shadow: 1px 1px 0 #091c30;
}
.pet-feet {
  position: absolute;
  right: 12px;
  bottom: -4px;
  left: 12px;
  display: flex;
  justify-content: space-between;
}
.pet-feet i {
  width: 12px;
  height: 6px;
  border: 2px solid #091c30;
  border-radius: 0;
  background: #18314f;
  box-shadow: 2px 2px 0 rgb(9 28 48 / 28%);
}
.pet-z {
  position: absolute;
  top: -16px;
  right: -8px;
  display: none;
  color: #3b82f6;
  font: 700 10px/1 "IBM Plex Mono", monospace;
}
.avatar-cat .pet-avatar {
  border-color: #55280f;
  color: #311508;
  background: #c7651b;
  box-shadow:
    inset 2px 2px 0 #f5a34f,
    inset -3px -3px 0 #8c3c12,
    4px 4px 0 rgb(74 30 8 / 30%);
}
.avatar-cat .pet-avatar:hover { background: #d37220; }
.avatar-cat .pet-antenna {
  top: -9px;
  left: 4px;
  width: 12px;
  height: 12px;
  background: #c7651b;
  box-shadow: 34px 0 0 #c7651b;
}
.avatar-cat .pet-antenna::before {
  top: 4px;
  left: 3px;
  width: 6px;
  height: 6px;
  background: #ffd18d;
  box-shadow: 34px 0 0 #ffd18d;
  animation: none;
}
.avatar-cat .pet-screen {
  border-color: #5b2a0c;
  background: #e98a2d;
  box-shadow:
    inset 2px 2px 0 #ffc36c,
    2px 2px 0 #84370c;
}
.avatar-cat .pet-screen i,
.avatar-cat .pet-screen b {
  background: #321508;
  box-shadow:
    2px 0 0 #744018,
    0 2px 0 #744018;
}
.avatar-cat .pet-screen b {
  box-shadow:
    -3px -2px 0 #321508,
    3px -2px 0 #321508;
}
.avatar-cat .pet-label { color: #ffe0a8; text-shadow: 1px 1px 0 #55280f; }
.avatar-cat .pet-feet i { border-color: #55280f; background: #c7651b; }

.avatar-husky .pet-avatar {
  padding: 0;
  border: 0;
  color: #f5f7f6;
  background: transparent;
  box-shadow: none;
}
.avatar-husky .pet-avatar:hover { background: transparent; }
.avatar-husky .pet-avatar::after {
  right: 7px;
  bottom: -3px;
  left: 7px;
}
.avatar-husky .pet-antenna {
  z-index: 0;
  top: -7px;
  left: 2px;
  width: 54px;
  height: 19px;
  background: transparent;
  box-shadow: none;
}
.avatar-husky .pet-antenna::before,
.avatar-husky .pet-antenna::after {
  position: absolute;
  top: 0;
  width: 15px;
  height: 19px;
  background: #52697c;
  box-shadow:
    inset 3px 6px 0 #dbe7ea,
    2px 2px 0 #182734;
  clip-path: polygon(
    6px 0,
    9px 0,
    9px 3px,
    12px 3px,
    12px 7px,
    15px 7px,
    15px 19px,
    0 19px,
    0 7px,
    3px 7px,
    3px 3px,
    6px 3px
  );
  content: "";
  animation: none;
}
.avatar-husky .pet-antenna::before { left: 0; }
.avatar-husky .pet-antenna::after { right: 0; }
.avatar-husky .pet-screen {
  position: relative;
  z-index: 1;
  width: 58px;
  height: 58px;
  padding: 14px 9px 7px;
  border: 0;
  background: #52697c;
  box-shadow: none;
  clip-path: polygon(
    12px 0,
    46px 0,
    46px 3px,
    51px 3px,
    51px 7px,
    55px 7px,
    55px 12px,
    58px 12px,
    58px 46px,
    55px 46px,
    55px 51px,
    51px 51px,
    51px 55px,
    46px 55px,
    46px 58px,
    12px 58px,
    12px 55px,
    7px 55px,
    7px 51px,
    3px 51px,
    3px 46px,
    0 46px,
    0 12px,
    3px 12px,
    3px 7px,
    7px 7px,
    7px 3px,
    12px 3px
  );
  filter: drop-shadow(4px 4px 0 #263746);
  grid-template-rows: 1fr 12px;
}
.avatar-husky .pet-screen::before {
  position: absolute;
  z-index: 1;
  top: 1px;
  left: 25px;
  width: 8px;
  height: 23px;
  background: #edf4f1;
  clip-path: polygon(
    2px 0,
    6px 0,
    6px 4px,
    8px 4px,
    8px 18px,
    6px 18px,
    6px 23px,
    2px 23px,
    2px 18px,
    0 18px,
    0 4px,
    2px 4px
  );
  content: "";
}
.avatar-husky .pet-screen::after {
  position: absolute;
  z-index: 0;
  bottom: 5px;
  left: 7px;
  width: 44px;
  height: 28px;
  background: #edf4f1;
  clip-path: polygon(
    0 4px,
    7px 4px,
    7px 0,
    16px 0,
    22px 7px,
    28px 0,
    37px 0,
    37px 4px,
    44px 4px,
    44px 20px,
    39px 20px,
    39px 24px,
    31px 24px,
    31px 28px,
    13px 28px,
    13px 24px,
    5px 24px,
    5px 20px,
    0 20px
  );
  content: "";
}
.avatar-husky .pet-screen i {
  position: relative;
  z-index: 2;
  width: 8px;
  height: 9px;
  background: #1fb7ef;
  box-shadow:
    inset 3px 2px 0 #c5f4ff,
    2px 2px 0 #15222c;
}
.avatar-husky .pet-screen b {
  position: relative;
  z-index: 2;
  width: 7px;
  height: 5px;
  background: #111820;
  box-shadow:
    0 3px 0 #111820,
    -3px 5px 0 #111820,
    3px 5px 0 #111820;
}
.avatar-husky .pet-label {
  position: absolute;
  z-index: 2;
  bottom: 1px;
  left: 13px;
  width: 32px;
  padding: 3px 0;
  margin: 0;
  color: #15100a;
  background: #e34a4a;
  text-shadow: none;
}
.avatar-husky .pet-label::after {
  position: absolute;
  bottom: -4px;
  left: 14px;
  width: 5px;
  height: 5px;
  background: #f4c842;
  content: "";
}
.avatar-husky .pet-feet { display: none; }

.avatar-morgana .pet-avatar {
  padding: 0;
  border: 0;
  color: #f5f7f6;
  background: transparent;
  box-shadow: none;
}
.avatar-morgana .pet-avatar:hover { background: transparent; }
.avatar-morgana .pet-avatar::after {
  right: 7px;
  bottom: -3px;
  left: 7px;
}
.avatar-morgana .pet-antenna {
  z-index: 0;
  top: -8px;
  left: 2px;
  width: 15px;
  height: 20px;
  background: #080d12;
  box-shadow:
    39px 0 0 #080d12,
    3px -3px 0 #000,
    42px -3px 0 #000;
}
.avatar-morgana .pet-antenna::before {
  top: 6px;
  left: 4px;
  width: 7px;
  height: 9px;
  background: #50616c;
  box-shadow: 39px 0 0 #50616c;
  animation: none;
}
.avatar-morgana .pet-screen {
  position: relative;
  z-index: 1;
  width: 58px;
  height: 58px;
  padding: 13px 8px 7px;
  border: 0;
  background: #080d12;
  box-shadow: none;
  clip-path: polygon(
    12px 0,
    46px 0,
    46px 3px,
    51px 3px,
    51px 7px,
    55px 7px,
    55px 12px,
    58px 12px,
    58px 46px,
    55px 46px,
    55px 51px,
    51px 51px,
    51px 55px,
    46px 55px,
    46px 58px,
    12px 58px,
    12px 55px,
    7px 55px,
    7px 51px,
    3px 51px,
    3px 46px,
    0 46px,
    0 12px,
    3px 12px,
    3px 7px,
    7px 7px,
    7px 3px,
    12px 3px
  );
  filter: drop-shadow(4px 4px 0 #d30b20);
  grid-template-rows: 1fr 12px;
}
.avatar-morgana .pet-screen::before {
  position: absolute;
  z-index: 1;
  top: 2px;
  left: 23px;
  width: 12px;
  height: 6px;
  background: #18252f;
  box-shadow:
    -4px 3px 0 #18252f,
    4px 3px 0 #18252f;
  content: "";
}
.avatar-morgana .pet-screen::after {
  position: absolute;
  z-index: 0;
  bottom: 5px;
  left: 15px;
  width: 28px;
  height: 17px;
  background: #edf4f1;
  clip-path: polygon(
    5px 0,
    23px 0,
    23px 3px,
    28px 3px,
    28px 12px,
    23px 12px,
    23px 17px,
    5px 17px,
    5px 14px,
    0 14px,
    0 3px,
    5px 3px
  );
  content: "";
}
.avatar-morgana .pet-screen i {
  position: relative;
  z-index: 2;
  width: 9px;
  height: 10px;
  background: #18aee0;
  box-shadow:
    inset 3px 2px 0 #b8f1ff,
    2px 2px 0 #000;
}
.avatar-morgana .pet-screen b {
  position: relative;
  z-index: 2;
  width: 4px;
  height: 3px;
  background: #111820;
  box-shadow:
    -3px -2px 0 #111820,
    3px -2px 0 #111820;
}
.avatar-morgana .pet-label {
  position: absolute;
  z-index: 2;
  bottom: 1px;
  left: 13px;
  width: 32px;
  padding: 3px 0;
  margin: 0;
  color: #15100a;
  background: #f5c928;
  text-shadow: none;
}
.avatar-morgana .pet-feet { display: none; }

.avatar-morgana .pet-speech {
  padding-top: 15px;
  border: 3px solid #08090b;
  border-radius: 0;
  color: #232326;
  box-shadow: 5px 5px 0 #d30b20;
}
.avatar-morgana .pet-speech::before {
  position: absolute;
  top: -10px;
  left: 9px;
  padding: 3px 8px;
  color: #fff;
  background: #08090b;
  box-shadow: 3px 0 0 #d30b20;
  content: "MONA";
  font: 800 8px/1 "IBM Plex Mono", monospace;
  letter-spacing: .12em;
}
.avatar-morgana .pet-speech::after {
  border-color: #08090b;
  border-width: 0 0 3px 3px;
}
.avatar-morgana.bubble-left .pet-speech::after {
  border-width: 0 3px 3px 0;
}
.avatar-morgana .pet-speech strong { color: #08090b; }

.avatar-ghost .pet-avatar {
  border-color: #294461;
  color: #17314c;
  background: #dceeff;
  box-shadow:
    inset 2px 2px 0 #fff,
    inset -3px -3px 0 #9dbad4,
    4px 4px 0 rgb(34 65 94 / 24%);
}
.avatar-ghost .pet-avatar:hover { background: #e9f5ff; }
.avatar-ghost .pet-antenna {
  top: -8px;
  left: 25px;
  width: 5px;
  height: 5px;
  background: #dceeff;
  box-shadow:
    5px -4px 0 #dceeff,
    10px -4px 0 #dceeff;
}
.avatar-ghost .pet-antenna::before { display: none; }
.avatar-ghost .pet-screen {
  border-color: transparent;
  background: transparent;
  box-shadow: none;
}
.avatar-ghost .pet-screen i,
.avatar-ghost .pet-screen b {
  background: #294461;
  box-shadow: none;
}
.avatar-ghost .pet-screen b {
  width: 6px;
  height: 5px;
  box-shadow: 0 -2px 0 #294461;
}
.avatar-ghost .pet-label { color: #486985; text-shadow: none; }
.avatar-ghost .pet-feet i { border-color: #294461; background: #dceeff; }

.avatar-slime .pet-avatar {
  top: 8px;
  height: 58px;
  border-color: #16462e;
  color: #0b2c1c;
  background: #39a96b;
  box-shadow:
    inset 2px 2px 0 #83e5aa,
    inset -3px -3px 0 #24784c,
    4px 4px 0 rgb(15 70 43 / 26%);
}
.avatar-slime .pet-avatar:hover { background: #43b878; }
.avatar-slime .pet-antenna {
  top: -7px;
  left: 9px;
  width: 12px;
  height: 7px;
  background: #39a96b;
  box-shadow:
    12px -4px 0 #39a96b,
    24px 0 0 #39a96b;
}
.avatar-slime .pet-antenna::before { display: none; }
.avatar-slime .pet-screen {
  height: 30px;
  border-color: transparent;
  background: transparent;
  box-shadow: none;
}
.avatar-slime .pet-screen i,
.avatar-slime .pet-screen b {
  background: #103b27;
  box-shadow: none;
}
.avatar-slime .pet-screen b {
  box-shadow:
    -3px -2px 0 #103b27,
    3px -2px 0 #103b27;
}
.avatar-slime .pet-label {
  margin-top: 3px;
  color: #c8f4d8;
  text-shadow: 1px 1px 0 #16462e;
}
.avatar-slime .pet-feet i { border-color: #16462e; background: #39a96b; }

.avatar-bb8 .pet-avatar {
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}
.avatar-bb8 .pet-avatar:hover { background: transparent; }
.avatar-bb8 .pet-avatar::before {
  position: absolute;
  z-index: 1;
  bottom: 0;
  left: 5px;
  width: 48px;
  height: 48px;
  background:
    radial-gradient(circle at 50% 50%, #263746 0 3px, #eceeea 4px 8px, transparent 9px),
    conic-gradient(
      from 0deg,
      #e9861c 0 12%,
      #e6e8e4 12% 25%,
      #e9861c 25% 37%,
      #f4f3ec 37% 50%,
      #e9861c 50% 62%,
      #e1e4df 62% 75%,
      #e9861c 75% 87%,
      #f4f3ec 87% 100%
    );
  clip-path: polygon(
    12px 0,
    36px 0,
    36px 3px,
    42px 3px,
    42px 7px,
    46px 7px,
    46px 12px,
    48px 12px,
    48px 36px,
    46px 36px,
    46px 41px,
    42px 41px,
    42px 45px,
    36px 45px,
    36px 48px,
    12px 48px,
    12px 45px,
    6px 45px,
    6px 41px,
    2px 41px,
    2px 36px,
    0 36px,
    0 12px,
    2px 12px,
    2px 7px,
    6px 7px,
    6px 3px,
    12px 3px
  );
  filter: drop-shadow(2px 2px 0 #b4b8b8);
  content: "";
}
.avatar-bb8 .pet-avatar::after {
  right: 6px;
  bottom: -7px;
  left: 6px;
}
.avatar-bb8 .pet-antenna {
  z-index: 3;
  top: -7px;
  left: 27px;
  width: 2px;
  height: 11px;
  background: #30383d;
}
.avatar-bb8 .pet-antenna::before {
  top: -2px;
  left: 4px;
  width: 2px;
  height: 8px;
  background: #8a8e8c;
  box-shadow: none;
  animation: none;
}
.avatar-bb8 .pet-screen {
  position: absolute;
  z-index: 2;
  top: 0;
  left: 9px;
  display: block;
  width: 40px;
  height: 30px;
  padding: 0;
  border: 0;
  background: #8b9598;
  box-shadow: none;
  clip-path: polygon(
    12px 0,
    28px 0,
    28px 2px,
    34px 2px,
    34px 5px,
    38px 5px,
    38px 10px,
    40px 10px,
    40px 30px,
    0 30px,
    0 10px,
    2px 10px,
    2px 5px,
    6px 5px,
    6px 2px,
    12px 2px
  );
  filter: drop-shadow(2px 2px 0 #b4b8b8);
}
.avatar-bb8 .pet-screen::before {
  position: absolute;
  z-index: 1;
  right: 3px;
  bottom: 3px;
  left: 3px;
  height: 5px;
  background: #e9861c;
  content: "";
}
.avatar-bb8 .pet-screen::after {
  position: absolute;
  z-index: 0;
  inset: 3px;
  background: #eceee9;
  content: "";
}
.avatar-bb8 .pet-screen i:first-child {
  position: absolute;
  z-index: 2;
  top: 9px;
  left: 12px;
  width: 8px;
  height: 8px;
  background: #18252d;
  box-shadow:
    inset 2px 2px 0 #60737c,
    2px 2px 0 #c86c12;
  animation: none;
}
.avatar-bb8 .pet-screen i:nth-child(2) {
  position: absolute;
  z-index: 2;
  top: 12px;
  right: 9px;
  width: 4px;
  height: 4px;
  background: #d73528;
  box-shadow: 1px 1px 0 #74302a;
  animation: pet-signal 1.6s steps(3, end) infinite;
}
.avatar-bb8 .pet-screen b,
.avatar-bb8 .pet-label { display: none; }
.avatar-bb8 .pet-feet {
  position: absolute;
  z-index: 0;
  right: auto;
  bottom: -2px;
  left: 3px;
  display: block;
  width: 52px;
  height: 52px;
  background: #8b9598;
  clip-path: polygon(
    13px 0,
    39px 0,
    39px 3px,
    45px 3px,
    45px 7px,
    49px 7px,
    49px 13px,
    52px 13px,
    52px 39px,
    49px 39px,
    49px 45px,
    45px 45px,
    45px 49px,
    39px 49px,
    39px 52px,
    13px 52px,
    13px 49px,
    7px 49px,
    7px 45px,
    3px 45px,
    3px 39px,
    0 39px,
    0 13px,
    3px 13px,
    3px 7px,
    7px 7px,
    7px 3px,
    13px 3px
  );
  filter: drop-shadow(3px 3px 0 #b4b8b8);
}
.avatar-bb8 .pet-feet i { display: none; }

.avatar-retro-pc .pet-avatar {
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}
.avatar-retro-pc .pet-avatar:hover { background: transparent; }
.avatar-retro-pc .pet-avatar::before {
  position: absolute;
  z-index: 0;
  right: -20px;
  bottom: 1px;
  width: 28px;
  height: 49px;
  border: 2px solid #5d594c;
  background:
    linear-gradient(#625f54 0 0) 4px 7px / 18px 3px no-repeat,
    linear-gradient(#8a8472 0 0) 4px 15px / 18px 4px no-repeat,
    linear-gradient(#777263 0 0) 4px 23px / 12px 2px no-repeat,
    linear-gradient(#2fa06a 0 0) 5px 37px / 4px 4px no-repeat,
    linear-gradient(#d7a92a 0 0) 13px 37px / 4px 4px no-repeat,
    #c9c3ad;
  box-shadow:
    inset 2px 2px 0 #f2eddc,
    inset -2px -2px 0 #8e8876,
    3px 3px 0 rgb(64 61 51 / 28%);
  content: "";
}
.avatar-retro-pc .pet-avatar::after {
  right: 2px;
  bottom: -7px;
  left: 2px;
}
.avatar-retro-pc .pet-antenna { display: none; }
.avatar-retro-pc .pet-screen {
  position: absolute;
  z-index: 1;
  top: 8px;
  left: 0;
  width: 44px;
  height: 39px;
  padding: 8px 7px 7px;
  border: 2px solid #5d594c;
  border-radius: 0;
  background: #c9c3ad;
  box-shadow:
    inset 2px 2px 0 #f4efdf,
    inset -3px -3px 0 #8e8876,
    3px 3px 0 rgb(64 61 51 / 28%);
  grid-template-rows: 1fr 8px;
}
.avatar-retro-pc .pet-screen::before {
  position: absolute;
  z-index: 0;
  inset: 5px 5px 7px;
  border: 2px solid #3d4b4e;
  background: #17353a;
  box-shadow: inset 2px 2px 0 #0c2024;
  content: "";
}
.avatar-retro-pc .pet-screen::after {
  position: absolute;
  bottom: -9px;
  left: 14px;
  width: 11px;
  height: 9px;
  border-right: 2px solid #5d594c;
  border-left: 2px solid #5d594c;
  background: #b9b39f;
  content: "";
}
.avatar-retro-pc .pet-screen i,
.avatar-retro-pc .pet-screen b {
  position: relative;
  z-index: 1;
  background: #78e3d1;
  box-shadow: 1px 1px 0 #266e68;
}
.avatar-retro-pc .pet-screen b {
  width: 10px;
  height: 2px;
  box-shadow:
    -3px -2px 0 #78e3d1,
    3px -2px 0 #78e3d1;
}
.avatar-retro-pc .pet-label {
  position: absolute;
  z-index: 2;
  bottom: 3px;
  left: 3px;
  width: 35px;
  height: 10px;
  padding-top: 2px;
  margin: 0;
  border: 2px solid #5d594c;
  color: #605b4c;
  background: #d8d2bd;
  box-shadow:
    inset 1px 1px 0 #fff9e7,
    2px 2px 0 #8e8876;
  font-size: 6px;
  text-shadow: none;
}
.avatar-retro-pc .pet-feet { display: none; }

.action-look .pet-screen i { transform: translateX(4px); animation: none; }
.action-hop .pet-avatar { animation: pet-hop 900ms steps(4, end) 1; }
.action-hop .pet-avatar::after { animation: pet-hop-shadow 900ms steps(4, end) 1; }
.action-scan .pet-screen { animation: pet-scan 900ms steps(4, end) 1; }
.avatar-robot.action-scan .pet-antenna { animation: pet-signal-fast 300ms steps(2, end) infinite; }
.action-nap .pet-screen i {
  height: 2px;
  box-shadow: none;
  animation: none;
}
.action-nap .pet-screen b { width: 6px; box-shadow: none; }
.action-nap .pet-z {
  display: block;
  animation: pet-dream 1.2s steps(3, end) infinite;
}
.pet-speech {
  position: absolute;
  bottom: 30px;
  left: calc(100% + 14px);
  width: min(320px, calc(100vw - 112px));
  padding: 12px 26px 12px 14px;
  border: 1px solid #cbd8e6;
  border-radius: 14px 14px 14px 4px;
  color: #3d526a;
  background: #fff;
  box-shadow: 0 10px 30px rgb(26 50 78 / 14%);
  cursor: pointer;
  text-align: left;
  animation: speech-pop 180ms steps(3, end);
}
.pet-speech::after {
  position: absolute;
  left: -9px;
  bottom: 10px;
  width: 16px;
  height: 16px;
  border-left: 1px solid #cbd8e6;
  border-bottom: 1px solid #cbd8e6;
  background: #fff;
  content: "";
  transform: rotate(45deg);
}
.bubble-left .pet-speech {
  right: calc(100% + 14px);
  left: auto;
  border-radius: 14px 14px 4px 14px;
}
.bubble-left .pet-speech::after {
  right: -9px;
  left: auto;
  border-right: 1px solid #cbd8e6;
  border-bottom: 1px solid #cbd8e6;
  border-left: 0;
  transform: rotate(-45deg);
}
.pet-speech strong, .pet-speech span { display: block; }
.pet-speech strong { margin-bottom: 4px; color: #18314f; font-size: 11px; }
.pet-speech span { font-size: 10px; line-height: 1.55; }
.pet-speech .speech-close {
  position: absolute;
  top: 5px;
  right: 7px;
  color: #9aa9b9;
  font: 12px/1 "IBM Plex Mono", monospace;
}
.pet-console {
  position: absolute;
  bottom: calc(100% + 14px);
  left: 0;
  width: min(360px, calc(100vw - 32px));
  max-height: min(620px, calc(100vh - 120px));
  overflow: hidden;
  border: 1px solid #cbd8e6;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 22px 54px rgb(22 46 73 / 22%);
}
.console-left .pet-console {
  right: 0;
  left: auto;
}
.console-below .pet-console {
  top: calc(100% + 14px);
  bottom: auto;
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
.pet-moves,
.pet-variants {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 9px 14px 0;
}
.pet-variants { flex-wrap: wrap; }
.pet-variants > span { flex-basis: 100%; }
.pet-moves > span,
.pet-variants > span {
  margin-right: 2px;
  color: #8495a8;
  font: 8px/1 "IBM Plex Mono", monospace;
}
.pet-moves button,
.pet-variants button {
  padding: 4px 6px;
  border: 1px solid #dce5ee;
  border-radius: 4px;
  color: #60758b;
  background: #f8fafc;
  cursor: pointer;
  font-size: 8px;
}
.pet-moves button:hover,
.pet-variants button:hover,
.pet-variants button.active {
  border-color: #8fb7ed;
  color: #1d5f9f;
  background: #f1f7fd;
}
.pet-variants button.active { box-shadow: inset 0 -2px 0 #4b8ed5; }
.pet-tip-list {
  display: grid;
  max-height: 430px;
  gap: 8px;
  padding: 12px 14px;
  margin: 0;
  overflow: auto;
  list-style: none;
}
.appearance-open .pet-tip-list { max-height: 340px; }
.pet-tip-list li { padding: 10px 11px; border: 1px solid #e1e8ef; border-radius: 7px; background: #f9fbfd; }
.pet-tip-list li > span { color: #3978b8; font: 700 8px/1 "IBM Plex Mono", monospace; text-transform: uppercase; }
.pet-tip-list strong { display: block; margin-top: 5px; color: #263d56; font-size: 11px; }
.pet-tip-list p { margin: 5px 0 0; color: #64748b; font-size: 10px; line-height: 1.55; }
.pet-tip-list small { display: block; margin-top: 7px; overflow: hidden; color: #8495a8; font: 8px/1.4 "IBM Plex Mono", monospace; text-overflow: ellipsis; white-space: nowrap; }
.pet-empty, .pet-error { margin: 12px 14px; padding: 18px 14px; border-radius: 7px; font-size: 10px; line-height: 1.6; }
.pet-empty { color: #7b8da1; background: #f7f9fc; }
.pet-error { color: #a22b2b; background: #fff3f3; }
.pet-console footer { display: flex; gap: 14px; padding: 10px 14px; border-top: 1px solid #e7edf3; color: #8495a8; font: 8px/1 "IBM Plex Mono", monospace; }
.pet-console footer button {
  padding: 0 2px;
  border: 0;
  margin-left: auto;
  color: #9baaba;
  background: transparent;
  cursor: pointer;
  font: 700 11px/1 "IBM Plex Mono", monospace;
  letter-spacing: .08em;
}
.pet-console footer button:hover,
.pet-console footer button[aria-expanded="true"] { color: #2f6fae; }
@keyframes pet-idle {
  0%, 70%, 100% { transform: translateY(0); }
  75%, 90% { transform: translateY(-2px); }
}
@keyframes pet-shadow {
  0%, 70%, 100% { transform: scaleX(1); opacity: 1; }
  75%, 90% { transform: scaleX(.8); opacity: .7; }
}
@keyframes pet-blink {
  0%, 45%, 49%, 100% { height: 6px; }
  46%, 48% { height: 2px; }
}
@keyframes pet-signal {
  0%, 100% { opacity: .45; }
  50% { opacity: 1; }
}
@keyframes pet-signal-fast {
  0%, 100% { background: #6ee7ff; box-shadow: 0 0 4px rgb(110 231 255 / 60%); }
  50% { background: #fbbf24; box-shadow: 0 0 10px rgb(251 191 36 / 80%); }
}
@keyframes pet-work {
  0%, 100% { transform: translateY(0) rotate(-1deg); }
  50% { transform: translateY(-3px) rotate(1deg); }
}
@keyframes pet-work-shadow {
  0%, 100% { transform: scaleX(1); }
  50% { transform: scaleX(.76); }
}
@keyframes pet-hop {
  0%, 100% { transform: translateY(0); }
  25%, 50% { transform: translateY(-10px); }
  75% { transform: translateY(-3px); }
}
@keyframes pet-hop-shadow {
  0%, 100% { transform: scaleX(1); opacity: 1; }
  25%, 50% { transform: scaleX(.55); opacity: .45; }
  75% { transform: scaleX(.8); opacity: .7; }
}
@keyframes pet-scan {
  0%, 100% { box-shadow: inset 0 0 0 rgb(99 213 255 / 0%); }
  25% { box-shadow: inset 12px 0 0 rgb(99 213 255 / 16%); }
  50% { box-shadow: inset -12px 0 0 rgb(99 213 255 / 16%); }
  75% { box-shadow: inset 0 0 12px rgb(99 213 255 / 22%); }
}
@keyframes pet-dream {
  0% { transform: translate(0, 4px) scale(.8); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: translate(7px, -8px) scale(1.1); opacity: 0; }
}
@keyframes speech-pop {
  0% { transform: scale(.92); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@media (max-width: 620px) {
  .pet-speech { width: min(250px, calc(100vw - 96px)); }
}
</style>
