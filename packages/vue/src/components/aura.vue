<script setup lang="ts">
import { Bubble, Sender, ThoughtChain, type ThoughtChainProps } from 'ant-design-x-vue';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import MarkdownContent from './markdown-content.vue';
import { createDefaultEnchantAgent } from '../runtime/agent';
import type { EnchantConfirmationRequest } from '../runtime/forge';
import type { EnchantProgressEvent, EnchantRunResult } from '../runtime/enchantment';
import { useEnchantForge } from '../runtime/forge';
import type {
  AuraActivity,
  AuraClearReason,
  AuraCompleteEvent,
  AuraConversationItem,
  AuraErrorEvent,
  AuraInstance,
  AuraMessage,
  AuraProps,
  AuraSubmitEvent
} from '../runtime/aura';
import { formatAuraProgress } from '../runtime/presentation';

const props = withDefaults(defineProps<AuraProps>(), {
  page: '',
  appearance: 'orb',
  orb: undefined,
  title: 'Aura',
  prompt: '',
  placeholder: '描述你要在当前界面完成的操作',
  markdown: true,
  suggestions: () => [],
  progressMessages: () => ({}),
  model: '',
  endpoint: '/api/llm/chat/completions',
  apiKey: '',
  configError: '',
  open: undefined,
  defaultOpen: false,
  initialMessages: () => [],
  historyLimit: 20,
  clearOnPageChange: true
});

const emit = defineEmits<{
  'update:open': [value: boolean];
  submit: [event: AuraSubmitEvent];
  complete: [event: AuraCompleteEvent];
  error: [event: AuraErrorEvent];
  cancel: [];
  clear: [reason: AuraClearReason];
}>();

const ORB_SIZE = 56;
const VIEWPORT_GAP = 16;
let itemSequence = 0;
const forge = useEnchantForge();
const input = ref('');
const loading = ref(false);
const internalOpen = ref(props.defaultOpen);
const conversation = ref<AuraConversationItem[]>(props.initialMessages.map((message) => createMessage(message.role, message.content)));
const clock = ref(Date.now());
const sender = ref<{ focus(options?: { cursor?: 'start' | 'end' | 'all' }): void }>();
let clockTimer: number | undefined;
let activeRunController: AbortController | undefined;
let conversationVersion = 0;
const anchor = reactive({ x: 0, y: 0 });
const viewport = reactive({ width: 0, height: 0 });
const drag = reactive({ active: false, moved: false, offsetX: 0, offsetY: 0 });
const legacyAgent = computed(() => props.model ? createDefaultEnchantAgent({
  model: props.model,
  endpoint: props.endpoint,
  apiKey: props.apiKey,
  configError: props.configError
}) : undefined);
const resolvedAgent = computed(() => props.agent ?? props.caster ?? legacyAgent.value);
const isOpen = computed({
  get: () => props.open ?? internalOpen.value,
  set: (value: boolean) => {
    if (props.open === undefined) internalOpen.value = value;
    emit('update:open', value);
  }
});
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
  if (!isOpen.value) return { x: anchor.x, y: anchor.y };
  return {
    x: clamp(anchor.x + ORB_SIZE - panelSize.value.width, VIEWPORT_GAP, viewport.width - panelSize.value.width - VIEWPORT_GAP),
    y: clamp(anchor.y + ORB_SIZE - panelSize.value.height, VIEWPORT_GAP, viewport.height - panelSize.value.height - VIEWPORT_GAP)
  };
});
const rootStyle = computed(() => props.appearance === 'inline' ? undefined : {
  left: `${displayPosition.value.x}px`,
  top: `${displayPosition.value.y}px`
});

function createItemId(prefix: string) {
  itemSequence += 1;
  return `${prefix}-${Date.now()}-${itemSequence}`;
}

function createMessage(role: AuraMessage['role'], content: string, status: AuraMessage['status'] = 'sent'): AuraMessage {
  return { id: createItemId('message'), type: 'message', role, content, status };
}

function getMessages() {
  return conversation.value
    .filter((item): item is AuraMessage => item.type === 'message' && item.status === 'sent')
    .map(({ role, content }) => ({ role, content }));
}

function getHistory() {
  const limit = Math.max(0, props.historyLimit);
  return limit ? getMessages().slice(-limit) : [];
}

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
  if (isOpen.value) {
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
  toggleAura();
}

function progressHandler(activity: AuraActivity) {
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

function latestActivityStep(activity: AuraActivity) {
  return activity.steps[activity.steps.length - 1];
}

function toggleActivity(activity: AuraActivity) {
  const index = activity.expandedKeys.indexOf('history');
  if (index === -1) activity.expandedKeys.push('history');
  else activity.expandedKeys.splice(index, 1);
}

function activityStatusClass(activity: AuraActivity) {
  return `activity-status-${activity.status}`;
}

function thoughtChainItems(activity: AuraActivity): ThoughtChainProps['items'] {
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

function formatActivityDuration(activity: AuraActivity) {
  const elapsed = Math.max(0, (activity.finishedAt ?? clock.value) - activity.startedAt);
  if (elapsed < 1000) return '< 1 秒';
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

async function submit(message?: string): Promise<EnchantRunResult | undefined> {
  const question = (message ?? input.value).trim();
  if (!question || loading.value) return;
  const history = getHistory();
  const submitEvent = { input: question, history };
  emit('submit', submitEvent);
  const version = conversationVersion;
  const controller = new AbortController();
  activeRunController = controller;
  input.value = '';
  conversation.value.push(createMessage('user', question));
  const activity = reactive<AuraActivity>({
    id: createItemId('activity'),
    type: 'activity',
    status: 'running',
    steps: [],
    expandedKeys: [],
    startedAt: Date.now()
  });
  conversation.value.push(activity);
  loading.value = true;
  startClock();
  const handleProgress = progressHandler(activity);
  try {
    const result = await forge.run({
      input: question,
      page: props.page || undefined,
      prompt: props.prompt || undefined,
      agentId: props.agentId || undefined,
      agent: resolvedAgent.value,
      history,
      signal: controller.signal,
      confirm: requestConfirmation,
      onProgress: (event) => {
        if (version === conversationVersion) handleProgress(event);
      }
    });
    if (version !== conversationVersion) return;
    conversation.value.push(createMessage('assistant', result.message || '操作已完成。'));
    emit('complete', { ...submitEvent, result });
    return result;
  } catch (error) {
    if (version !== conversationVersion) return;
    if (controller.signal.aborted) return;
    conversation.value.push(createMessage(
      'assistant',
      error instanceof Error ? error.message : '执行失败。',
      'error'
    ));
    emit('error', { ...submitEvent, error });
  } finally {
    if (version === conversationVersion) {
      activity.finishedAt = Date.now();
      clock.value = activity.finishedAt;
    }
    if (activeRunController === controller) {
      activeRunController = undefined;
      stopClock();
      loading.value = false;
    }
  }
}

function cancel() {
  if (!activeRunController) return;
  activeRunController.abort(new Error('操作已取消。'));
  emit('cancel');
}

function clearConversation(reason: AuraClearReason = 'api') {
  conversationVersion += 1;
  activeRunController?.abort(new Error('聊天记录已清空。'));
  activeRunController = undefined;
  conversation.value = [];
  input.value = '';
  stopClock();
  loading.value = false;
  emit('clear', reason);
}

function openAura() {
  isOpen.value = true;
  focus();
}

function closeAura() {
  isOpen.value = false;
}

function toggleAura() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) focus();
}

function focus() {
  void nextTick(() => sender.value?.focus({ cursor: 'end' }));
}

function requestConfirmation(request: EnchantConfirmationRequest) {
  if (props.confirm) return props.confirm(request);
  if (typeof globalThis.confirm !== 'function') return false;
  return globalThis.confirm(`确认执行当前操作？\n${request.capability.label}（${request.capability.effect}）将作用于当前界面。`);
}

watch(() => props.page, () => {
  if (props.clearOnPageChange) clearConversation('page-change');
});

onMounted(() => {
  restoreAnchor();
  window.addEventListener('resize', updateViewport);
});
onBeforeUnmount(() => {
  conversationVersion += 1;
  activeRunController?.abort(new Error('Aura 已卸载。'));
  activeRunController = undefined;
  stopClock();
  window.removeEventListener('resize', updateViewport);
});

defineExpose<AuraInstance>({
  open: openAura,
  close: closeAura,
  toggle: toggleAura,
  focus,
  submit,
  cancel,
  clear: () => clearConversation('api'),
  getMessages
});
</script>

<template>
  <div
    class="enchant-aura"
    :class="[`appearance-${appearance}`, { open: isOpen, dragging: drag.active }]"
    :style="rootStyle"
    @pointermove="moveDrag"
    @pointerup="endDrag"
    @pointercancel="endDrag"
  >
    <button
      v-if="!isOpen"
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
          <svg class="aura-bubble-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5.5 5.5h13v9.25h-7.25L7 18.5v-3.75H5.5z" />
          </svg>
          <i></i>
        </span>
      </slot>
    </button>

    <section v-else class="aura-panel">
      <header class="aura-header" @pointerdown="beginDrag">
        <span class="aura-header-mark">A</span>
        <div class="aura-header-copy">
          <strong>{{ title }}</strong>
          <small>{{ digest.pageId }} / {{ digest.activeEnchantments }} enchantments</small>
        </div>
        <div class="aura-header-actions">
          <button
            type="button"
            class="aura-clear"
            :disabled="!conversation.length && !input && !loading"
            aria-label="清空聊天记录"
            title="清空聊天记录"
            @pointerdown.stop
            @click="clearConversation('user')"
          >
            清空
          </button>
          <button type="button" class="aura-close" aria-label="关闭 Aura" @pointerdown.stop @click="closeAura">×</button>
        </div>
      </header>

      <div class="aura-messages">
        <div v-if="!conversation.length" class="aura-empty">
          <p>当前页面包含 {{ digest.activeEnchantments }} 个可用 Enchantment。</p>
          <div v-if="suggestions.length" class="aura-suggestions" aria-label="快捷提问">
            <button v-for="suggestion in suggestions" :key="suggestion" type="button" :disabled="loading" @click="submit(suggestion)">
              {{ suggestion }}
            </button>
          </div>
        </div>
        <template v-for="item in conversation" :key="item.id">
          <Bubble
            v-if="item.type === 'message'"
            :content="item.content"
            :placement="item.role === 'user' ? 'end' : 'start'"
            :variant="item.role === 'user' ? 'filled' : 'borderless'"
            :class="['aura-chat-bubble', item.role]"
          >
            <template #message>
              <slot name="message" :message="item">
                <MarkdownContent v-if="item.role === 'assistant' && markdown" :content="item.content" />
                <span v-else class="aura-plain-message">{{ item.content }}</span>
              </slot>
            </template>
          </Bubble>
          <Bubble v-else placement="start" variant="borderless" class="aura-chat-bubble aura-activity-bubble">
            <template #message>
              <slot
                name="progress"
                :activity="item"
                :current-step="latestActivityStep(item)"
                :history-items="thoughtChainItems(item)"
              >
                <div class="aura-progress-collapse">
                  <button type="button" class="activity-toggle" @click="toggleActivity(item)">
                    <span class="activity-current">
                      <i class="activity-status-dot" :class="activityStatusClass(item)"></i>
                      <span>{{ latestActivityStep(item)?.label || '正在准备执行' }}</span>
                      <code v-if="latestActivityStep(item)?.total">
                        {{ latestActivityStep(item)?.current }}/{{ latestActivityStep(item)?.total }}
                      </code>
                      <small>{{ formatActivityDuration(item) }}</small>
                    </span>
                    <span class="activity-chevron">{{ item.expandedKeys.includes('history') ? '−' : '+' }}</span>
                  </button>
                  <ThoughtChain
                    v-if="item.expandedKeys.includes('history')"
                    :items="thoughtChainItems(item)"
                    size="small"
                  />
                </div>
              </slot>
            </template>
          </Bubble>
        </template>
      </div>

      <div class="aura-input">
        <div
          v-if="conversation.length && suggestions.length && !loading"
          class="aura-follow-up-suggestions"
          aria-label="继续提问"
        >
          <button
            v-for="suggestion in suggestions"
            :key="suggestion"
            type="button"
            @click="submit(suggestion)"
          >
            {{ suggestion }}
          </button>
        </div>
        <Sender
          ref="sender"
          v-model:value="input"
          :loading="loading"
          :read-only="loading"
          :send-disabled="loading || !input.trim()"
          :auto-size="{ minRows: 2, maxRows: 4 }"
          submit-type="enter"
          :placeholder="placeholder"
          @cancel="cancel"
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
.aura-bubble-icon { width: 24px; height: 24px; fill: none; stroke: currentcolor; stroke-linejoin: round; stroke-width: 1.7; }
.aura-bubble i { position: absolute; right: 3px; bottom: 3px; width: 9px; height: 9px; border: 2px solid #fff; border-radius: 50%; background: #94a3b8; }
.aura-bubble.status-ready i { background: #1677ff; }
.aura-bubble.status-running i { background: #f0b429; animation: aura-pulse 1.2s ease-in-out infinite; }
.aura-panel { display: flex; width: min(400px, calc(100vw - 32px)); height: min(620px, calc(100vh - 32px)); flex-direction: column; overflow: hidden; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; box-shadow: 0 24px 70px #1e3a5f3d; }
.aura-header { display: flex; gap: 10px; align-items: center; padding: 14px; border-bottom: 1px solid #e5e7eb; background: #f8fafc; cursor: grab; }
.aura-header-mark { display: grid; flex: 0 0 34px; width: 34px; height: 34px; place-items: center; border-radius: 50%; color: #fff; background: #1677ff; font: 700 12px/1 ui-monospace, monospace; }
.aura-header-copy { flex: 1; min-width: 0; }
.aura-header strong, .aura-header small { display: block; }
.aura-header strong { font-size: 13px; }
.aura-header small { margin-top: 3px; overflow: hidden; color: #64748b; font: 10px/1.4 ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
.aura-header-actions { display: flex; margin-left: auto; align-items: center; gap: 4px; }
.aura-header-actions button { border: 0; color: #64748b; background: transparent; cursor: pointer; }
.aura-header-actions button:disabled { cursor: not-allowed; opacity: .38; }
.aura-clear { padding: 5px 7px; border-radius: 4px !important; font-size: 11px; }
.aura-clear:hover:not(:disabled) { color: #1677ff; background: #eaf3ff; }
.aura-close { width: 28px; height: 28px; padding: 0; font-size: 24px; line-height: 24px; }
.aura-messages { display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 8px; padding: 14px; overflow-y: auto; }
.aura-empty { display: flex; margin: auto 8px; flex-direction: column; gap: 12px; color: #64748b; font-size: 12px; line-height: 1.7; }
.aura-empty p { margin: 0; }
.aura-suggestions { display: flex; flex-wrap: wrap; gap: 7px; }
.aura-suggestions button { padding: 6px 8px; border: 1px solid #dbe3ec; border-radius: 5px; color: #36516f; background: #f8fafc; cursor: pointer; font: 11px/1.4 inherit; text-align: left; transition: border-color 140ms ease, color 140ms ease, background 140ms ease; }
.aura-suggestions button:hover:not(:disabled) { border-color: #91b8ec; color: #165dba; background: #eff6ff; }
.aura-suggestions button:disabled { cursor: not-allowed; opacity: .55; }
.aura-follow-up-suggestions { display: flex; gap: 6px; padding: 0 0 9px; overflow-x: auto; scrollbar-width: thin; }
.aura-follow-up-suggestions button { flex: 0 0 auto; max-width: 280px; padding: 5px 8px; overflow: hidden; border: 1px solid #dbe3ec; border-radius: 5px; color: #36516f; background: #f8fafc; cursor: pointer; font-size: 10px; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
.aura-follow-up-suggestions button:hover { border-color: #91b8ec; color: #165dba; background: #eff6ff; }
.aura-chat-bubble { width: 100%; font-size: 12px; }
.aura-plain-message { white-space: pre-wrap; }
.aura-activity-bubble { margin: -4px 0; }
.aura-progress-collapse { width: min(100%, 340px); }
.activity-toggle { display: flex; width: 100%; min-width: 0; align-items: center; gap: 7px; padding: 5px 4px; border: 0; color: #526477; background: transparent; cursor: pointer; text-align: left; }
.activity-current { display: grid; flex: 1; min-width: 0; grid-template-columns: auto minmax(0, 1fr) auto auto; gap: 7px; align-items: center; font-size: 11px; line-height: 1.4; }
.activity-current > span:nth-child(2) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.activity-current code { color: #7b8a9a; font-size: 9px; }
.activity-current small { color: #8a99a8; font-size: 9px; white-space: nowrap; }
.activity-chevron { color: #8a99a8; font-size: 15px; line-height: 1; }
.activity-status-dot { width: 7px; height: 7px; border-radius: 50%; background: #94a3b8; }
.activity-status-running { background: #f0b429; animation: aura-pulse 1.2s ease-in-out infinite; }
.activity-status-done { background: #52c41a; }
.activity-status-failed { background: #ff4d4f; }
.aura-input { padding: 12px; border-top: 1px solid #e5e7eb; }
:deep(.aura-activity-bubble .ant-bubble-content) { width: 100%; padding: 0; background: transparent; }
@keyframes aura-pulse { 0%, 100% { opacity: .65; } 50% { opacity: 1; } }
</style>
