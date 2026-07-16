<script setup lang="ts">
import { MessageOutlined } from '@ant-design/icons-vue';
import { Badge, Collapse, CollapsePanel } from 'ant-design-vue';
import { Bubble, Sender, ThoughtChain, type ThoughtChainProps } from 'ant-design-x-vue';
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
type ActivityItem = {
  id: number;
  type: 'activity';
  status: 'running' | 'done' | 'failed';
  steps: AuraActivityStep[];
  expandedKeys: string[];
  startedAt: number;
  finishedAt?: number;
};
type ConversationItem = ChatItem | ActivityItem;

const ORB_SIZE = 56;
const VIEWPORT_GAP = 16;
const forge = useEnchantForge();
const input = ref('');
const loading = ref(false);
const open = ref(false);
const conversation = ref<ConversationItem[]>([]);
const clock = ref(Date.now());
let clockTimer: number | undefined;
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

function latestActivityStep(activity: ActivityItem) {
  return activity.steps[activity.steps.length - 1];
}

function activityBadgeStatus(activity: ActivityItem): 'processing' | 'success' | 'error' {
  if (activity.status === 'failed') return 'error';
  if (activity.status === 'done') return 'success';
  return 'processing';
}

function thoughtChainItems(activity: ActivityItem): ThoughtChainProps['items'] {
  return activity.steps.map((step) => ({
    key: step.id,
    title: step.label,
    description: step.total ? `${step.current ?? 0}/${step.total}` : undefined,
    status: step.status === 'failed' ? 'error' : step.status === 'done' ? 'success' : 'pending'
  }));
}

function startClock() {
  clock.value = Date.now();
  window.clearInterval(clockTimer);
  clockTimer = window.setInterval(() => {
    clock.value = Date.now();
  }, 1000);
}

function stopClock() {
  window.clearInterval(clockTimer);
  clockTimer = undefined;
}

function formatActivityDuration(activity: ActivityItem) {
  const elapsed = Math.max(0, (activity.finishedAt ?? clock.value) - activity.startedAt);
  if (elapsed < 1000) return '< 1 秒';
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

async function submit(message?: string) {
  const question = (message ?? input.value).trim();
  if (!question || loading.value) return;
  input.value = '';
  conversation.value.push({ id: Date.now(), type: 'message', role: 'user', content: question });
  const activity = reactive<ActivityItem>({
    id: Date.now() + 1,
    type: 'activity',
    status: 'running',
    steps: [],
    expandedKeys: [],
    startedAt: Date.now()
  });
  conversation.value.push(activity);
  loading.value = true;
  startClock();
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
    activity.finishedAt = Date.now();
    clock.value = activity.finishedAt;
    stopClock();
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
onBeforeUnmount(() => {
  stopClock();
  window.removeEventListener('resize', updateViewport);
});
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
        <span v-else class="aura-bubble" :class="`status-${auraStatus}`">
          <MessageOutlined class="aura-bubble-icon" />
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
          <Bubble
            v-if="item.type === 'message'"
            :content="item.content"
            :placement="item.role === 'user' ? 'end' : 'start'"
            :variant="item.role === 'user' ? 'filled' : 'borderless'"
            :class="['aura-chat-bubble', item.role]"
          />
          <Bubble v-else placement="start" variant="borderless" class="aura-chat-bubble aura-activity-bubble">
            <template #message>
              <slot
                name="progress"
                :activity="item"
                :current-step="latestActivityStep(item)"
                :history-items="thoughtChainItems(item)"
              >
                <Collapse v-model:active-key="item.expandedKeys" ghost class="aura-progress-collapse">
                  <CollapsePanel key="history">
                    <template #header>
                      <span class="activity-current">
                        <Badge :status="activityBadgeStatus(item)" />
                        <span>{{ latestActivityStep(item)?.label || '正在准备执行' }}</span>
                        <code v-if="latestActivityStep(item)?.total">
                          {{ latestActivityStep(item)?.current }}/{{ latestActivityStep(item)?.total }}
                        </code>
                        <small>{{ formatActivityDuration(item) }}</small>
                      </span>
                    </template>
                    <ThoughtChain :items="thoughtChainItems(item)" size="small" />
                  </CollapsePanel>
                </Collapse>
              </slot>
            </template>
          </Bubble>
        </template>
      </div>

      <div class="aura-input">
        <Sender
          v-model:value="input"
          :loading="loading"
          :disabled="loading"
          :send-disabled="loading || !input.trim()"
          :auto-size="{ minRows: 2, maxRows: 4 }"
          submit-type="enter"
          placeholder="描述你要在当前界面完成的操作"
          @submit="submit"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.enchant-aura { position: fixed; z-index: 1000; color: #1f2937; font-family: Inter, "Segoe UI", sans-serif; letter-spacing: 0; }
.enchant-aura.appearance-inline { position: relative; inset: auto; }
.enchant-aura.dragging { user-select: none; }
.aura-trigger { display: grid; width: 56px; height: 56px; padding: 0; place-items: center; border: 0; border-radius: 50%; background: transparent; cursor: grab; }
.aura-bubble { position: relative; display: grid; width: 52px; height: 52px; place-items: center; border: 1px solid #d9d9d9; border-radius: 50%; color: #1677ff; background: #fff; box-shadow: 0 6px 18px #0000001f; transition: border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease; }
.aura-trigger:hover .aura-bubble { border-color: #1677ff; box-shadow: 0 8px 22px #1677ff24; transform: translateY(-1px); }
.aura-bubble-icon { font-size: 23px; }
.aura-bubble i { position: absolute; right: 3px; bottom: 3px; width: 9px; height: 9px; border: 2px solid #fff; border-radius: 50%; background: #94a3b8; }
.aura-bubble.status-ready i { background: #1677ff; }
.aura-bubble.status-running i { background: #f0b429; animation: aura-pulse 1.2s ease-in-out infinite; }
.aura-panel { display: flex; width: min(400px, calc(100vw - 32px)); height: min(620px, calc(100vh - 32px)); flex-direction: column; overflow: hidden; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; box-shadow: 0 24px 70px #1e3a5f3d; }
.aura-header { display: flex; gap: 10px; align-items: center; padding: 14px; border-bottom: 1px solid #e5e7eb; background: #f8fafc; cursor: grab; }
.aura-header-mark { display: grid; flex: 0 0 34px; width: 34px; height: 34px; place-items: center; border-radius: 50%; color: #fff; background: #1677ff; font: 700 12px/1 ui-monospace, monospace; }
.aura-header div { min-width: 0; }
.aura-header strong, .aura-header small { display: block; }
.aura-header strong { font-size: 13px; }
.aura-header small { margin-top: 3px; overflow: hidden; color: #64748b; font: 10px/1.4 ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
.aura-header button { margin-left: auto; border: 0; color: #64748b; background: transparent; font-size: 24px; cursor: pointer; }
.aura-messages { display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 8px; padding: 14px; overflow-y: auto; }
.aura-empty { margin: auto 8px; color: #64748b; font-size: 12px; line-height: 1.7; }
.aura-chat-bubble { width: 100%; font-size: 12px; }
.aura-activity-bubble { margin: -4px 0; }
.aura-progress-collapse { width: min(100%, 340px); border: 0; background: transparent; }
.activity-current { display: grid; width: 100%; min-width: 0; grid-template-columns: auto minmax(0, 1fr) auto auto; gap: 7px; align-items: center; color: #526477; font-size: 11px; line-height: 1.4; }
.activity-current > span:nth-child(2) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.activity-current code { color: #7b8a9a; font-size: 9px; }
.activity-current small { color: #8a99a8; font-size: 9px; white-space: nowrap; }
.aura-input { padding: 12px; border-top: 1px solid #e5e7eb; }
:deep(.aura-progress-collapse .ant-collapse-header) { align-items: center !important; padding: 5px 4px !important; }
:deep(.aura-progress-collapse .ant-collapse-content-box) { padding: 8px 4px 4px 24px !important; }
:deep(.aura-activity-bubble .ant-bubble-content) { width: 100%; padding: 0; background: transparent; }
@keyframes aura-pulse { 0%, 100% { opacity: .65; } 50% { opacity: 1; } }
</style>
