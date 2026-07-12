<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, watch } from 'vue';
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
onMounted(() => {
  if (props.registerGlobal) unregister = registerLlmScope(scope.value);
});
watch(
  [
    () => props.registerGlobal,
    () => props.name,
    () => props.prompt,
    () => JSON.stringify(props.metadata)
  ],
  ([registerGlobal]) => {
    if (!unregister) {
      if (registerGlobal) unregister = registerLlmScope(scope.value);
      return;
    }
    if (!registerGlobal) {
      unregister();
      unregister = undefined;
      return;
    }
    updateLlmScope(scope.value);
  },
  { flush: 'post' }
);
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
