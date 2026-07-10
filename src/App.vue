<script setup lang="ts">
import { ref } from 'vue';
import HomeView from './views/HomeView.vue';
import ExamplesView from './views/ExamplesView.vue';

const page = ref<'home' | 'examples'>('home');

function openHome() {
  page.value = 'home';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openExamples() {
  page.value = 'examples';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
</script>

<template>
  <main class="site">
    <header class="nav">
      <button class="brand" type="button" @click="openHome" aria-label="home">
        <span class="brand-glyph">λ</span>
        <span>llm-ui/vue</span>
      </button>
      <nav>
        <button type="button" :class="{ active: page === 'home' }" @click="openHome">Home</button>
        <a v-if="page === 'home'" href="#start">Start</a>
        <a v-if="page === 'home'" href="#model">Model</a>
        <button type="button" :class="{ active: page === 'examples' }" @click="openExamples">Examples</button>
        <a v-if="page === 'home'" href="#runtime">Runtime</a>
      </nav>
    </header>

    <HomeView v-if="page === 'home'" @open-examples="openExamples" />
    <ExamplesView v-else />
  </main>
</template>