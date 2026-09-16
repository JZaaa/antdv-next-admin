import type { AppFeatures, UserPreferences } from '@/types/preferences';

import { appDefaultSettings } from '@/settings';
import { appLocalStorage } from '@/utils/cache';
import { isHexColor } from '@/utils/color';

export const MAX_TAB_COUNT = 50;
export const AI_PANEL_MIN_WIDTH = 320;
export const AI_PANEL_MAX_WIDTH = 560;

// Keep existing namespaced keys so upgrades within the same cache version preserve choices.
export const PREFERENCE_STORAGE_KEYS: Record<keyof UserPreferences, string> = {
  primaryColor: 'app-primary-color',
  customPrimaryColor: 'app-custom-primary-color',
  sidebarTheme: 'app-sidebar-theme',
  layoutMode: 'app-layout-mode',
  pageAnimation: 'app-page-animation',
  grayMode: 'app-gray-mode',
  rememberTabState: 'app-remember-tab-state',
  maxTabCount: 'app-max-tab-count',
  showLanguageSwitch: 'app-show-language-switch',
  themeMode: 'theme-mode',
  locale: 'app-locale',
  sidebarCollapsed: 'sidebar-collapsed',
  aiEntryVisible: 'layout-ai-entry-visible',
  aiCollabEnabled: 'layout-ai-collab-enabled',
  aiPanelWidth: 'layout-ai-panel-width',
};

type PreferenceValidators = {
  [K in keyof UserPreferences]: (value: unknown) => UserPreferences[K] | undefined;
};

function oneOf<T extends string>(values: readonly T[]): (value: unknown) => T | undefined {
  return (value) => values.find((candidate) => candidate === value);
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function boundedNumber(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.floor(value)))
    : undefined;
}

const validators: PreferenceValidators = {
  primaryColor: oneOf(['blue', 'green', 'purple', 'red', 'orange', 'cyan']),
  customPrimaryColor: (value) =>
    typeof value === 'string' && (value === '' || isHexColor(value)) ? value : undefined,
  sidebarTheme: oneOf(['light', 'dark']),
  layoutMode: oneOf(['vertical', 'horizontal']),
  pageAnimation: oneOf([
    'fade',
    'slide-left',
    'slide-right',
    'slide-up',
    'slide-down',
    'zoom',
    'zoom-big',
    'none',
  ]),
  grayMode: booleanValue,
  rememberTabState: booleanValue,
  maxTabCount: (value) => boundedNumber(value, 1, MAX_TAB_COUNT),
  showLanguageSwitch: booleanValue,
  themeMode: oneOf(['light', 'dark', 'system']),
  locale: oneOf(['zh-CN', 'en-US']),
  sidebarCollapsed: booleanValue,
  aiEntryVisible: booleanValue,
  aiCollabEnabled: booleanValue,
  aiPanelWidth: (value) => boundedNumber(value, AI_PANEL_MIN_WIDTH, AI_PANEL_MAX_WIDTH),
};

export function normalizePreference<K extends keyof UserPreferences>(
  key: K,
  value: unknown,
): UserPreferences[K] | undefined {
  return validators[key](value);
}

/** Whitelist valid fields; unknown properties and system switches never enter runtime state. */
export function sanitizePreferences(input: unknown): Partial<UserPreferences> {
  const result: Partial<UserPreferences> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return result;
  function copy<K extends keyof UserPreferences>(key: K): void {
    if (!Object.prototype.hasOwnProperty.call(input, key)) return;
    const value = normalizePreference(key, Reflect.get(input as object, key));
    if (value !== undefined) result[key] = value;
  }
  for (const key of Object.keys(PREFERENCE_STORAGE_KEYS) as Array<keyof UserPreferences>) copy(key);
  return result;
}

export function resolvePreferences(
  defaults: UserPreferences,
  overrides: unknown,
  features: AppFeatures,
): UserPreferences {
  const saved = features.personalization ? sanitizePreferences(overrides) : {};
  const merged = { ...defaults, ...saved };
  // A preset selection clears a custom code default as one atomic color choice.
  if (saved.primaryColor !== undefined && saved.customPrimaryColor === undefined)
    merged.customPrimaryColor = '';
  merged.showLanguageSwitch = features.languageSwitch && merged.showLanguageSwitch;
  merged.aiEntryVisible = features.aiChat && merged.aiEntryVisible;
  merged.aiCollabEnabled = features.aiChat && merged.aiEntryVisible && merged.aiCollabEnabled;
  return merged;
}

export function readPreferenceOverrides(
  storage: Pick<Storage, 'getItem'> = appLocalStorage,
): Partial<UserPreferences> {
  const raw: Record<string, unknown> = {};
  for (const [key, storageKey] of Object.entries(PREFERENCE_STORAGE_KEYS)) {
    const saved = storage.getItem(storageKey);
    if (saved === null) continue;
    const defaultValue = appDefaultSettings.preferences[key as keyof UserPreferences];
    raw[key] =
      typeof defaultValue === 'boolean'
        ? saved === 'true'
          ? true
          : saved === 'false'
            ? false
            : undefined
        : typeof defaultValue === 'number'
          ? saved.trim() === ''
            ? undefined
            : Number(saved)
          : saved;
  }
  return sanitizePreferences(raw);
}

/** Synchronous bootstrap path, shared by locale initialization and Pinia stores. */
export function readPreferences(): UserPreferences {
  return resolvePreferences(
    appDefaultSettings.preferences,
    readPreferenceOverrides(),
    appDefaultSettings.features,
  );
}

export function persistPreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K],
): void {
  if (!appDefaultSettings.features.personalization) return;
  const storageKey = PREFERENCE_STORAGE_KEYS[key];
  if (value === appDefaultSettings.preferences[key]) appLocalStorage.removeItem(storageKey);
  else appLocalStorage.setItem(storageKey, String(value));
}
