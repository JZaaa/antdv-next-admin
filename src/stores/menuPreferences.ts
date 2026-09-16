import type { MenuSearchView } from '@/types/navigation';

import { defineStore } from 'pinia';
import { ref } from 'vue';

import { appLocalStorage } from '@/utils/cache';
import { resolveStoredFavoritePaths, resolveStoredMenuSearchView } from '@/utils/menuPreferences';

const MENU_FAVORITES_STORAGE_KEY = 'app-menu-favorites';
const MENU_SEARCH_VIEW_STORAGE_KEY = 'app-menu-search-view';
const LEGACY_TABS_STORAGE_KEY = 'app-tabs-state';

function readStorageItem(key: string): string | null {
  try {
    return appLocalStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageItem(key: string, value: string): void {
  try {
    appLocalStorage.setItem(key, value);
  } catch {
    // Keep the in-memory preference usable when storage is unavailable.
  }
}

export const useMenuPreferencesStore = defineStore('menu-preferences', () => {
  const rawFavoritePaths = readStorageItem(MENU_FAVORITES_STORAGE_KEY);
  const initialFavoritePaths = resolveStoredFavoritePaths(
    rawFavoritePaths,
    readStorageItem(LEGACY_TABS_STORAGE_KEY),
  );
  const favoritePaths = ref<string[]>(initialFavoritePaths);
  const searchView = ref<MenuSearchView>(
    resolveStoredMenuSearchView(readStorageItem(MENU_SEARCH_VIEW_STORAGE_KEY)),
  );

  const normalizedFavoritePaths = JSON.stringify(initialFavoritePaths);
  if (rawFavoritePaths !== normalizedFavoritePaths) {
    writeStorageItem(MENU_FAVORITES_STORAGE_KEY, normalizedFavoritePaths);
  }

  const isFavorite = (path: string): boolean => favoritePaths.value.includes(path);

  const toggleFavorite = (path: string): void => {
    const normalizedPath = path.trim();
    if (!normalizedPath) return;

    if (isFavorite(normalizedPath)) {
      favoritePaths.value = favoritePaths.value.filter((item) => item !== normalizedPath);
    } else {
      favoritePaths.value = [normalizedPath, ...favoritePaths.value];
    }

    writeStorageItem(MENU_FAVORITES_STORAGE_KEY, JSON.stringify(favoritePaths.value));
  };

  const setSearchView = (view: MenuSearchView): void => {
    searchView.value = view;
    writeStorageItem(MENU_SEARCH_VIEW_STORAGE_KEY, view);
  };

  return {
    favoritePaths,
    searchView,
    isFavorite,
    toggleFavorite,
    setSearchView,
  };
});
