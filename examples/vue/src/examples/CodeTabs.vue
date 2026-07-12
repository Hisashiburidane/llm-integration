<script setup lang="ts">
import { computed } from 'vue';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import type { CodeBlock } from './registry';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('json', json);

const props = defineProps<{
  blocks: CodeBlock[];
}>();

const highlightedBlocks = computed(() => props.blocks.map((block) => ({
  ...block,
  highlighted: hljs.highlight(block.code, {
    language: block.language ?? (block.code.trimStart().startsWith('<') ? 'xml' : 'typescript')
  }).value
})));
</script>

<template>
  <a-card title="代码" size="small" class="demo-card code-examples-card">
    <a-tabs>
      <a-tab-pane v-for="block in highlightedBlocks" :key="block.key" :tab="block.tab">
        <pre><code class="hljs" v-html="block.highlighted"></code></pre>
      </a-tab-pane>
    </a-tabs>
  </a-card>
</template>

<style scoped>
pre { position: relative; margin: 0; border: 1px solid #d8d9da; border-radius: 4px; background: #f7f8fa; }
pre::before { position: absolute; top: 11px; right: 13px; color: #9a9ca5; content: 'CODE'; font: 700 9px/1 monospace; letter-spacing: .12em; }
.hljs { display: block; padding: 20px; overflow-x: auto; color: #24292e; background: transparent; font: 12px/1.7 "IBM Plex Mono", "SFMono-Regular", Consolas, monospace; }
:deep(.hljs-comment), :deep(.hljs-quote) { color: #6a737d; font-style: italic; }
:deep(.hljs-keyword), :deep(.hljs-selector-tag), :deep(.hljs-subst) { color: #d73a49; }
:deep(.hljs-string), :deep(.hljs-doctag), :deep(.hljs-regexp) { color: #032f62; }
:deep(.hljs-title), :deep(.hljs-section), :deep(.hljs-selector-id) { color: #6f42c1; font-weight: 600; }
:deep(.hljs-type), :deep(.hljs-class .hljs-title), :deep(.hljs-tag), :deep(.hljs-name), :deep(.hljs-attribute) { color: #22863a; }
:deep(.hljs-number), :deep(.hljs-literal), :deep(.hljs-variable), :deep(.hljs-template-variable) { color: #005cc5; }
:deep(.hljs-built_in), :deep(.hljs-builtin-name), :deep(.hljs-meta) { color: #e36209; }
</style>
