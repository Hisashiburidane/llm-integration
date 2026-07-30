<script setup lang="ts">
import type { DemoSpec } from './registry';

defineProps<{ demo: DemoSpec }>();
</script>

<template>
  <a-result status="info" title="TODO：该示例尚未实现" :sub-title="demo.summary">
    <template #extra>
      <a-alert
        type="warning"
        show-icon
        message="完成标准：模型请求、结构化响应校验、页面动作执行，以及失败状态展示。"
      />
    </template>
  </a-result>
</template>
