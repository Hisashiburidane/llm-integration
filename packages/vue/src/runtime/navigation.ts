import type { Ref } from 'vue';

export interface EnchantNavigationState {
  app?: string;
  page?: string;
  route?: string;
  tab?: string;
  tags: string[];
}

export type EnchantNavigationInput = Partial<Omit<EnchantNavigationState, 'tags'>> & {
  tags?: string[];
};

export type EnchantNavigationSource = Ref<EnchantNavigationInput | undefined> | (() => EnchantNavigationInput | undefined);
