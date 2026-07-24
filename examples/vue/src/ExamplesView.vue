<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Aura, useEnchantForge } from '@enchantforge/vue';
import ExampleDebugPanel from './examples/ExampleDebugPanel.vue';
import CodeTabs from './examples/CodeTabs.vue';
import { demos } from './examples/registry';

const requestedId = window.location.hash.slice(1);
const activeId = ref(demos.some((demo) => demo.id === requestedId) ? requestedId : demos[0].id);
const active = computed(() => demos.find((demo) => demo.id === activeId.value) ?? demos[0]);
const debugOpen = ref(false);
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

      <component :is="active.component" :demo="active" />
      <CodeTabs :blocks="active.codeBlocks" />
    </article>

    <a-drawer :open="debugOpen" title="运行时调试信息" width="min(720px, 92vw)" @close="debugOpen = false">
      <ExampleDebugPanel :page-id="active.id" />
    </a-drawer>

    <Aura />
  </section>
</template>
