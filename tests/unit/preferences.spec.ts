import { createPinia, disposePinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { appDefaultSettings } from '@/settings';
import { useLayoutStore } from '@/stores/layout';
import { usePreferencesStore } from '@/stores/preferences';
import { useSettingsStore } from '@/stores/settings';
import { useThemeStore } from '@/stores/theme';
import { getStorageKey } from '@/utils/cache';
import {
  readPreferenceOverrides,
  resolvePreferences,
  sanitizePreferences,
} from '@/utils/preferences';
import { NamespacedStorage, createStorageNamespace } from '@/utils/storageNamespace';

const defaults = { ...appDefaultSettings.preferences };
const features = { ...appDefaultSettings.features };
let pinia: ReturnType<typeof createPinia>;
let values: Map<string, string>;
let storage: Storage;
let classes: Set<string>;

beforeEach(() => {
  values = new Map();
  storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    key: (index) => [...values.keys()][index] ?? null,
  };
  classes = new Set();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('document', {
    documentElement: {
      classList: {
        toggle: (name: string, enabled: boolean) =>
          enabled ? classes.add(name) : classes.delete(name),
      },
      style: { setProperty: vi.fn(), removeProperty: vi.fn() },
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
    },
  });
  pinia = createPinia();
  setActivePinia(pinia);
});

afterEach(() => {
  disposePinia(pinia);
  Object.assign(appDefaultSettings.preferences, defaults);
  Object.assign(appDefaultSettings.features, features);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function reload(): void {
  disposePinia(pinia);
  pinia = createPinia();
  setActivePinia(pinia);
}

describe('code defaults and user preference overrides', () => {
  it('applies custom defaults before initialization without writing them to cache', () => {
    Object.assign(appDefaultSettings.preferences, {
      primaryColor: 'purple',
      sidebarTheme: 'dark',
      maxTabCount: 18,
      rememberTabState: false,
      themeMode: 'dark',
      aiEntryVisible: false,
    });
    const settings = useSettingsStore();
    expect(settings.maxTabCount).toBe(18);
    expect(settings.rememberTabState).toBe(false);
    expect(settings.sidebarTheme).toBe('dark');
    expect(useThemeStore().mode).toBe('dark');
    expect(useLayoutStore().aiEntryVisible).toBe(false);
    settings.initSettings();
    expect(settings.primaryColorHex).toBe('#722ed1');
    expect(values.size).toBe(0);
  });

  it('retains user changes while untouched fields receive new code defaults', () => {
    usePreferencesStore().update({ primaryColor: 'green', maxTabCount: 7 });
    Object.assign(appDefaultSettings.preferences, {
      primaryColor: 'purple',
      pageAnimation: 'fade',
      maxTabCount: 20,
    });
    reload();
    expect(usePreferencesStore().preferences).toMatchObject({
      primaryColor: 'green',
      maxTabCount: 7,
      pageAnimation: 'fade',
    });
    expect([...values.keys()]).toHaveLength(2);
  });

  it('removes an override when changed back to its default', () => {
    const store = usePreferencesStore();
    store.update({ maxTabCount: 4 });
    store.update({ maxTabCount: defaults.maxTabCount });
    expect(values.has(getStorageKey('app-max-tab-count'))).toBe(false);
    appDefaultSettings.preferences.maxTabCount = 16;
    reload();
    expect(useSettingsStore().maxTabCount).toBe(16);
  });

  it('resets theme, layout and colors to code defaults while preserving unrelated caches', () => {
    Object.assign(appDefaultSettings.preferences, {
      customPrimaryColor: '#123456',
      sidebarTheme: 'light',
      themeMode: 'dark',
      aiPanelWidth: 380,
    });
    values.set(getStorageKey('access_token'), 'keep-token');
    values.set(getStorageKey('app-tabs-state'), 'keep-tabs');
    values.set('another-project:theme-mode', 'keep-foreign');
    const settings = useSettingsStore();
    const theme = useThemeStore();
    const layout = useLayoutStore();
    usePreferencesStore().update({
      primaryColor: 'green',
      customPrimaryColor: '',
      sidebarTheme: 'dark',
      themeMode: 'light',
      locale: 'en-US',
    });
    layout.setAiCollabEnabled(true);
    layout.setAiPanelWidth(500);
    settings.resetSettings();
    expect(settings.primaryColorHex).toBe('#123456');
    expect(settings.sidebarTheme).toBe('light');
    expect(theme.mode).toBe('dark');
    expect(classes.has('dark')).toBe(true);
    expect(layout.aiCollabEnabled).toBe(false);
    expect(layout.aiPanelWidth).toBe(380);
    expect(usePreferencesStore().preferences.locale).toBe(defaults.locale);
    expect([...values.values()]).toEqual(['keep-token', 'keep-tabs', 'keep-foreign']);
  });

  it('lets a preset override a custom default and restores the custom default on reset', () => {
    appDefaultSettings.preferences.customPrimaryColor = '#abcdef';
    const settings = useSettingsStore();
    settings.setPrimaryColor('blue');
    reload();
    expect(useSettingsStore().primaryColorHex).toBe('#1890ff');
    useSettingsStore().resetSettings();
    expect(useSettingsStore().primaryColorHex).toBe('#abcdef');
  });

  it('ignores all overrides and refuses preference writes when personalization is disabled', () => {
    values.set(getStorageKey('app-primary-color'), 'red');
    values.set(getStorageKey('theme-mode'), 'dark');
    values.set(getStorageKey('app-locale'), 'en-US');
    values.set(getStorageKey('layout-ai-entry-visible'), 'false');
    appDefaultSettings.features.personalization = false;
    const store = usePreferencesStore();
    expect(store.preferences).toEqual(defaults);
    const before = [...values];
    store.update({ primaryColor: 'purple', locale: 'en-US' });
    useThemeStore().setTheme('dark');
    expect(store.preferences).toEqual(defaults);
    expect([...values]).toEqual(before);
    // Navigation remains usable without persisting personal settings.
    useLayoutStore().toggleSidebar();
    expect(useLayoutStore().collapsed).toBe(true);
    expect([...values]).toEqual(before);
  });

  it('enforces disabled modules even when old cache enables their controls', () => {
    values.set(getStorageKey('layout-ai-entry-visible'), 'true');
    values.set(getStorageKey('layout-ai-collab-enabled'), 'true');
    values.set(getStorageKey('app-show-language-switch'), 'true');
    appDefaultSettings.features.aiChat = false;
    appDefaultSettings.features.languageSwitch = false;
    expect(useLayoutStore().aiEntryVisible).toBe(false);
    useLayoutStore().setAiCollabEnabled(true);
    expect(useLayoutStore().aiCollabEnabled).toBe(false);
    expect(useSettingsStore().showLanguageSwitch).toBe(false);
    expect(sanitizePreferences({ features: { aiChat: true }, personalization: true })).toEqual({});
  });

  it('ignores malformed values and unknown fields, and clamps numeric limits', () => {
    expect(
      sanitizePreferences({
        primaryColor: 'toString',
        customPrimaryColor: 'red',
        sidebarTheme: 'invalid',
        layoutMode: false,
        pageAnimation: 'unknown',
        themeMode: 'unknown',
        locale: 'other',
        grayMode: 'false',
        maxTabCount: 999,
        aiPanelWidth: -1,
        aiEntryVisible: false,
        features: { personalization: false },
      }),
    ).toEqual({ maxTabCount: 50, aiPanelWidth: 320, aiEntryVisible: false });
    values.set(getStorageKey('app-gray-mode'), 'garbage');
    values.set(getStorageKey('app-max-tab-count'), 'Infinity');
    values.set(getStorageKey('app-layout-mode'), 'unknown');
    values.set(getStorageKey('app-remember-tab-state'), 'false');
    expect(usePreferencesStore().preferences).toEqual({ ...defaults, rememberTabState: false });
  });

  it('falls back to defaults and keeps runtime changes when browser storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = usePreferencesStore();
    expect(store.preferences).toEqual(defaults);
    store.update({ grayMode: true });
    expect(store.preferences.grayMode).toBe(true);
  });

  it.each(['project', 'mode', 'appVersion', 'cacheVersion'] as const)(
    'isolates preferences when %s changes',
    (segment) => {
      const base = { project: 'admin', mode: 'production', appVersion: '1.0.0', cacheVersion: '1' };
      const old = new NamespacedStorage(() => storage, createStorageNamespace(base));
      old.setItem('app-primary-color', 'purple');
      const current = new NamespacedStorage(
        () => storage,
        createStorageNamespace({ ...base, [segment]: 'new' }),
      );
      expect(resolvePreferences(defaults, readPreferenceOverrides(current), features)).toEqual(
        defaults,
      );
      expect(old.getItem('app-primary-color')).toBe('purple');
    },
  );
});
