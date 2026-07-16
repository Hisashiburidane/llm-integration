<script setup lang="ts">
import { computed, ref } from 'vue';
import { VueMonacoDiffEditor, VueMonacoEditor } from '@guolao/vue-monaco-editor';
import type { CodeBlock } from './registry';

const props = defineProps<{
  blocks: CodeBlock[];
}>();

const displayMode = ref<Record<string, 'code' | 'diff'>>({});

const editorOptions = {
  readOnly: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  wordWrap: 'off' as const,
  renderWhitespace: 'selection' as const,
  lineNumbersMinChars: 3,
  padding: { top: 16, bottom: 16 },
  fontSize: 12,
  fontFamily: 'IBM Plex Mono, SFMono-Regular, Consolas, monospace'
};

const diffOptions = {
  readOnly: true,
  renderSideBySide: false,
  originalEditable: false,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  wordWrap: 'off' as const,
  lineNumbersMinChars: 3,
  padding: { top: 16, bottom: 16 }
};

const blockMap = computed(() => new Map(props.blocks.map((block) => [block.key, block])));

function languageOf(block: CodeBlock) {
  return block.language ?? (block.code.trimStart().startsWith('<') ? 'xml' : 'typescript');
}

function editorHeight(code: string, lineHeight = 22, min = 220, max = 860) {
  const lines = code.split('\n').length;
  return `${Math.min(max, Math.max(min, lines * lineHeight + 48))}px`;
}

function compareBlock(block: CodeBlock) {
  return block.compareTo ? blockMap.value.get(block.compareTo) : undefined;
}

function modeFor(block: CodeBlock) {
  return displayMode.value[block.key] ?? 'code';
}

function handleModeChange(blockKey: string, value: string | number) {
  displayMode.value = { ...displayMode.value, [blockKey]: value as 'code' | 'diff' };
}
</script>

<template>
  <a-card title="代码" size="small" class="demo-card code-examples-card">
    <a-tabs>
      <a-tab-pane v-for="block in blocks" :key="block.key" :tab="block.tab">
        <div v-if="compareBlock(block)" class="code-toolbar">
          <a-segmented
            :value="modeFor(block)"
            :options="[
              { label: '源码', value: 'code' },
              { label: 'Diff', value: 'diff' }
            ]"
            @change="handleModeChange(block.key, $event)"
          />
        </div>

        <VueMonacoEditor
          v-if="!compareBlock(block) || modeFor(block) === 'code'"
          :value="block.code"
          :language="languageOf(block)"
          theme="vs"
          :options="editorOptions"
          :height="editorHeight(block.code)"
        />

        <VueMonacoDiffEditor
          v-else
          :original="compareBlock(block)?.code ?? ''"
          :modified="block.code"
          :language="languageOf(block)"
          theme="vs"
          :options="diffOptions"
          :height="editorHeight(block.code + '\n' + (compareBlock(block)?.code ?? ''), 18, 320, 920)"
        />
      </a-tab-pane>
    </a-tabs>
  </a-card>
</template>

<style scoped>
.code-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
:deep(.monaco-editor),
:deep(.monaco-diff-editor),
:deep(.monaco-editor .margin),
:deep(.monaco-diff-editor .margin) {
  background: #f7f8fa !important;
}
:deep(.monaco-editor),
:deep(.monaco-diff-editor) {
  border: 1px solid #d8d9da;
  border-radius: 4px;
  overflow: hidden;
}
</style>
