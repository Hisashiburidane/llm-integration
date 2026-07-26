<script setup lang="ts">
import { computed } from 'vue';
import { renderAuraMarkdown } from '../runtime/markdown';

const props = defineProps<{ content: string }>();
const html = computed(() => renderAuraMarkdown(props.content));
</script>

<template>
  <div class="aura-markdown" v-html="html"></div>
</template>

<style scoped>
.aura-markdown { min-width: 0; line-height: 1.65; overflow-wrap: anywhere; }
.aura-markdown :deep(> :first-child) { margin-top: 0; }
.aura-markdown :deep(> :last-child) { margin-bottom: 0; }
.aura-markdown :deep(p), .aura-markdown :deep(ul), .aura-markdown :deep(ol), .aura-markdown :deep(blockquote), .aura-markdown :deep(pre), .aura-markdown :deep(table) { margin: 0 0 9px; }
.aura-markdown :deep(ul), .aura-markdown :deep(ol) { padding-left: 20px; }
.aura-markdown :deep(li + li) { margin-top: 3px; }
.aura-markdown :deep(a) { color: #1677ff; text-decoration: underline; text-underline-offset: 2px; }
.aura-markdown :deep(code) { padding: 1px 4px; border-radius: 4px; color: #0f3d75; background: #eef4fb; font: 10px/1.5 "IBM Plex Mono", ui-monospace, monospace; }
.aura-markdown :deep(pre) { max-width: 100%; padding: 9px 10px; overflow-x: auto; border: 1px solid #dbe3ec; border-radius: 6px; color: #dbeafe; background: #15263e; }
.aura-markdown :deep(pre code) { padding: 0; color: inherit; background: transparent; }
.aura-markdown :deep(blockquote) { padding-left: 9px; border-left: 3px solid #cbd5e1; color: #64748b; }
.aura-markdown :deep(table) { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; }
.aura-markdown :deep(th), .aura-markdown :deep(td) { padding: 5px 7px; border: 1px solid #dbe3ec; text-align: left; }
</style>
