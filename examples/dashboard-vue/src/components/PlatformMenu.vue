<script setup lang="ts">
defineProps<{ active: 'aviation' | 'air-quality' | 'taxi' | 'otel' | 'panels' }>();

function navigate(target: 'aviation' | 'air-quality' | 'taxi' | 'otel' | 'panels') {
  window.location.hash = target === 'aviation' ? '' : target;
}
</script>

<template>
  <nav class="platform-menu" aria-label="Dashboard platform navigation">
    <span class="platform-name">ENCHANTFORGE / DASHBOARD</span>
    <div class="platform-links">
      <button type="button" :class="{ active: active === 'aviation' }" @click="navigate('aviation')">Flight Operations</button>
      <button type="button" :class="{ active: active === 'air-quality' }" @click="navigate('air-quality')">Air Quality</button>
      <button type="button" :class="{ active: active === 'taxi' }" @click="navigate('taxi')">NYC Taxi</button>
      <button type="button" :class="{ active: active === 'otel' }" @click="navigate('otel')">OpenTelemetry</button>
      <button type="button" :class="{ active: active === 'panels' }" @click="navigate('panels')">Panel Library</button>
    </div>
  </nav>
</template>

<style scoped>
.platform-menu { position: sticky; z-index: 20; top: 0; display: flex; min-height: 38px; align-items: center; justify-content: space-between; gap: 20px; padding: 0 24px; color: #cbd5e1; background: #0f1d31; box-shadow: 0 1px 0 rgb(15 29 49 / 20%); }
.platform-name { color: #8fb7ed; font: 700 9px/1 'IBM Plex Mono', monospace; letter-spacing: .1em; }
.platform-links { display: flex; gap: 2px; align-items: stretch; height: 100%; }
.platform-links button { padding: 0 12px; border: 0; color: #aab9cb; background: transparent; cursor: pointer; font: 10px/1 'IBM Plex Sans', sans-serif; }
.platform-links button:hover, .platform-links button.active { color: #fff; background: #1e3a5f; }
@media (max-width: 620px) { .platform-menu { align-items: flex-start; flex-direction: column; gap: 8px; padding: 10px 16px 0; } .platform-links { width: 100%; height: 30px; } .platform-links button { flex: 1; padding: 0 6px; } }
</style>
