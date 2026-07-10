<script setup lang="ts">
import { computed, provide } from 'vue';
import { llmScopeKey, type MetadataNode } from '../runtime/scope';

const props = withDefaults(defineProps<{
  name: string;
  prompt?: string;
  metadata?: MetadataNode[];
  registerGlobal?: boolean;
}>(), {
  prompt: '',
  metadata: () => [],
  registerGlobal: true
});

const scope = computed(() => ({
  id: props.name,
  prompt: props.prompt,
  metadata: props.metadata
}));

provide(llmScopeKey, scope);

defineExpose({
  getScopeSnapshot: () => scope.value
});
</script>

<template>
  <div class="llm-scope" :data-llm-scope="name" :data-llm-global="registerGlobal">
    <slot :scope="scope" />
  </div>
</template>
