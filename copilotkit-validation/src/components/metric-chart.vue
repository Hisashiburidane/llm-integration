<script setup lang="ts">
import { computed } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import type { MetricPanel } from '../types';

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent]);

const props = defineProps<{
  panel: MetricPanel;
  compact?: boolean;
}>();

const option = computed(() => ({
  animationDuration: 420,
  grid: { left: 10, right: 10, top: 12, bottom: 8, containLabel: false },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'cross', lineStyle: { type: 'dashed', color: '#1677ff' } },
    formatter: (params: Array<{ data: number; dataIndex: number }>) => {
      const point = params[0];
      return `T-${35 - point.dataIndex}m&nbsp;&nbsp;<strong>${point.data} ${props.panel.unit}</strong>`;
    }
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    show: false,
    data: props.panel.series.map((_, index) => index)
  },
  yAxis: { type: 'value', show: false, scale: true },
  series: [
    {
      type: 'line',
      data: props.panel.series,
      smooth: 0.25,
      symbol: 'none',
      lineStyle: { width: props.compact ? 1.6 : 2.2, color: props.panel.color },
      areaStyle: { color: `${props.panel.color}18` }
    }
  ]
}));
</script>

<template>
  <VChart class="metric-chart" :option="option" autoresize />
</template>
