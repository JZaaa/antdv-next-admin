import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createApp: vi.fn(),
  mount: vi.fn(),
  use: vi.fn(),
  router: { isReady: vi.fn(() => Promise.resolve()) },
}));

vi.mock('vue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue')>()),
  createApp: mocks.createApp,
}));
vi.mock('pinia', async (importOriginal) => ({
  ...(await importOriginal<typeof import('pinia')>()),
  createPinia: () => ({}),
}));
vi.mock('@/App.vue', () => ({ default: {} }));
vi.mock('@/router', () => ({ default: mocks.router }));
vi.mock('@/components/Global/defaultComponentProps', () => ({
  registerDefaultComponentProps: vi.fn(),
}));
vi.mock('@/directives', () => ({ setupDirectives: vi.fn() }));
vi.mock('@/stores/menuPreferences', () => ({ useMenuPreferencesStore: vi.fn() }));
vi.mock('@/utils/request', () => ({ service: {} }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.doUnmock('@/locales/en-US');
});

describe('saved English locale startup', () => {
  it('waits for messages before initial route titles and rendering', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_DEMO_MODE', 'false');
    vi.stubGlobal('localStorage', { getItem: () => 'en-US' });
    vi.stubGlobal('sessionStorage', { getItem: () => null });
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
    vi.stubGlobal('document', { documentElement: { lang: '' }, createElement: vi.fn() });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    let releaseEnglish!: () => void;
    const pendingEnglish = new Promise<void>((resolve) => {
      releaseEnglish = resolve;
    });
    vi.doMock('@/locales/en-US', async () => {
      await pendingEnglish;
      return vi.importActual('@/locales/en-US');
    });

    const locale = await import('@/locales');
    const titles: string[] = [];
    const app = { use: mocks.use, mount: mocks.mount };
    mocks.createApp.mockReturnValue(app);
    mocks.use.mockImplementation((plugin: unknown) => {
      if (plugin === mocks.router) {
        titles.push(locale.$t('error.404'), locale.$t('menu.vxeTable'));
      }
      return app;
    });

    try {
      await import('@/main');
      expect(mocks.createApp).not.toHaveBeenCalled();
      expect(mocks.mount).not.toHaveBeenCalled();
    } finally {
      releaseEnglish();
    }

    await vi.waitFor(() => expect(mocks.mount).toHaveBeenCalledWith('#app'));
    expect(titles).toEqual(['Page Not Found', 'VXE Table']);
    expect(locale.getLocale()).toBe('en-US');
    expect(warn).not.toHaveBeenCalled();
  });
});
