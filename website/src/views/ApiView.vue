<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiDocGroups, installCommand, quickStartCode, type ApiDocEntry } from '../api-docs';

const { t, tm } = useI18n();
const query = ref('');
const searchInput = ref<HTMLInputElement>();

const filteredGroups = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase();
  if (!needle) return apiDocGroups;
  return apiDocGroups
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => [
        entry.name,
        entry.signature,
        t(`api.entries.${entry.copy}.description`)
      ].join('\n').toLocaleLowerCase().includes(needle))
    }))
    .filter((group) => group.entries.length);
});

function notes(entry: ApiDocEntry) {
  return tm(`api.entries.${entry.copy}.notes`) as readonly string[];
}

function focusSearch(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (event.key !== '/' || target?.matches('input, textarea, [contenteditable="true"]')) return;
  event.preventDefault();
  searchInput.value?.focus();
}

onMounted(() => window.addEventListener('keydown', focusSearch));
onBeforeUnmount(() => window.removeEventListener('keydown', focusSearch));
</script>

<template>
  <section id="api-top" class="api-hero">
    <div>
      <p class="kicker">@enchantforge/vue · 0.1.x</p>
      <h1>{{ t('api.title') }}</h1>
      <p class="lead">{{ t('api.lead') }}</p>
    </div>
    <label class="api-search">
      <span>{{ t('api.searchLabel') }}</span>
      <input ref="searchInput" v-model="query" type="search" :placeholder="t('api.searchPlaceholder')">
      <kbd>/</kbd>
    </label>
  </section>

  <div class="api-layout">
    <aside class="api-sidebar">
      <strong>{{ t('api.onThisPage') }}</strong>
      <a href="#quick-start">{{ t('api.quickStart') }}</a>
      <template v-for="group in apiDocGroups" :key="group.id">
        <span>{{ t(`api.groups.${group.id}.title`) }}</span>
        <a v-for="entry in group.entries" :key="entry.id" :href="`#${entry.id}`">
          {{ entry.name }}
        </a>
      </template>
    </aside>

    <main class="api-content">
      <section id="quick-start" class="api-quick-start">
        <div class="api-section-heading">
          <p class="kicker">00 / Setup</p>
          <h2>{{ t('api.quickStart') }}</h2>
          <p>{{ t('api.quickStartBody') }}</p>
        </div>
        <div class="api-setup-grid">
          <article>
            <span>{{ t('api.install') }}</span>
            <pre><code>{{ installCommand }}</code></pre>
          </article>
          <article>
            <span>main.ts</span>
            <pre><code>{{ quickStartCode }}</code></pre>
          </article>
        </div>
      </section>

      <template v-if="filteredGroups.length">
        <section
          v-for="(group, groupIndex) in filteredGroups"
          :key="group.id"
          class="api-group"
        >
          <div class="api-section-heading">
            <p class="kicker">{{ String(groupIndex + 1).padStart(2, '0') }} / {{ group.id }}</p>
            <h2>{{ t(`api.groups.${group.id}.title`) }}</h2>
            <p>{{ t(`api.groups.${group.id}.description`) }}</p>
          </div>

          <article
            v-for="entry in group.entries"
            :id="entry.id"
            :key="entry.id"
            class="api-entry"
          >
            <header>
              <div>
                <span class="api-kind">{{ t(`api.kinds.${entry.kind}`) }}</span>
                <h3><code>{{ entry.name }}</code></h3>
              </div>
              <a :href="`#${entry.id}`" :aria-label="entry.name">#</a>
            </header>
            <p class="api-description">{{ t(`api.entries.${entry.copy}.description`) }}</p>

            <div class="api-reference-grid">
              <section>
                <strong>{{ t('api.import') }}</strong>
                <pre><code>{{ entry.importCode }}</code></pre>
              </section>
              <section>
                <strong>{{ t('api.signature') }}</strong>
                <pre><code>{{ entry.signature }}</code></pre>
              </section>
            </div>

            <section v-if="entry.example" class="api-example">
              <strong>{{ t('api.example') }}</strong>
              <pre><code>{{ entry.example }}</code></pre>
            </section>

            <section class="api-notes">
              <strong>{{ t('api.responsibilities') }}</strong>
              <ul>
                <li v-for="note in notes(entry)" :key="note">{{ note }}</li>
              </ul>
            </section>
          </article>
        </section>
      </template>
      <p v-else class="api-empty">{{ t('api.empty') }}</p>

      <footer class="api-source-note">{{ t('api.sourceNote') }}</footer>
    </main>
  </div>
</template>
