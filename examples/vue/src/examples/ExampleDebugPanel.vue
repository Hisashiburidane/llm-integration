<script setup lang="ts">
import { computed } from 'vue';
import { useEnchantPage, useLlmDebugEvents } from '@enchantforge/vue';
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
        <small>metadata tree / tool list / runtime events</small>
      </div>
    </div>

    <a-tabs>
      <a-tab-pane key="tree" tab="Metadata Tree">
        <HighlightedCode
          :code="formatDetail(activePage.metadataTree)"
          language="json"
        />
      </a-tab-pane>
      <a-tab-pane key="tools" tab="Tools">
        <HighlightedCode
          :code="formatDetail(activePage.tools)"
          language="json"
        />
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

<style scoped>
.debug-panel { min-height: 0; }
.debug-heading { margin-bottom: 12px; }
.debug-heading strong, .debug-heading small { display: block; }
.debug-heading small { margin-top: 3px; color: #7a818c; font-size: 11px; }
</style>
