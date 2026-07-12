<script setup lang="ts">
import ExamplesView from './ExamplesView.vue';

const portalUrl = import.meta.env.VITE_PORTAL_URL
  ?? (import.meta.env.DEV ? 'http://127.0.0.1:5173/' : '/');
</script>

<template>
  <main class="site">
    <header class="nav">
      <a class="brand" :href="portalUrl"><span class="brand-glyph">lambda</span><span>llm-ui/vue</span></a>
      <nav><a :href="portalUrl">Portal</a><strong>Examples</strong></nav>
    </header>
    <ExamplesView />
  </main>
</template>
