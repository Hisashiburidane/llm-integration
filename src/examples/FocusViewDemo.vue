<script setup lang="ts">
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import CodeTabs from './CodeTabs.vue';
import type { DemoSpec } from './registry';

defineProps<{
  demo: DemoSpec;
}>();

use([CanvasRenderer, LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent]);

const focusChartOption = {
  color: ['#42b883', '#1677ff'],
  tooltip: { trigger: 'axis' },
  legend: { top: 0, right: 8, data: ['latency', 'errors'] },
  grid: { left: 42, right: 18, top: 42, bottom: 32 },
  xAxis: { type: 'category', data: ['09:00', '09:05', '09:10', '09:15', '09:20', '09:25', '09:30'] },
  yAxis: { type: 'value' },
  series: [
    { name: 'latency', type: 'line', smooth: true, data: [82, 88, 116, 142, 121, 104, 96] },
    { name: 'errors', type: 'bar', data: [2, 4, 9, 18, 11, 6, 4] }
  ]
};
</script>

<template>
  <div class="demo-layout focus-layout">
    <a-card title="Focus View 预览" size="small" class="demo-card code-block">
      <v-chart class="focus-chart" :option="focusChartOption" autoresize />
    </a-card>
    <a-card title="元数据" size="small" class="demo-card">
      <a-list size="small" :data-source="demo.metadata">
        <template #renderItem="{ item }">
          <a-list-item>{{ item }}</a-list-item>
        </template>
      </a-list>
    </a-card>
    <a-card title="执行器" size="small" class="demo-card">
      <a-timeline>
        <a-timeline-item v-for="step in demo.steps" :key="step">{{ step }}</a-timeline-item>
      </a-timeline>
    </a-card>
  </div>

  <CodeTabs :blocks="demo.codeBlocks" />
</template>
