import { createI18n } from 'vue-i18n';
import { messages } from './locales';

export type PortalLocale = 'zh-CN' | 'en';

const supportedLocales: PortalLocale[] = ['zh-CN', 'en'];

function initialLocale(): PortalLocale {
  try {
    const stored = localStorage.getItem('enchantforge.portal.locale') as PortalLocale | null;
    return stored && supportedLocales.includes(stored) ? stored : 'zh-CN';
  } catch {
    return 'zh-CN';
  }
}

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: 'en',
  messages
});
