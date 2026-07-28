<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';
import HomeView from './views/HomeView.vue';
import ApiView from './views/ApiView.vue';
import { apiDocsUrl, examplesUrl, portalHomeUrl } from './urls';
import type { PortalLocale } from './i18n';

const { locale, t } = useI18n();
const isApiView = new URLSearchParams(globalThis.location?.search).get('view') === 'api';
const currentView = computed(() => isApiView ? ApiView : HomeView);

function homeSection(section: string) {
  return `${portalHomeUrl}#${section}`;
}

function setLocale(value: PortalLocale) {
  locale.value = value;
  try {
    localStorage.setItem('enchantforge.portal.locale', value);
  } catch {
    // Language switching still works when storage is unavailable.
  }
}

watchEffect(() => {
  document.documentElement.lang = locale.value;
  document.title = t(isApiView ? 'meta.apiTitle' : 'meta.homeTitle');
});
</script>

<template>
  <main class="site">
    <header class="nav">
      <a class="brand" :href="homeSection('top')" aria-label="home">
        <span class="brand-glyph">λ</span>
        <span>EnchantForge</span>
      </a>
      <div class="nav-actions">
        <nav>
          <a :class="{ active: !isApiView }" :href="homeSection('top')">{{ t('nav.home') }}</a>
          <a :href="homeSection('start')">{{ t('nav.start') }}</a>
          <a :href="homeSection('model')">{{ t('nav.model') }}</a>
          <a :href="examplesUrl">{{ t('nav.examples') }}</a>
          <a :href="homeSection('runtime')">{{ t('nav.runtime') }}</a>
          <a :class="{ active: isApiView }" :href="apiDocsUrl">{{ t('nav.api') }}</a>
        </nav>
        <div class="locale-switch" :aria-label="t('language.label')">
          <button
            type="button"
            :class="{ active: locale === 'zh-CN' }"
            @click="setLocale('zh-CN')"
          >
            {{ t('language.zh') }}
          </button>
          <button
            type="button"
            :class="{ active: locale === 'en' }"
            @click="setLocale('en')"
          >
            {{ t('language.en') }}
          </button>
        </div>
      </div>
    </header>

    <component :is="currentView" />
  </main>
</template>
