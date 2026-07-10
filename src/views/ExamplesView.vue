<script setup lang="ts">
import { computed, ref } from 'vue';
import { demos } from '../examples/registry';

const activeId = ref(demos[0].id);
const active = computed(() => demos.find((demo) => demo.id === activeId.value) ?? demos[0]);
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
        @click="activeId = demo.id"
      >
        <span>{{ demo.title }}</span>
        <code>{{ demo.status }}</code>
      </button>
    </aside>

    <article class="demo-panel">
      <a-page-header :title="active.title" :sub-title="active.summary" class="demo-page-header">
        <template #tags>
          <a-tag color="green">{{ active.status }}</a-tag>
        </template>
      </a-page-header>

      <component :is="active.component" :demo="active" />
    </article>
  </section>
</template>