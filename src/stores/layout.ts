import { defineStore } from 'pinia';
import { computed, ref, watch, onScopeDispose } from 'vue';

import { appDefaultSettings } from '@/settings';
import { usePreferencesStore } from '@/stores/preferences';
import { AI_PANEL_MIN_WIDTH, AI_PANEL_MAX_WIDTH } from '@/utils/preferences';

export const useLayoutStore = defineStore('layout', () => {
  const preferenceStore = usePreferencesStore();
  const collapsed = ref(preferenceStore.preferences.sidebarCollapsed);
  const sidebarWidth = ref(appDefaultSettings.layout.sidebarWidth);
  const collapsedWidth = ref(appDefaultSettings.layout.collapsedWidth);
  const isMobile = ref(false);
  const pageFullscreen = ref(false);
  const aiEntryVisible = computed(() => preferenceStore.preferences.aiEntryVisible);
  const aiOpen = ref(preferenceStore.preferences.aiCollabEnabled);
  const aiCollabEnabled = computed(
    () => appDefaultSettings.features.aiChat && aiEntryVisible.value && aiOpen.value,
  );
  const aiPanelWidth = ref(preferenceStore.preferences.aiPanelWidth);

  function setSidebarCollapsed(value: boolean): void {
    preferenceStore.update({ sidebarCollapsed: value });
    collapsed.value = value;
  }
  function toggleSidebar(): void {
    setSidebarCollapsed(!collapsed.value);
  }
  function setIsMobile(value: boolean): void {
    isMobile.value = value;
    if (value) collapsed.value = true;
  }
  function togglePageFullscreen(): void {
    pageFullscreen.value = !pageFullscreen.value;
  }
  function setPageFullscreen(value: boolean): void {
    pageFullscreen.value = value;
  }
  function setAiCollabEnabled(value: boolean): void {
    const enabled = value && appDefaultSettings.features.aiChat && aiEntryVisible.value;
    preferenceStore.update({ aiCollabEnabled: enabled });
    aiOpen.value = enabled;
  }
  function toggleAiCollab(): void {
    setAiCollabEnabled(!aiCollabEnabled.value);
  }
  function setAiEntryVisible(value: boolean): void {
    preferenceStore.update({
      aiEntryVisible: value,
      ...(!value ? { aiCollabEnabled: false } : {}),
    });
    if (!value) aiOpen.value = false;
  }
  function setAiPanelWidth(value: number): void {
    if (!Number.isFinite(value)) return;
    const width = Math.max(AI_PANEL_MIN_WIDTH, Math.min(AI_PANEL_MAX_WIDTH, Math.round(value)));
    preferenceStore.update({ aiPanelWidth: width });
    aiPanelWidth.value = width;
  }
  function getCurrentSidebarWidth(): number {
    return collapsed.value ? collapsedWidth.value : sidebarWidth.value;
  }

  watch(
    () => preferenceStore.preferences.sidebarCollapsed,
    (value) => {
      collapsed.value = isMobile.value || value;
    },
    { flush: 'sync' },
  );
  watch(
    () => preferenceStore.preferences.aiCollabEnabled,
    (value) => {
      aiOpen.value = value;
    },
    { flush: 'sync' },
  );
  watch(
    () => preferenceStore.preferences.aiPanelWidth,
    (value) => {
      aiPanelWidth.value = value;
    },
    { flush: 'sync' },
  );

  function checkMobile(): void {
    setIsMobile(window.innerWidth < 768);
  }
  function initLayout(): void {
    checkMobile();
    window.addEventListener('resize', checkMobile);
  }
  onScopeDispose(() => {
    if (typeof window !== 'undefined') window.removeEventListener('resize', checkMobile);
  });

  return {
    collapsed,
    sidebarWidth,
    collapsedWidth,
    isMobile,
    pageFullscreen,
    aiEntryVisible,
    aiCollabEnabled,
    aiPanelWidth,
    toggleSidebar,
    setSidebarCollapsed,
    setIsMobile,
    togglePageFullscreen,
    setPageFullscreen,
    toggleAiCollab,
    setAiCollabEnabled,
    setAiEntryVisible,
    setAiPanelWidth,
    getCurrentSidebarWidth,
    initLayout,
  };
});
