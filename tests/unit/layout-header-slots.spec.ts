import type { LayoutHeaderSlotProps, LayoutHeaderSlots } from '@/types/layoutSlots';
import type { Component } from 'vue';

import { createPinia, disposePinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';

import AdminLayout from '@/components/Layout/AdminLayout.vue';
import Header from '@/components/Layout/Header.vue';
import { useLayoutStore } from '@/stores/layout';
import { usePreferencesStore } from '@/stores/preferences';

vi.mock('@/locales', () => ({
  $t: (key: string) => key,
  setLocale: vi.fn(),
  LOCALE_NATIVE_LABELS: {},
}));
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/' }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/router/routes', () => ({ basicRoutes: [] }));
vi.mock('@/stores/permission', () => ({ usePermissionStore: () => ({ menuTree: [] }) }));
vi.mock('@/stores/tabs', () => ({ useTabsStore: () => ({ cachedTabs: [], maxCachedTabs: 10 }) }));
vi.mock('@/stores/watermark', () => ({ useWatermarkStore: () => ({ watermarkProps: {} }) }));
vi.mock('@/utils/i18n', () => ({ resolveLocaleText: (key: string) => key }));
vi.mock('@/utils/icon', () => ({ renderIcon: () => undefined }));
vi.mock('@/components/Layout/AvatarDropdown.vue', () => ({
  default: { render: () => 'default-user-menu' },
}));
vi.mock('@/components/Layout/Breadcrumb.vue', () => ({ default: { render: () => 'breadcrumb' } }));
vi.mock('@/components/Layout/FullscreenToggle.vue', () => ({
  default: { render: () => 'fullscreen-control' },
}));
vi.mock('@/components/Layout/LanguageSwitch.vue', () => ({
  default: { render: () => 'language-control' },
}));
vi.mock('@/components/Layout/ThemeToggle.vue', () => ({
  default: { render: () => 'theme-control' },
}));
vi.mock('@/components/Layout/NotificationPanel.vue', () => ({
  __esModule: true,
  default: { render: () => 'notification-control' },
}));
vi.mock('@/components/Layout/Sidebar.vue', () => ({ default: { render: () => 'sidebar' } }));
vi.mock('@/components/Layout/TabBar.vue', () => ({ default: { render: () => 'tabs' } }));

let pinia: ReturnType<typeof createPinia>;
beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
  pinia = createPinia();
  setActivePinia(pinia);
});
afterEach(() => {
  disposePinia(pinia);
  vi.unstubAllGlobals();
});

async function render(component: Component, slots: LayoutHeaderSlots = {}): Promise<string> {
  const app = createSSRApp({
    render: () =>
      h(component, null, {
        ...slots,
        default: () => h('main', 'page-content'),
      }),
  });
  app.use(pinia);
  app.config.globalProperties.$t = (key: string) => key;
  for (const name of [
    'RouterView',
    'ALayoutHeader',
    'ALayout',
    'ALayoutContent',
    'AWatermark',
    'AButton',
    'ATooltip',
    'ADivider',
    'ADropdown',
    'AMenu',
  ]) {
    app.component(
      name,
      defineComponent({
        inheritAttrs: false,
        setup:
          (_props, { slots: children }) =>
          () =>
            h('div', { 'data-component': name }, children.default?.()),
      }),
    );
  }
  return renderToString(app);
}

for (const mode of ['vertical', 'horizontal'] as const) {
  for (const mobile of [false, true]) {
    describe(`${mode} layout, mobile=${mobile}`, () => {
      beforeEach(() => {
        usePreferencesStore(pinia).update({ layoutMode: mode });
        useLayoutStore(pinia).setIsMobile(mobile);
      });

      it('preserves built-in content when no header slot is supplied', async () => {
        const html = await render(AdminLayout);
        expect(html).toContain('default-user-menu');
        expect(html).toContain('page-content');
        expect(html.includes('fullscreen-control')).toBe(!mobile);
      });

      it('forwards additions in order without suppressing the default user menu', async () => {
        const contexts: LayoutHeaderSlotProps[] = [];
        const html = await render(AdminLayout, {
          'header-right-before': (props) => {
            contexts.push(props);
            return [h('span', 'business-before')];
          },
          'header-right-after': (props) => {
            contexts.push(props);
            return [h('span', 'business-after')];
          },
        });
        expect(html.indexOf('business-before')).toBeLessThan(html.indexOf('default-user-menu'));
        expect(html.indexOf('business-after')).toBeGreaterThan(html.indexOf('default-user-menu'));
        expect(contexts).toHaveLength(2);
        for (const props of contexts) {
          expect(props.isMobile).toBe(mobile);
          expect(props.openSearch).toBeTypeOf('function');
          expect(props.openSettings).toBeTypeOf('function');
        }
      });

      it('replaces the whole right area without rendering partial slots or built-in actions', async () => {
        const html = await render(AdminLayout, {
          'header-right': ({ isMobile }) => [h('span', `business-right-${isMobile}`)],
          'header-right-before': () => [h('span', 'unused-before')],
          'header-right-after': () => [h('span', 'unused-after')],
          'header-user': () => [h('span', 'unused-user')],
        });
        expect(html).toContain(`business-right-${mobile}`);
        expect(html).not.toContain('unused-');
        expect(html).not.toContain('default-user-menu');
        expect(html).not.toContain('fullscreen-control');
        expect(html).not.toContain('search-trigger');
        expect(html).toContain('page-content');
      });

      it('replaces only the user menu and retains the remaining actions', async () => {
        const html = await render(AdminLayout, {
          'header-user': ({ isMobile }) => [h('span', `business-user-${isMobile}`)],
        });
        expect(html).toContain(`business-user-${mobile}`);
        expect(html).not.toContain('default-user-menu');
        expect(html).toContain('search-trigger');
        expect(html.includes('fullscreen-control')).toBe(!mobile);
      });
    });
  }
}

describe('standalone Header slots', () => {
  it('offers the same extension points without an AdminLayout wrapper', async () => {
    const html = await render(Header, {
      'header-right-before': () => [h('span', 'direct-before')],
      'header-user': () => [h('span', 'direct-user')],
      'header-right-after': () => [h('span', 'direct-after')],
    });
    expect(html).toContain('direct-before');
    expect(html).toContain('direct-user');
    expect(html).toContain('direct-after');
    expect(html).not.toContain('default-user-menu');
  });
});
