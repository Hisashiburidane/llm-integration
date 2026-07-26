<script setup lang="ts">
import { ref, toRef } from 'vue';
import { useEnchant, useEnchantForm } from '@enchantforge/vue';

const props = defineProps<{
  model: Record<string, unknown>;
  fields: Record<string, string>;
  prompt: string;
  placeholder: string;
  assign?: (values: Record<string, unknown>) => void;
}>();

const input = ref('');
const loading = ref(false);
const message = ref('');
const model = toRef(props, 'model');
const enchant = useEnchant();

useEnchantForm(model, {
  fields: props.fields,
  description: '根据用户描述填写当前配置草稿，不保存、不提交。',
  assign(values, target) {
    if (props.assign) props.assign(values);
    else Object.assign(target, values);
  }
});

async function buildDraft() {
  const question = input.value.trim();
  if (!question || loading.value) return;
  loading.value = true;
  message.value = '';
  try {
    const result = await enchant.run({ input: question, prompt: props.prompt });
    message.value = result.message || '草稿已更新，请检查后保存。';
  } catch (error) {
    message.value = error instanceof Error ? error.message : '草稿生成失败。';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="text-builder">
    <div class="builder-heading">
      <div><strong>Text to Form</strong><span>自然语言只更新草稿，不会自动保存</span></div>
      <a-tag color="blue">EnchantForge</a-tag>
    </div>
    <div class="builder-input">
      <a-textarea v-model:value="input" :placeholder="placeholder" :rows="2" @keydown.meta.enter.prevent="buildDraft" @keydown.ctrl.enter.prevent="buildDraft" />
      <a-button type="primary" :loading="loading" @click="buildDraft">生成草稿</a-button>
    </div>
    <p v-if="message" class="builder-message">{{ message }}</p>
  </section>
</template>

<style scoped>
.text-builder { padding: 14px; margin-bottom: 16px; border: 1px solid #cdddf1; border-radius: 7px; background: #f7faff; }
.builder-heading, .builder-input { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.builder-heading { margin-bottom: 10px; }
.builder-heading strong, .builder-heading span { display: block; }
.builder-heading strong { color: #174a84; font: 700 11px/1.2 'IBM Plex Mono', monospace; }
.builder-heading span { margin-top: 4px; color: #7890aa; font-size: 10px; }
.builder-input :deep(.ant-input) { font-size: 11px; }
.builder-input .ant-btn { flex: 0 0 auto; }
.builder-message { margin: 9px 0 0; color: #52677f; font-size: 10px; line-height: 1.5; }
@media (max-width: 620px) { .builder-input { align-items: stretch; flex-direction: column; } }
</style>
