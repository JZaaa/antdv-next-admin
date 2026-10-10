import { describe, expect, it, vi } from 'vitest';

import i18n, { loadLocaleMessages } from '@/locales';
import en from '@/locales/en-US';
import zh from '@/locales/zh-CN';
import { basicRoutes } from '@/router/routes';

describe('redirect route translations', () => {
  it.each([
    ['zh-CN', zh],
    ['en-US', en],
  ] as const)(
    'translates the redirect title in %s without missing-key warnings',
    async (locale, messages) => {
      await loadLocaleMessages(locale);
      const previousLocale = i18n.global.locale.value;
      const previousMissing = i18n.global.getMissingHandler();
      const missing = vi.fn();
      try {
        i18n.global.locale.value = locale;
        i18n.global.setMissingHandler(missing);
        const root = basicRoutes.find((route) => route.name === 'Root');
        const redirect = root?.children?.find((route) => route.name === 'Redirect');
        // Route getters explicitly call $t; meta.title already contains display text.
        expect(redirect?.meta?.title).toBe(messages.common.redirecting);
        expect(root?.meta?.title).toBe(messages.menu.dashboard);
        expect(missing).not.toHaveBeenCalled();
      } finally {
        i18n.global.locale.value = previousLocale;
        i18n.global.setMissingHandler(previousMissing);
      }
    },
  );
});
