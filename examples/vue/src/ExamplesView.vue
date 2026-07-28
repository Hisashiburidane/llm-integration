<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Aura, useEnchantForge } from '@enchantforge/vue';
import type { AuraInstance } from '@enchantforge/vue';
import ExampleDebugPanel from './examples/ExampleDebugPanel.vue';
import CodeTabs from './examples/CodeTabs.vue';
import { demos } from './examples/registry';

const requestedId = window.location.hash.slice(1);
const activeId = ref(demos.some((demo) => demo.id === requestedId) ? requestedId : demos[0].id);
const active = computed(() => demos.find((demo) => demo.id === activeId.value) ?? demos[0]);
const debugOpen = ref(false);
const aura = ref<AuraInstance>();
const forge = useEnchantForge();

watch(activeId, (page) => {
  forge.syncNavigation({
    page,
    route: `#${page}`,
    tags: [active.value.status]
  });
}, { immediate: true });

function selectDemo(id: string) {
  activeId.value = id;
  window.history.replaceState(null, '', `#${id}`);
}

function syncFromHash() {
  const id = window.location.hash.slice(1);
  if (demos.some((demo) => demo.id === id)) activeId.value = id;
}

function runSuggestion(suggestion: string) {
  aura.value?.open();
  void aura.value?.submit(suggestion);
}

window.addEventListener('hashchange', syncFromHash);
onBeforeUnmount(() => window.removeEventListener('hashchange', syncFromHash));
</script>

<template>
  <section class="examples-shell antd-examples">
    <aside class="demo-sidebar">
      <div class="sidebar-head">
        <p class="kicker">Examples</p>
        <h1>示例目录</h1>
      </div>
      <button
        v-for="demo in demos"
        :key="demo.id"
        class="demo-tab"
        :class="{ active: demo.id === activeId }"
        type="button"
        @click="selectDemo(demo.id)"
      >
        <span>{{ demo.title }}</span>
        <code>{{ demo.status }}</code>
      </button>
    </aside>

    <article class="demo-panel">
      <a-page-header :title="active.title" :sub-title="active.summary" class="demo-page-header">
        <template #tags>
          <a-tag :color="active.status === 'TODO' ? 'orange' : 'green'">{{ active.status }}</a-tag>
        </template>
        <template #extra>
          <a-button type="default" size="small" @click="debugOpen = true">调试信息</a-button>
        </template>
      </a-page-header>

      <section v-if="active.suggestions.length" class="quick-actions" aria-label="快捷测试">
        <span>快捷测试</span>
        <button
          v-for="suggestion in active.suggestions"
          :key="suggestion"
          type="button"
          @click="runSuggestion(suggestion)"
        >
          {{ suggestion }}
        </button>
      </section>

      <component :is="active.component" :demo="active" />
      <CodeTabs :blocks="active.codeBlocks" />
    </article>

    <a-drawer :open="debugOpen" title="运行时调试信息" width="min(720px, 92vw)" @close="debugOpen = false">
      <ExampleDebugPanel :page-id="active.id" />
    </a-drawer>

    <Aura
      v-if="active.status === '真实 API' && active.showAura !== false"
      ref="aura"
      :page="active.id"
      :title="`${active.title} Assistant`"
      :suggestions="active.suggestions"
    />
  </section>
</template>

<style scoped>
.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 0 24px 18px;
}
.quick-actions > span {
  color: #7a8696;
  font: 700 10px/1.2 "IBM Plex Mono", monospace;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.quick-actions button {
  max-width: min(420px, 100%);
  padding: 6px 10px;
  overflow: hidden;
  border: 1px solid #cdd8e5;
  border-radius: 5px;
  color: #36516f;
  background: #f8fafc;
  cursor: pointer;
  font-size: 11px;
  line-height: 1.4;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: border-color 140ms ease, color 140ms ease, background 140ms ease;
}
.quick-actions button:hover {
  border-color: #5794f2;
  color: #165dba;
  background: #eff6ff;
}
</style>
