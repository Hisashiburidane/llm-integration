<script setup lang="ts">
import { computed } from 'vue';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);

const props = withDefaults(defineProps<{
  code: string;
  language?: 'typescript' | 'javascript' | 'xml' | 'json';
}>(), {
  language: 'typescript'
});

const highlighted = computed(() => hljs.highlight(props.code, {
  language: props.language,
  ignoreIllegals: true
}).value);
</script>

<template>
  <pre class="highlighted-code"><code class="hljs" v-html="highlighted"></code></pre>
</template>

<style scoped>
.highlighted-code {
  max-height: 860px;
  margin: 0;
  overflow: auto;
  border: 1px solid #d8d9da;
  border-radius: 4px;
  background: #f7f8fa;
}
.highlighted-code code {
  display: block;
  min-width: max-content;
  padding: 16px;
  color: #24292e;
  font: 12px/1.65 "IBM Plex Mono", SFMono-Regular, Consolas, monospace;
  tab-size: 2;
}
:deep(.hljs-comment),
:deep(.hljs-quote) { color: #6a737d; font-style: italic; }
:deep(.hljs-keyword),
:deep(.hljs-selector-tag),
:deep(.hljs-literal) { color: #d73a49; }
:deep(.hljs-string),
:deep(.hljs-attr),
:deep(.hljs-template-tag) { color: #032f62; }
:deep(.hljs-title),
:deep(.hljs-section),
:deep(.hljs-function .hljs-title) { color: #6f42c1; }
:deep(.hljs-number),
:deep(.hljs-symbol),
:deep(.hljs-variable) { color: #005cc5; }
:deep(.hljs-tag),
:deep(.hljs-name),
:deep(.hljs-built_in),
:deep(.hljs-type) { color: #22863a; }
:deep(.hljs-meta) { color: #b31d28; }
</style>
