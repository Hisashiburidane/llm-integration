<script setup lang="ts">
import { computed } from 'vue';
import { VueMonacoEditor } from '@guolao/vue-monaco-editor';
import { useEnchantPage, useLlmDebugEvents } from '@enchantforge/vue';

const props = defineProps<{
  pageId: string;
}>();

const activePage = useEnchantPage(computed(() => props.pageId));
const events = useLlmDebugEvents();

const visibleEvents = computed(() =>
  events.value.filter((event) => event.source.includes(props.pageId))
);

const editorOptions = {
  readOnly: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  wordWrap: 'on' as const,
  folding: true,
  lineNumbersMinChars: 3,
  padding: { top: 16, bottom: 16 },
  fontSize: 12,
  fontFamily: 'IBM Plex Mono, SFMono-Regular, Consolas, monospace'
};

function formatDetail(detail: unknown) {
  if (detail == null) return '';
  try {
    return JSON.stringify(detail, null, 2);
  } catch {
    return String(detail);
  }
}

function editorHeight(value: string) {
  const lines = value.split('\n').length;
  return `${Math.min(920, Math.max(280, lines * 20 + 48))}px`;
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
        <VueMonacoEditor
          :value="formatDetail(activePage.metadataTree)"
          language="json"
          theme="vs"
          :options="editorOptions"
          :height="editorHeight(formatDetail(activePage.metadataTree))"
        />
      </a-tab-pane>
      <a-tab-pane key="tools" tab="Tools">
        <VueMonacoEditor
          :value="formatDetail(activePage.tools)"
          language="json"
          theme="vs"
          :options="editorOptions"
          :height="editorHeight(formatDetail(activePage.tools))"
        />
      </a-tab-pane>
      <a-tab-pane key="events" tab="Events">
        <a-empty v-if="!visibleEvents.length" description="当前没有运行事件" />
        <VueMonacoEditor
          v-else
          :value="formatDetail(visibleEvents)"
          language="json"
          theme="vs"
          :options="editorOptions"
          :height="editorHeight(formatDetail(visibleEvents))"
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
:deep(.monaco-editor),
:deep(.monaco-editor .margin) {
  background: #f5f7fa !important;
}
:deep(.monaco-editor) {
  border: 1px solid #e1e4e8;
  border-radius: 4px;
  overflow: hidden;
}
</style>
