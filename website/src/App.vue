<script setup lang="ts">
import HomeView from './views/HomeView.vue';
import { examplesUrl } from './urls';
</script>

<template>
  <main class="site">
    <header class="nav">
      <a class="brand" href="#top" aria-label="home">
        <span class="brand-glyph">λ</span>
        <span>llm-ui/vue</span>
      </a>
      <nav>
        <a href="#top">Home</a>
        <a href="#start">Start</a>
        <a href="#model">Model</a>
        <a :href="examplesUrl">Examples</a>
        <a href="#runtime">Runtime</a>
      </nav>
    </header>

    <HomeView />
  </main>
</template>
