<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, shallowRef, toRaw, watch } from 'vue';
import { init, use, type ECharts, type EChartsCoreOption } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';

use([SVGRenderer, LineChart, BarChart, GridComponent, TooltipComponent]);

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

<template><div ref="root"></div></template>
