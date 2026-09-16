import { describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

import en from '@/locales/en-US';
import zh from '@/locales/zh-CN';
import { basicRoutes } from '@/router/routes';

describe('redirect route translations', () => {
  it.each([
    ['zh-CN', zh],
    ['en-US', en],
  ] as const)(
    'translates the redirect title in %s without missing-key warnings',
    (locale, messages) => {
      const missing = vi.fn();
      const i18n = createI18n({ legacy: false, locale, messages: { [locale]: messages }, missing });
      const root = basicRoutes.find((route) => route.name === 'Root');
      const redirect = root?.children?.find((route) => route.name === 'Redirect');
      const key = redirect?.meta?.title;
      expect(key).toBe('common.redirecting');
      expect(i18n.global.t(String(key))).toBe(messages.common.redirecting);
      expect(i18n.global.t(String(root?.meta?.title))).toBe(messages.menu.dashboard);
      expect(missing).not.toHaveBeenCalled();
    },
  );
});
