<script setup lang="ts">
import CodeTabs from './CodeTabs.vue';
import type { DemoSpec } from './registry';

defineProps<{
  demo: DemoSpec;
}>();
</script>

<template>
  <CodeTabs :blocks="demo.codeBlocks" />

  <div class="demo-layout static-layout">
    <a-card title="输入" size="small" class="demo-card input-block">
      <pre><code>{{ demo.input }}</code></pre>
    </a-card>
    <a-card title="元数据" size="small" class="demo-card">
      <a-list size="small" :data-source="demo.metadata">
        <template #renderItem="{ item }">
          <a-list-item>{{ item }}</a-list-item>
        </template>
      </a-list>
    </a-card>
    <a-card title="执行器" size="small" class="demo-card code-block">
      <a-timeline>
        <a-timeline-item v-for="step in demo.steps" :key="step">{{ step }}</a-timeline-item>
      </a-timeline>
    </a-card>
  </div>
</template>
