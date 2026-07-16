import { reactive } from 'vue';

export interface EnchantVisualPageState {
  highlightedScopeIds: string[];
  activeScopeId: string;
  composedScopeIds: string[];
}

export interface EnchantVisualController {
  state(page: string): EnchantVisualPageState;
  highlight(page: string, scopeId: string): void;
  open(page: string, scopeId: string): void;
  compose(page: string, scopeId: string): void;
  clear(page: string): void;
  close(page: string): void;
  clearComposed(page: string): void;
}

function appendUnique(values: string[], value: string) {
  if (!values.includes(value)) values.push(value);
}

export function createEnchantVisualController(): EnchantVisualController {
  const pages = reactive(new Map<string, EnchantVisualPageState>());

  function state(page: string) {
    if (!pages.has(page)) {
      pages.set(page, reactive({
        highlightedScopeIds: [],
        activeScopeId: '',
        composedScopeIds: []
      }));
    }
    return pages.get(page)!;
  }

  return {
    state,
    highlight(page, scopeId) {
      appendUnique(state(page).highlightedScopeIds, scopeId);
    },
    open(page, scopeId) {
      state(page).activeScopeId = scopeId;
      appendUnique(state(page).highlightedScopeIds, scopeId);
    },
    compose(page, scopeId) {
      appendUnique(state(page).composedScopeIds, scopeId);
      appendUnique(state(page).highlightedScopeIds, scopeId);
    },
    clear(page) {
      const current = state(page);
      current.highlightedScopeIds = [];
      current.activeScopeId = '';
      current.composedScopeIds = [];
    },
    close(page) {
      state(page).activeScopeId = '';
    },
    clearComposed(page) {
      state(page).composedScopeIds = [];
    }
  };
}
