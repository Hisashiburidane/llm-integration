<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { CallerEmotionInsight } from './useCustomerServiceAgent';

const PET_POSITION_KEY = 'enchantforge.customer-service-emotion-pet.position';
const PET_WIDTH = 80;
const PET_HEIGHT = 66;
const EDGE_GAP = 12;

const props = defineProps<{
  active: boolean;
  insight: CallerEmotionInsight;
  speaker: string;
}>();

const bubbleVisible = ref(true);
const positioned = ref(false);
const dragging = ref(false);
const position = ref({ x: 20, y: 20 });
const viewport = ref({ width: 0, height: 0 });
let suppressClick = false;
let dragStart: {
  pointerId: number;
  clientX: number;
  clientY: number;
  x: number;
  y: number;
} | undefined;

const emotionClass = computed(() => ({
  等待识别: 'waiting',
  平静: 'calm',
  犹豫: 'hesitant',
  焦虑: 'anxious',
  失望: 'disappointed',
  不耐烦: 'impatient',
  生气: 'angry'
}[props.insight.emotion]));

const idleMessage = computed(() => {
  if (props.active) return '正在从累计 offline 文本中识别表达变化';
  return '接入通话后，我会关注措辞、重复和催促信号';
});

const bubbleOnLeft = computed(() => {
  const bubbleWidth = Math.min(320, Math.max(220, viewport.value.width - 112));
  return position.value.x + PET_WIDTH + bubbleWidth + 28 > viewport.value.width;
});

const rootStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`
}));

function clampPosition(value: { x: number; y: number }) {
  return {
    x: Math.min(Math.max(EDGE_GAP, value.x), Math.max(EDGE_GAP, viewport.value.width - PET_WIDTH - EDGE_GAP)),
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

function toggleBubble() {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  bubbleVisible.value = !bubbleVisible.value;
}

watch(() => props.insight.timestamp, (timestamp) => {
  if (timestamp) bubbleVisible.value = true;
});

onMounted(() => {
  viewport.value = { width: window.innerWidth, height: window.innerHeight };
  let restoredPosition: { x?: unknown; y?: unknown } | undefined;
  try {
    restoredPosition = JSON.parse(window.localStorage.getItem(PET_POSITION_KEY) ?? 'null') as
      | { x?: unknown; y?: unknown }
      | undefined;
  } catch {
    restoredPosition = undefined;
  }
  position.value = clampPosition({
    x: typeof restoredPosition?.x === 'number' ? restoredPosition.x : 20,
    y: typeof restoredPosition?.y === 'number'
      ? restoredPosition.y
      : window.innerHeight - PET_HEIGHT - 24
  });
  positioned.value = true;
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<template>
  <aside
    class="emotion-pet"
    :class="[
      `emotion-${emotionClass}`,
      {
        positioned,
        dragging,
        working: active,
        'bubble-left': bubbleOnLeft
      }
    ]"
    :style="rootStyle"
    aria-label="来电情绪辅助"
  >
    <Transition name="emotion-bubble" mode="out-in">
      <button
        v-if="bubbleVisible"
        :key="`${insight.emotion}-${insight.timestamp}`"
        type="button"
        class="emotion-bubble"
        aria-label="关闭来电情绪提示"
        @click="bubbleVisible = false"
      >
        <span class="bubble-close" aria-hidden="true">×</span>
        <header>
          <span>CALL MOOD / {{ speaker }}</span>
          <strong>{{ insight.emotion }}</strong>
          <small v-if="insight.emotion !== '等待识别'">置信度 {{ insight.confidence }}</small>
        </header>
        <template v-if="insight.emotion !== '等待识别'">
          <p><b>依据</b>{{ insight.evidence }}</p>
          <p><b>建议</b>{{ insight.guidance }}</p>
        </template>
        <p v-else class="emotion-idle">{{ idleMessage }}</p>
      </button>
    </Transition>

    <button
      type="button"
      class="pet-avatar"
      :aria-grabbed="dragging"
      aria-label="打开或拖动来电情绪助手"
      @pointerdown="startDrag"
      @pointermove="movePet"
      @pointerup="endDrag"
      @pointercancel="endDrag"
      @click="toggleBubble"
    >
      <span class="pet-antenna"></span>
      <span class="pet-screen">
        <i></i>
        <i></i>
        <b></b>
      </span>
      <span class="pet-label">ATX 98</span>
      <span class="pet-feet" aria-hidden="true"><i></i><i></i></span>
    </button>
  </aside>
</template>

<style scoped src="./CallerEmotionPet.css"></style>
