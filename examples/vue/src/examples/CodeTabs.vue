<script setup lang="ts">
import type { CodeBlock } from './registry';

defineProps<{
  blocks: CodeBlock[];
}>();
</script>

<template>
  <a-card title="代码" size="small" class="demo-card code-examples-card">
    <a-tabs>
      <a-tab-pane v-for="block in blocks" :key="block.key" :tab="block.tab">
        <pre><code>{{ block.code }}</code></pre>
      </a-tab-pane>
    </a-tabs>
  </a-card>
</template>
