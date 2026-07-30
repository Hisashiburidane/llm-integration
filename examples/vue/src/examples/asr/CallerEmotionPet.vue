<script setup lang="ts">
import { computed } from 'vue';
import type { CallerEmotionInsight } from './useCustomerServiceAgent';

const props = defineProps<{
  active: boolean;
  insight: CallerEmotionInsight;
  speaker: string;
}>();

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
</script>

<template>
  <section
    class="emotion-pet"
    :class="[`emotion-${emotionClass}`, { active }]"
    aria-label="来电情绪辅助"
  >
    <div class="retro-computer" aria-hidden="true">
      <div class="crt-monitor">
        <div class="crt-screen">
          <i></i>
          <i></i>
          <b></b>
        </div>
        <span></span>
      </div>
      <div class="computer-tower">
        <i></i>
        <i></i>
        <b></b>
      </div>
    </div>

    <Transition name="emotion-bubble" mode="out-in">
      <article :key="`${insight.emotion}-${insight.timestamp}`" class="emotion-bubble">
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
      </article>
    </Transition>
  </section>
</template>

<style scoped src="./CallerEmotionPet.css"></style>
