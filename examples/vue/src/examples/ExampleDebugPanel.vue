<script setup lang="ts">
import { computed } from 'vue';
import {
  EnchantSnapshotInspector,
  useEnchantPage,
  useLlmDebugEvents
} from '@enchantforge/vue';
import HighlightedCode from './HighlightedCode.vue';

const props = defineProps<{
  pageId: string;
}>();

const activePage = useEnchantPage(computed(() => props.pageId));
const events = useLlmDebugEvents();

const visibleEvents = computed(() =>
  events.value.filter((event) => event.source.includes(props.pageId))
);

function formatDetail(detail: unknown) {
  if (detail == null) return '';
  try {
    return JSON.stringify(detail, null, 2);
  } catch {
    return String(detail);
  }
}
</script>

<template>
  <div class="debug-panel">
    <div class="debug-heading">
      <div>
        <strong>运行时信息</strong>
        <small>capability inventory / collected data / runtime events</small>
      </div>
    </div>

    <a-tabs>
      <a-tab-pane key="page-data" tab="Page Data">
        <EnchantSnapshotInspector :snapshot="activePage" />
      </a-tab-pane>
      <a-tab-pane key="events" tab="Events">
        <a-empty v-if="!visibleEvents.length" description="当前没有运行事件" />
        <HighlightedCode
          v-else
          :code="formatDetail(visibleEvents)"
          language="json"
        />
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<style scoped src="./ExampleDebugPanel.css"></style>
