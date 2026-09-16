import type { UserPreferences } from '@/types/preferences';

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { appDefaultSettings } from '@/settings';
import { appLocalStorage } from '@/utils/cache';
import {
  PREFERENCE_STORAGE_KEYS,
  persistPreference,
  readPreferenceOverrides,
  resolvePreferences,
  sanitizePreferences,
} from '@/utils/preferences';

export const usePreferencesStore = defineStore('preferences', () => {
  const overrides = ref(readPreferenceOverrides());
  const preferences = computed(() =>
    resolvePreferences(
      appDefaultSettings.preferences,
      overrides.value,
      appDefaultSettings.features,
    ),
  );

  function update(patch: Partial<UserPreferences>): void {
    if (!appDefaultSettings.features.personalization) return;
    const next = { ...overrides.value };
    function apply<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
      persistPreference(key, value);
      if (value === appDefaultSettings.preferences[key]) delete next[key];
      else next[key] = value;
    }
    const valid = sanitizePreferences(patch);
    for (const key of Object.keys(valid) as Array<keyof UserPreferences>) {
      const value = valid[key];
      if (value !== undefined) apply(key, value);
    }
    overrides.value = next;
  }

  function reset(): void {
    for (const key of Object.values(PREFERENCE_STORAGE_KEYS)) appLocalStorage.removeItem(key);
    overrides.value = {};
  }

  return { preferences, update, reset };
});
