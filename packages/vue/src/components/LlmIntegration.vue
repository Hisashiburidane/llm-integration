<script setup lang="ts">
import { computed, onBeforeUnmount, provide, watchEffect } from 'vue';
import { llmScopeKey, registerLlmScope, updateLlmScope, type MetadataNode } from '../runtime/scope';

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

let unregister: (() => void) | undefined;
watchEffect(() => {
  if (!props.registerGlobal) {
    unregister?.();
    unregister = undefined;
    return;
  }
  if (!unregister) unregister = registerLlmScope(scope.value);
  else updateLlmScope(scope.value);
});
onBeforeUnmount(() => unregister?.());

defineExpose({
  getScopeSnapshot: () => scope.value
});
</script>

<template>
  <div class="llm-scope" :data-llm-scope="name" :data-llm-global="registerGlobal">
    <slot :scope="scope" />
  </div>
</template>
