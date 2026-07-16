import { computed, type MaybeRef } from 'vue';
import { getLatestEnchantForge, useEnchantForge } from './forge';

function legacyVisual() {
  const visual = getLatestEnchantForge()?.visual;
  if (!visual) throw new Error('未安装 EnchantForge。');
  return visual;
}

export function highlightPageScope(page: string, scopeId: string) {
  legacyVisual().highlight(page, scopeId);
}

export function openPageScope(page: string, scopeId: string) {
  legacyVisual().open(page, scopeId);
}

export function composePageScope(page: string, scopeId: string) {
  legacyVisual().compose(page, scopeId);
}

export function clearPageFocus(page: string) {
  legacyVisual().clear(page);
}

export function closePageScope(page: string) {
  legacyVisual().close(page);
}

export function clearComposedPageScopes(page: string) {
  legacyVisual().clearComposed(page);
}

export function usePageFocus(page: MaybeRef<string>) {
  const forge = useEnchantForge();
  return computed(() => forge.visual.state(typeof page === 'string' ? page : page.value));
}
