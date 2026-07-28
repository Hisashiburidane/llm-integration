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

<style scoped src="./HighlightedCode.css"></style>
