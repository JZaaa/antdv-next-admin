import type { Tab } from '@/types/layout';
import type { AppRouteRecordRaw } from '@/types/router';
import type { RouteLocationNormalized } from 'vue-router';

import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';

import router from '@/router';

import { useSettingsStore } from './settings';

const TABS_STORAGE_KEY = 'app-tabs-state';

export const useTabsStore = defineStore('tabs', () => {
  const settingsStore = useSettingsStore();
  // State
  const tabs = ref<Tab[]>([]);
  const activeTabPath = ref<string>('');
  const refreshingRoutes = ref<string[]>([]);
  const isRestored = ref(false);

  const isFixedTab = (tab: Tab) => Boolean(tab.affix || tab.pinned);
  const updateTabClosable = (tab: Tab) => {
    tab.closable = !isFixedTab(tab);
  };

  function enforceTabLimit(): void {
    const ordinaryTabs = tabs.value.filter((tab) => !isFixedTab(tab));
    const excess = ordinaryTabs.length - settingsStore.maxTabCount;
    if (excess <= 0) return;

    const pathsToClose = new Set(
      ordinaryTabs
        .filter((tab) => tab.path !== activeTabPath.value)
        .reverse()
        .slice(0, excess)
        .map((tab) => tab.path),
    );
    tabs.value = tabs.value.filter((tab) => !pathsToClose.has(tab.path));
  }

  const ensureActiveTab = (fallbackPath?: string) => {
    const activeExists = tabs.value.some((tab) => tab.path === activeTabPath.value);
    if (activeExists) return;

    if (fallbackPath) {
      const fallbackTab = tabs.value.find((tab) => tab.path === fallbackPath);
      if (fallbackTab) {
        activeTabPath.value = fallbackTab.path;
        return;
      }
    }

    activeTabPath.value = tabs.value[0]?.path || '';
  };

  const resolveRoutePath = (path: string, basePath = ''): string => {
    if (!path) {
      return basePath || '/';
    }

    if (path.startsWith('/')) {
      return path;
    }

    const normalizedBase = basePath === '/' ? '' : basePath.replace(/\/$/, '');
    const resolved = `${normalizedBase}/${path}`.replace(/\/+/g, '/');
    return resolved.startsWith('/') ? resolved : `/${resolved}`;
  };

  // Getters
  const cachedTabs = computed(() => {
    return tabs.value
      .filter((tab) => tab.name && !refreshingRoutes.value.includes(tab.name))
      .map((tab) => tab.name);
  });

  // Also bound keyed instances when multiple paths share the same component name.
  // Allow the outgoing view one slot until KeepAlive prunes include after rendering,
  // otherwise inserting its replacement can also evict a retained tab's state.
  const maxCachedTabs = computed(
    () => settingsStore.maxTabCount + tabs.value.filter(isFixedTab).length + 1,
  );

  const activeTab = computed(() => {
    return tabs.value.find((tab) => tab.path === activeTabPath.value);
  });

  // Actions
  const addTab = (route: RouteLocationNormalized) => {
    const { path, fullPath, name, meta, query, params } = route;
    const routeName = String(name || path);
    const routeTitle = meta?.title ? String(meta.title) : routeName;
    const routeIcon = meta?.icon ? String(meta.icon) : undefined;
    const isAffix = Boolean(meta?.affix);

    // Skip if hidden
    if (meta?.hidden) return;

    // Check if tab already exists
    const existingTab = tabs.value.find((tab) => tab.path === path);
    if (existingTab) {
      existingTab.name = routeName;
      existingTab.title = routeTitle;
      existingTab.icon = routeIcon;
      existingTab.fullPath = fullPath;
      existingTab.query = query as Record<string, unknown>;
      existingTab.params = params as Record<string, unknown>;
      existingTab.affix = isAffix;
      if (isAffix) {
        existingTab.pinned = false;
      }
      updateTabClosable(existingTab);
      activeTabPath.value = path;
      enforceTabLimit();
      return;
    }

    // Create new tab
    const newTab: Tab = {
      id: fullPath,
      name: routeName,
      title: routeTitle,
      icon: routeIcon,
      path,
      fullPath,
      query: query as Record<string, unknown>,
      params: params as Record<string, unknown>,
      closable: !isAffix,
      pinned: false,
      affix: isAffix,
    };

    const ordinaryTabs = tabs.value.filter((tab) => !isFixedTab(tab));
    const tabToReplace =
      !isAffix && ordinaryTabs.length >= settingsStore.maxTabCount
        ? ordinaryTabs[ordinaryTabs.length - 1]
        : undefined;
    if (tabToReplace) {
      // Keep the replaced tab's position, including when pinned tabs follow it.
      tabs.value.splice(tabs.value.indexOf(tabToReplace), 1, newTab);
    } else {
      tabs.value.push(newTab);
    }
    activeTabPath.value = path;
    enforceTabLimit();
  };

  const closeTab = (path: string) => {
    const index = tabs.value.findIndex((tab) => tab.path === path);
    if (index === -1) return;

    const tab = tabs.value[index];
    // Cannot close fixed tabs
    if (isFixedTab(tab)) return;

    tabs.value.splice(index, 1);

    // If closing active tab, activate adjacent tab
    if (activeTabPath.value === path) {
      const nextTab = tabs.value[index] || tabs.value[index - 1];
      activeTabPath.value = nextTab?.path || '';
    }

    ensureActiveTab();
  };

  const closeOtherTabs = (path: string) => {
    tabs.value = tabs.value.filter((tab) => tab.path === path || isFixedTab(tab));
    activeTabPath.value = path;
    ensureActiveTab(path);
  };

  const closeAllTabs = () => {
    tabs.value = tabs.value.filter((tab) => isFixedTab(tab));
    ensureActiveTab();
  };

  const closeLeftTabs = (path: string) => {
    const index = tabs.value.findIndex((tab) => tab.path === path);
    if (index === -1) return;

    tabs.value = tabs.value.filter((tab, i) => i >= index || isFixedTab(tab));
    ensureActiveTab(path);
  };

  const closeRightTabs = (path: string) => {
    const index = tabs.value.findIndex((tab) => tab.path === path);
    if (index === -1) return;

    tabs.value = tabs.value.filter((tab, i) => i <= index || isFixedTab(tab));
    ensureActiveTab(path);
  };

  const togglePinTab = (path: string) => {
    const tab = tabs.value.find((item) => item.path === path);
    if (!tab || tab.affix) return;

    tab.pinned = !tab.pinned;
    updateTabClosable(tab);
    enforceTabLimit();
  };

  const setActiveTab = (path: string) => {
    activeTabPath.value = path;
  };

  const refreshTab = async (path: string) => {
    const tab = tabs.value.find((t) => t.path === path);
    if (tab && tab.name) {
      // 1. Remove from cache to force component destruction
      refreshingRoutes.value.push(tab.name);

      // 2. Navigate to redirect page
      // This will unmount the current component and mount the Redirect component
      await router.replace('/redirect' + path);

      // 3. Restore cache state
      // The Redirect component will immediately navigate back to the original path.
      // We use a small delay to ensure the unmount/remount cycle completes.
      setTimeout(() => {
        const index = refreshingRoutes.value.indexOf(tab.name);
        if (index > -1) {
          refreshingRoutes.value.splice(index, 1);
        }
      }, 300);
    }
  };

  // Initialize affix tabs
  const initAffixTabs = (routeList: AppRouteRecordRaw[]) => {
    const affixTabs: Tab[] = [];

    const findAffixRoutes = (items: AppRouteRecordRaw[], basePath = '') => {
      items.forEach((route) => {
        const routePath = route.path ? String(route.path) : '';
        const fullPath = resolveRoutePath(routePath, basePath);
        const meta = route.meta;

        if (meta?.affix && routePath) {
          const routeName = String(route.name || routePath);
          const routeTitle = meta?.title || routeName;
          affixTabs.push({
            id: fullPath,
            name: routeName,
            title: routeTitle,
            icon: meta?.icon,
            path: fullPath,
            fullPath,
            closable: false,
            pinned: false,
            affix: true,
          });
        }

        if (route.children) {
          findAffixRoutes(route.children, fullPath);
        }
      });
    };

    findAffixRoutes(routeList);
    tabs.value = affixTabs;
    if (affixTabs.length > 0) {
      activeTabPath.value = affixTabs[0].path;
    }
  };

  // Save tabs state to localStorage
  const saveTabsState = () => {
    if (!settingsStore.rememberTabState) return;

    const state = {
      tabs: tabs.value,
      activeTabPath: activeTabPath.value,
    };
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(state));
  };

  // Restore tabs state from localStorage
  const restoreTabsState = (routes: AppRouteRecordRaw[]) => {
    if (!settingsStore.rememberTabState || isRestored.value) return;

    const savedState = localStorage.getItem(TABS_STORAGE_KEY);
    if (!savedState) return;

    try {
      const state = JSON.parse(savedState);
      if (state.tabs && Array.isArray(state.tabs) && state.tabs.length > 0) {
        // Filter out tabs that no longer exist in routes
        const validPaths = new Set<string>();
        const collectPaths = (routeList: AppRouteRecordRaw[], basePath = '') => {
          routeList.forEach((route) => {
            const routePath = route.path ? String(route.path) : '';
            const fullPath = resolveRoutePath(routePath, basePath);
            validPaths.add(fullPath);
            if (route.children) {
              collectPaths(route.children, fullPath);
            }
          });
        };
        collectPaths(routes);

        // Restore tabs that still exist
        const restoredTabs = state.tabs
          .filter((tab: Tab) => validPaths.has(tab.path))
          .map((tab: Tab) => {
            const restoredTab = { ...tab };
            delete restoredTab.favorite;
            updateTabClosable(restoredTab);
            return restoredTab;
          });
        if (restoredTabs.length > 0) {
          tabs.value = restoredTabs;
          // Restore active tab if it exists
          if (state.activeTabPath && validPaths.has(state.activeTabPath)) {
            activeTabPath.value = state.activeTabPath;
          } else {
            activeTabPath.value = restoredTabs[0].path;
          }
          ensureActiveTab();
          enforceTabLimit();
          isRestored.value = true;
        }
      }
    } catch {
      // Invalid saved state, ignore
    }
  };

  // Clear saved tabs state
  const clearTabsState = () => {
    localStorage.removeItem(TABS_STORAGE_KEY);
  };

  const resetTabs = () => {
    tabs.value = [];
    activeTabPath.value = '';
    refreshingRoutes.value = [];
    isRestored.value = false;
  };

  watch(() => settingsStore.maxTabCount, enforceTabLimit, { flush: 'sync' });

  // Watch for changes and auto-save
  watch(
    () => ({ tabs: tabs.value, activeTabPath: activeTabPath.value }),
    () => {
      saveTabsState();
    },
    { deep: true },
  );

  return {
    // State
    tabs,
    activeTabPath,
    // Getters
    cachedTabs,
    maxCachedTabs,
    activeTab,
    // Actions
    addTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    closeLeftTabs,
    closeRightTabs,
    togglePinTab,
    setActiveTab,
    refreshTab,
    initAffixTabs,
    restoreTabsState,
    clearTabsState,
    resetTabs,
  };
});
