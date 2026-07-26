<script setup lang="ts">
import { computed, ref } from 'vue';
import HighlightedCode from './HighlightedCode.vue';
import type { CodeBlock } from './registry';

const props = defineProps<{
  blocks: CodeBlock[];
}>();

const displayMode = ref<Record<string, 'code' | 'compare'>>({});

const blockMap = computed(() => new Map(props.blocks.map((block) => [block.key, block])));

function languageOf(block: CodeBlock) {
  return block.language ?? (block.code.trimStart().startsWith('<') ? 'xml' : 'typescript');
}

function compareBlock(block: CodeBlock) {
  return block.compareTo ? blockMap.value.get(block.compareTo) : undefined;
}

function modeFor(block: CodeBlock) {
  return displayMode.value[block.key] ?? 'code';
}

function handleModeChange(blockKey: string, value: string | number) {
  displayMode.value = { ...displayMode.value, [blockKey]: value as 'code' | 'compare' };
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
              { label: '对照', value: 'compare' }
            ]"
            @change="handleModeChange(block.key, $event)"
          />
        </div>

        <HighlightedCode
          v-if="!compareBlock(block) || modeFor(block) === 'code'"
          :code="block.code"
          :language="languageOf(block)"
        />

        <div v-else class="code-comparison">
          <section>
            <strong>接入前</strong>
            <HighlightedCode
              :code="compareBlock(block)?.code ?? ''"
              :language="languageOf(compareBlock(block) ?? block)"
            />
          </section>
          <section>
            <strong>接入后</strong>
            <HighlightedCode :code="block.code" :language="languageOf(block)" />
          </section>
        </div>
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
.code-comparison {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.code-comparison section {
  min-width: 0;
}
.code-comparison strong {
  display: block;
  margin-bottom: 7px;
  color: #6e7681;
  font: 700 10px/1.2 "IBM Plex Mono", monospace;
  letter-spacing: .08em;
  text-transform: uppercase;
}
@media (max-width: 900px) {
  .code-comparison { grid-template-columns: 1fr; }
}
</style>
