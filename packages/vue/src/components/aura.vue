<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, type Component } from 'vue';
import { createDefaultEnchantAgent, type EnchantAgent } from '../runtime/agent';
import type { EnchantProgressEvent } from '../runtime/enchantment';
import { useEnchantForge } from '../runtime/forge';
import {
  formatAuraProgress,
  type AuraActivityStep,
  type AuraProgressMessages
} from '../runtime/presentation';

const props = withDefaults(defineProps<{
  page?: string;
  agent?: EnchantAgent;
  caster?: EnchantAgent;
  appearance?: 'orb' | 'dock' | 'inline';
  orb?: Component;
  title?: string;
  prompt?: string;
  progressMessages?: AuraProgressMessages;
  model?: string;
  endpoint?: string;
  apiKey?: string;
  configError?: string;
}>(), {
  page: '',
  appearance: 'orb',
  orb: undefined,
  title: 'Aura',
  prompt: '',
  progressMessages: () => ({}),
  model: '',
  endpoint: '/api/llm/chat/completions',
  apiKey: '',
  configError: ''
});

type ChatItem = { id: number; type: 'message'; role: 'assistant' | 'user'; content: string };
type ActivityItem = { id: number; type: 'activity'; status: 'running' | 'done' | 'failed'; steps: AuraActivityStep[] };
type ConversationItem = ChatItem | ActivityItem;

const ORB_SIZE = 64;
const VIEWPORT_GAP = 16;
const forge = useEnchantForge();
const input = ref('');
const loading = ref(false);
const open = ref(false);
const conversation = ref<ConversationItem[]>([]);
const anchor = reactive({ x: 0, y: 0 });
const viewport = reactive({ width: 0, height: 0 });
const drag = reactive({ active: false, moved: false, offsetX: 0, offsetY: 0 });
const legacyAgent = computed(() => props.model ? createDefaultEnchantAgent({
  model: props.model,
  endpoint: props.endpoint,
  apiKey: props.apiKey,
  configError: props.configError
}) : undefined);
const resolvedAgent = computed(() => props.agent ?? props.caster ?? legacyAgent.value ?? forge.agent);
const digest = computed(() => {
  forge.registry.version.value;
  return forge.digest({ page: props.page || undefined });
});
const auraStatus = computed(() => loading.value ? 'running' : digest.value.activeEnchantments ? 'ready' : 'idle');
const panelSize = computed(() => ({
  width: Math.min(400, Math.max(280, viewport.width - VIEWPORT_GAP * 2)),
  height: Math.min(620, Math.max(360, viewport.height - VIEWPORT_GAP * 2))
}));
const displayPosition = computed(() => {
  if (!open.value) return { x: anchor.x, y: anchor.y };
  return {
    x: clamp(anchor.x + ORB_SIZE - panelSize.value.width, VIEWPORT_GAP, viewport.width - panelSize.value.width - VIEWPORT_GAP),
    y: clamp(anchor.y + ORB_SIZE - panelSize.value.height, VIEWPORT_GAP, viewport.height - panelSize.value.height - VIEWPORT_GAP)
  };
});
const rootStyle = computed(() => props.appearance === 'inline' ? undefined : {
  left: `${displayPosition.value.x}px`,
  top: `${displayPosition.value.y}px`
});

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(value, Math.max(minimum, maximum)));
}

function clampAnchor() {
  anchor.x = clamp(anchor.x, VIEWPORT_GAP, viewport.width - ORB_SIZE - VIEWPORT_GAP);
  anchor.y = clamp(anchor.y, VIEWPORT_GAP, viewport.height - ORB_SIZE - VIEWPORT_GAP);
}

function updateViewport() {
  viewport.width = window.innerWidth;
  viewport.height = window.innerHeight;
  clampAnchor();
}

function restoreAnchor() {
  updateViewport();
  try {
    const saved = JSON.parse(localStorage.getItem('enchantforge:aura-anchor') || 'null') as { x?: number; y?: number } | null;
    anchor.x = saved?.x ?? viewport.width - ORB_SIZE - 24;
    anchor.y = saved?.y ?? viewport.height - ORB_SIZE - 24;
  } catch {
    anchor.x = viewport.width - ORB_SIZE - 24;
    anchor.y = viewport.height - ORB_SIZE - 24;
  }
  clampAnchor();
}

function beginDrag(event: PointerEvent) {
  if (props.appearance === 'inline') return;
  drag.active = true;
  drag.moved = false;
  drag.offsetX = event.clientX - displayPosition.value.x;
  drag.offsetY = event.clientY - displayPosition.value.y;
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
}

function moveDrag(event: PointerEvent) {
  if (!drag.active) return;
  const left = event.clientX - drag.offsetX;
  const top = event.clientY - drag.offsetY;
  if (Math.abs(left - displayPosition.value.x) > 2 || Math.abs(top - displayPosition.value.y) > 2) drag.moved = true;
  if (open.value) {
    anchor.x = left + panelSize.value.width - ORB_SIZE;
    anchor.y = top + panelSize.value.height - ORB_SIZE;
  } else {
    anchor.x = left;
    anchor.y = top;
  }
  clampAnchor();
}

function endDrag() {
  if (!drag.active) return;
  drag.active = false;
  localStorage.setItem('enchantforge:aura-anchor', JSON.stringify(anchor));
}

function toggleOpen() {
  if (drag.moved) return;
  open.value = !open.value;
}

function progressHandler(activity: ActivityItem) {
  return (event: EnchantProgressEvent) => {
    activity.steps.forEach((step) => {
      if (step.status === 'running') step.status = event.phase === 'failed' ? 'failed' : 'done';
    });
    const label = formatAuraProgress(event, digest.value, props.progressMessages);
    const repeated = event.phase === 'executing' && event.detail;
    const previous = repeated
      ? undefined
      : [...activity.steps].reverse().find((step) => step.phase === event.phase && step.label === label);
    if (previous) {
      previous.status = event.phase === 'failed' ? 'failed' : event.phase === 'completed' ? 'done' : 'running';
      previous.current = event.current;
      previous.total = event.total;
    } else {
      activity.steps.push({
        id: event.id,
        phase: event.phase,
        label,
        status: event.phase === 'failed' ? 'failed' : event.phase === 'completed' ? 'done' : 'running',
        current: event.current,
        total: event.total
      });
    }
    activity.status = event.phase === 'failed' ? 'failed' : event.phase === 'completed' ? 'done' : 'running';
  };
}

async function submit() {
  const question = input.value.trim();
  if (!question || loading.value) return;
  input.value = '';
  conversation.value.push({ id: Date.now(), type: 'message', role: 'user', content: question });
  const activity = reactive<ActivityItem>({
    id: Date.now() + 1,
    type: 'activity',
    status: 'running',
    steps: []
  });
  conversation.value.push(activity);
  loading.value = true;
  try {
    const result = await forge.run({
      input: question,
      page: props.page || undefined,
      prompt: props.prompt || undefined,
      agent: resolvedAgent.value,
      onProgress: progressHandler(activity)
    });
    conversation.value.push({
      id: Date.now() + 2,
      type: 'message',
      role: 'assistant',
      content: result.message || '操作已完成。'
    });
  } catch (error) {
    conversation.value.push({
      id: Date.now() + 2,
      type: 'message',
      role: 'assistant',
      content: error instanceof Error ? error.message : '执行失败。'
    });
  } finally {
    loading.value = false;
  }
}

watch(() => props.page, () => {
  conversation.value = [];
});

onMounted(() => {
  restoreAnchor();
  window.addEventListener('resize', updateViewport);
});
onBeforeUnmount(() => window.removeEventListener('resize', updateViewport));
</script>

<template>
  <div
    class="enchant-aura"
    :class="[`appearance-${appearance}`, { open, dragging: drag.active }]"
    :style="rootStyle"
    @pointermove="moveDrag"
    @pointerup="endDrag"
    @pointercancel="endDrag"
  >
    <button
      v-if="!open"
      class="aura-trigger"
      type="button"
      aria-label="打开 Aura"
      :title="title"
      @pointerdown="beginDrag"
      @click="toggleOpen"
    >
      <slot name="orb" :status="auraStatus" :active-count="digest.activeEnchantments">
        <component
          :is="orb"
          v-if="orb"
          :status="auraStatus"
          :active-count="digest.activeEnchantments"
        />
        <span v-else class="aura-crystal" :class="`status-${auraStatus}`">
          <span class="crystal-core">A</span>
          <i></i>
        </span>
      </slot>
    </button>

    <section v-else class="aura-panel">
      <header class="aura-header" @pointerdown="beginDrag">
        <span class="aura-header-mark">A</span>
        <div>
          <strong>{{ title }}</strong>
          <small>{{ digest.pageId }} / {{ digest.activeEnchantments }} enchantments</small>
        </div>
        <button type="button" aria-label="关闭 Aura" @pointerdown.stop @click="open = false">×</button>
      </header>

      <div class="aura-messages">
        <p v-if="!conversation.length" class="aura-empty">
          当前页面包含 {{ digest.activeEnchantments }} 个可用 Enchantment。
        </p>
        <template v-for="item in conversation" :key="item.id">
          <p v-if="item.type === 'message'" class="aura-message" :class="item.role">
            {{ item.content }}
          </p>
          <div v-else class="aura-activity" :class="item.status">
            <slot name="progress" :activity="item">
              <div v-for="step in item.steps" :key="step.id" class="activity-step" :class="step.status">
                <span class="activity-indicator"></span>
                <span>{{ step.label }}</span>
                <code v-if="step.total">{{ step.current }}/{{ step.total }}</code>
              </div>
            </slot>
          </div>
        </template>
      </div>

      <form class="aura-input" @submit.prevent="submit">
        <textarea v-model="input" :disabled="loading" placeholder="描述你要在当前界面完成的操作" @keydown.ctrl.enter="submit"></textarea>
        <button type="submit" :disabled="loading || !input.trim()">{{ loading ? '执行中' : '发送' }}</button>
      </form>
    </section>
  </div>
</template>

<style scoped>
.enchant-aura { position: fixed; z-index: 1000; color: #1f2937; font-family: Inter, "Segoe UI", sans-serif; letter-spacing: 0; }
.enchant-aura.appearance-inline { position: relative; inset: auto; }
.enchant-aura.dragging { user-select: none; }
.aura-trigger { display: grid; width: 64px; height: 64px; padding: 0; place-items: center; border: 0; border-radius: 50%; background: transparent; cursor: grab; }
.aura-crystal { position: relative; display: grid; width: 58px; height: 58px; place-items: center; overflow: hidden; border: 1px solid #78b9ea; border-radius: 50%; background: radial-gradient(circle at 36% 28%, #e9f8ff 0 8%, #78c6ef 22%, #1769aa 58%, #0b315d 100%); box-shadow: inset -8px -10px 18px #072b5570, inset 7px 7px 14px #ffffff80, 0 10px 28px #1769aa5c, 0 0 0 4px #b9e5ff30; }
.aura-crystal::before { position: absolute; top: 8px; left: 13px; width: 17px; height: 9px; border-radius: 50%; background: #ffffffb8; content: ""; transform: rotate(-24deg); }
.aura-crystal::after { position: absolute; inset: 7px; border: 1px solid #d9f4ff55; border-radius: 50%; content: ""; }
.crystal-core { position: relative; z-index: 1; display: grid; width: 27px; height: 27px; place-items: center; border: 1px solid #c7edff99; border-radius: 50%; color: #fff; background: #0c4f88aa; font: 700 12px/1 ui-monospace, monospace; text-shadow: 0 1px 4px #042443; }
.aura-crystal i { position: absolute; right: 8px; bottom: 8px; z-index: 2; width: 8px; height: 8px; border: 2px solid #e8f8ff; border-radius: 50%; background: #8796a5; }
.aura-crystal.status-ready i { background: #38c790; }
.aura-crystal.status-running i { background: #f4be4f; box-shadow: 0 0 0 4px #f4be4f3d; animation: aura-pulse 1.2s ease-in-out infinite; }
.aura-panel { display: flex; width: min(400px, calc(100vw - 32px)); height: min(620px, calc(100vh - 32px)); flex-direction: column; overflow: hidden; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; box-shadow: 0 24px 70px #1e3a5f3d; }
.aura-header { display: flex; gap: 10px; align-items: center; padding: 14px; border-bottom: 1px solid #e5e7eb; background: #f8fafc; cursor: grab; }
.aura-header-mark { display: grid; flex: 0 0 34px; width: 34px; height: 34px; place-items: center; border-radius: 50%; color: #fff; background: #1769aa; font: 700 12px/1 ui-monospace, monospace; }
.aura-header div { min-width: 0; }
.aura-header strong, .aura-header small { display: block; }
.aura-header strong { font-size: 13px; }
.aura-header small { margin-top: 3px; overflow: hidden; color: #64748b; font: 10px/1.4 ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
.aura-header button { margin-left: auto; border: 0; color: #64748b; background: transparent; font-size: 24px; cursor: pointer; }
.aura-messages { display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 8px; padding: 14px; overflow-y: auto; }
.aura-empty { margin: auto 8px; color: #64748b; font-size: 12px; line-height: 1.7; }
.aura-message { max-width: 88%; margin: 0; padding: 9px 11px; border-radius: 6px; white-space: pre-wrap; font-size: 12px; line-height: 1.6; }
.aura-message.assistant { background: #eef5fb; }
.aura-message.user { align-self: flex-end; color: #fff; background: #1769aa; }
.aura-activity { display: grid; gap: 7px; max-width: 92%; padding: 10px 11px; border: 1px solid #dbe5ee; border-radius: 6px; background: #f8fafc; }
.activity-step { display: grid; grid-template-columns: 12px minmax(0, 1fr) auto; gap: 7px; align-items: center; color: #66778a; font-size: 11px; line-height: 1.4; }
.activity-step.running { color: #174f80; }
.activity-step.failed { color: #b42318; }
.activity-indicator { width: 7px; height: 7px; border: 1px solid #91a4b7; border-radius: 50%; background: #fff; }
.activity-step.done .activity-indicator { border-color: #2e8b68; background: #2e8b68; }
.activity-step.running .activity-indicator { border-color: #1769aa; background: #1769aa; box-shadow: 0 0 0 3px #1769aa24; animation: aura-pulse 1.2s ease-in-out infinite; }
.activity-step.failed .activity-indicator { border-color: #b42318; background: #b42318; }
.activity-step code { color: #7b8a9a; font-size: 9px; }
.aura-input { display: grid; gap: 8px; padding: 12px; border-top: 1px solid #e5e7eb; }
.aura-input textarea { min-height: 76px; padding: 9px 10px; resize: none; border: 1px solid #cbd5e1; border-radius: 5px; color: inherit; background: #fff; font: inherit; }
.aura-input button { justify-self: end; min-width: 68px; padding: 7px 13px; border: 0; border-radius: 4px; color: #fff; background: #1769aa; cursor: pointer; }
.aura-input button:disabled { opacity: .5; cursor: default; }
@keyframes aura-pulse { 0%, 100% { opacity: .65; } 50% { opacity: 1; } }
</style>
