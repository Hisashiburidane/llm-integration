<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, shallowRef, toRaw, watch } from 'vue';
import { BarChart, LineChart, PieChart, ScatterChart } from 'echarts/charts';
import { GridComponent, LegendComponent, MarkPointComponent, TooltipComponent } from 'echarts/components';
import { init, use, type ECharts, type EChartsCoreOption } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';

use([SVGRenderer, BarChart, LineChart, PieChart, ScatterChart, GridComponent, LegendComponent, MarkPointComponent, TooltipComponent]);

const props = defineProps<{ option: EChartsCoreOption }>();
const root = shallowRef<HTMLElement>();
let chart: ECharts | undefined;
let resizeObserver: ResizeObserver | undefined;

onMounted(async () => {
  await nextTick();
  if (!root.value) return;
  chart = init(root.value, undefined, { renderer: 'svg' });
  chart.setOption(toRaw(props.option), { notMerge: true });
  resizeObserver = new ResizeObserver(() => chart?.resize());
  resizeObserver.observe(root.value);
});

watch(() => props.option, (option) => chart?.setOption(toRaw(option), { notMerge: true }), { deep: true });

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  chart?.dispose();
});
</script>

<template><div ref="root" class="chart-canvas"></div></template>

<style scoped>
.chart-canvas { width: 100%; height: 100%; min-height: 230px; }
</style>
