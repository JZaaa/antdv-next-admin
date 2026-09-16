import type { PrimaryColor, SidebarTheme, LayoutMode, PageAnimation } from '@/types/layout';

import { generate } from '@ant-design/colors';
import { defineStore } from 'pinia';
import { computed, watch } from 'vue';

import { appDefaultSettings } from '@/settings';
import { usePreferencesStore } from '@/stores/preferences';
import { hexColorVariables, isHexColor } from '@/utils/color';
import { MAX_TAB_COUNT } from '@/utils/preferences';

export { MAX_TAB_COUNT };
export const DEFAULT_MAX_TAB_COUNT = appDefaultSettings.preferences.maxTabCount;

const PRIMARY_COLOR_HEX_MAP: Record<PrimaryColor, string> = {
  blue: '#1890ff',
  green: '#52c41a',
  purple: '#722ed1',
  red: '#f5222d',
  orange: '#fa8c16',
  cyan: '#13c2c2',
};

const clearCustomPrimaryColorStyles = () => {
  const rootStyle = document.documentElement.style;
  rootStyle.removeProperty('--color-primary');
  for (let index = 1; index <= 10; index += 1) {
    rootStyle.removeProperty(`--color-primary-${index}`);
  }
  for (const name of ['color-primary', 'color-primary-5']) {
    for (const channel of ['r', 'g', 'b', 'rgb', 'alpha']) {
      rootStyle.removeProperty(`--${name}-${channel}`);
    }
  }
};

export const useSettingsStore = defineStore('settings', () => {
  const preferenceStore = usePreferencesStore();
  const primaryColor = computed(() => preferenceStore.preferences.primaryColor);
  const customPrimaryColor = computed(() => preferenceStore.preferences.customPrimaryColor);
  const primaryColorHex = computed(
    () => customPrimaryColor.value || PRIMARY_COLOR_HEX_MAP[primaryColor.value],
  );
  const sidebarTheme = computed(() => preferenceStore.preferences.sidebarTheme);
  const layoutMode = computed(() => preferenceStore.preferences.layoutMode);
  const pageAnimation = computed(() => preferenceStore.preferences.pageAnimation);
  const grayMode = computed(() => preferenceStore.preferences.grayMode);
  const rememberTabState = computed(() => preferenceStore.preferences.rememberTabState);
  const maxTabCount = computed(() => preferenceStore.preferences.maxTabCount);
  const showLanguageSwitch = computed(() => preferenceStore.preferences.showLanguageSwitch);
  const features = appDefaultSettings.features;

  function applyPrimaryColor(): void {
    if (typeof document === 'undefined') return;
    const hex = primaryColorHex.value;
    const root = document.documentElement;
    if (!customPrimaryColor.value) {
      clearCustomPrimaryColorStyles();
      root.setAttribute('data-primary-color', primaryColor.value);
      root.style.setProperty('--ant-primary-color', hex);
      return;
    }
    root.removeAttribute('data-primary-color');
    const colors = generate(hex);
    root.style.setProperty('--color-primary', hex);
    root.style.setProperty('--ant-primary-color', hex);
    colors.forEach((color, index) =>
      root.style.setProperty('--color-primary-' + (index + 1), color),
    );
    for (const [name, value] of Object.entries({
      ...hexColorVariables('color-primary', hex),
      ...hexColorVariables('color-primary-5', colors[4]!),
    }))
      root.style.setProperty(name, value);
  }

  function applyGrayMode(): void {
    if (typeof document !== 'undefined')
      document.documentElement.classList.toggle('gray-mode', grayMode.value);
  }

  function setPrimaryColor(color: PrimaryColor): void {
    preferenceStore.update({ primaryColor: color, customPrimaryColor: '' });
  }
  function setCustomPrimaryColor(hex: string): void {
    if (isHexColor(hex)) preferenceStore.update({ customPrimaryColor: hex });
  }
  function setSidebarTheme(value: SidebarTheme): void {
    preferenceStore.update({ sidebarTheme: value });
  }
  function setLayoutMode(value: LayoutMode): void {
    preferenceStore.update({ layoutMode: value });
  }
  function setPageAnimation(value: PageAnimation): void {
    preferenceStore.update({ pageAnimation: value });
  }
  function setGrayMode(value: boolean): void {
    preferenceStore.update({ grayMode: value });
  }
  function setRememberTabState(value: boolean): void {
    preferenceStore.update({ rememberTabState: value });
  }
  function setShowLanguageSwitch(value: boolean): void {
    preferenceStore.update({ showLanguageSwitch: value });
  }
  function setMaxTabCount(value: number | string | null): void {
    if (value === null || value === '') return;
    preferenceStore.update({
      maxTabCount: Number.isFinite(Number(value)) ? Number(value) : DEFAULT_MAX_TAB_COUNT,
    });
  }
  function resetSettings(): void {
    preferenceStore.reset();
  }
  function initSettings(): void {
    applyPrimaryColor();
    applyGrayMode();
  }

  watch([primaryColor, customPrimaryColor], applyPrimaryColor, { flush: 'sync' });
  watch(grayMode, applyGrayMode, { flush: 'sync' });

  return {
    features,
    primaryColor,
    customPrimaryColor,
    primaryColorHex,
    sidebarTheme,
    layoutMode,
    pageAnimation,
    grayMode,
    rememberTabState,
    maxTabCount,
    showLanguageSwitch,
    setPrimaryColor,
    setCustomPrimaryColor,
    setSidebarTheme,
    setLayoutMode,
    setPageAnimation,
    setGrayMode,
    setRememberTabState,
    setMaxTabCount,
    setShowLanguageSwitch,
    resetSettings,
    initSettings,
  };
});
