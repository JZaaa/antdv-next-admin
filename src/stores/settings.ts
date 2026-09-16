import type { PrimaryColor, SidebarTheme, LayoutMode, PageAnimation } from '@/types/layout';

import { generate } from '@ant-design/colors';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { hexColorVariables, isHexColor } from '@/utils/color';

export const DEFAULT_MAX_TAB_COUNT = 10;
export const MAX_TAB_COUNT = 50;
const MAX_TAB_COUNT_STORAGE_KEY = 'app-max-tab-count';

function normalizeMaxTabCount(value: number): number {
  return Number.isFinite(value)
    ? Math.min(MAX_TAB_COUNT, Math.max(1, Math.floor(value)))
    : DEFAULT_MAX_TAB_COUNT;
}

function readMaxTabCount(): number {
  try {
    const saved = localStorage.getItem(MAX_TAB_COUNT_STORAGE_KEY);
    return saved === null || saved.trim() === ''
      ? DEFAULT_MAX_TAB_COUNT
      : normalizeMaxTabCount(Number(saved));
  } catch {
    return DEFAULT_MAX_TAB_COUNT;
  }
}

const PAGE_ANIMATION_VALUES: Set<string> = new Set([
  'fade',
  'slide-left',
  'slide-right',
  'slide-up',
  'slide-down',
  'zoom',
  'zoom-big',
  'none',
]);

const PRIMARY_COLOR_HEX_MAP: Record<PrimaryColor, string> = {
  blue: '#1890ff',
  green: '#52c41a',
  purple: '#722ed1',
  red: '#f5222d',
  orange: '#fa8c16',
  cyan: '#13c2c2',
};

const isPrimaryColor = (color: string): color is PrimaryColor => color in PRIMARY_COLOR_HEX_MAP;

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
  // State
  const primaryColor = ref<PrimaryColor>('blue');
  const customPrimaryColor = ref<string>('');
  const primaryColorHex = computed(
    () => customPrimaryColor.value || PRIMARY_COLOR_HEX_MAP[primaryColor.value],
  );
  const sidebarTheme = ref<SidebarTheme>('light');
  const layoutMode = ref<LayoutMode>('vertical');
  const pageAnimation = ref<PageAnimation>('slide-left');
  const grayMode = ref(false);
  const rememberTabState = ref(true);
  // Router guards restore tabs before App.onMounted initializes visual settings.
  const maxTabCount = ref(readMaxTabCount());
  const showLanguageSwitch = ref(true);

  // Actions
  const setPrimaryColor = (color: PrimaryColor) => {
    primaryColor.value = color;
    customPrimaryColor.value = '';
    const hex = PRIMARY_COLOR_HEX_MAP[color];
    clearCustomPrimaryColorStyles();
    document.documentElement.setAttribute('data-primary-color', color);
    document.documentElement.style.setProperty('--ant-primary-color', hex);
    localStorage.setItem('app-primary-color', color);
    localStorage.removeItem('app-custom-primary-color');
  };

  const setCustomPrimaryColor = (hex: string) => {
    if (!isHexColor(hex)) return;
    customPrimaryColor.value = hex;
    document.documentElement.removeAttribute('data-primary-color');

    // Generate color scales from the custom color
    const colors = generate(hex);

    // Set base color
    document.documentElement.style.setProperty('--color-primary', hex);
    document.documentElement.style.setProperty('--ant-primary-color', hex);

    // Set color scales (1-10)
    colors.forEach((color, index) => {
      document.documentElement.style.setProperty(`--color-primary-${index + 1}`, color);
    });

    for (const [name, value] of Object.entries({
      ...hexColorVariables('color-primary', hex),
      ...hexColorVariables('color-primary-5', colors[4]!),
    })) {
      document.documentElement.style.setProperty(name, value);
    }

    localStorage.setItem('app-custom-primary-color', hex);
  };

  const setSidebarTheme = (theme: SidebarTheme) => {
    sidebarTheme.value = theme;
    localStorage.setItem('app-sidebar-theme', theme);
  };

  const setLayoutMode = (mode: LayoutMode) => {
    layoutMode.value = mode;
    localStorage.setItem('app-layout-mode', mode);
  };

  const setPageAnimation = (animation: PageAnimation) => {
    pageAnimation.value = animation;
    localStorage.setItem('app-page-animation', animation);
  };

  const setGrayMode = (enabled: boolean) => {
    grayMode.value = enabled;
    document.documentElement.classList.toggle('gray-mode', enabled);
    localStorage.setItem('app-gray-mode', enabled.toString());
  };

  const setRememberTabState = (enabled: boolean) => {
    rememberTabState.value = enabled;
    localStorage.setItem('app-remember-tab-state', enabled.toString());
  };

  function setMaxTabCount(value: number | string | null): void {
    if (value === null || value === '') return;
    maxTabCount.value = normalizeMaxTabCount(Number(value));
    localStorage.setItem(MAX_TAB_COUNT_STORAGE_KEY, String(maxTabCount.value));
  }

  const setShowLanguageSwitch = (enabled: boolean) => {
    showLanguageSwitch.value = enabled;
    localStorage.setItem('app-show-language-switch', enabled.toString());
  };

  const resetSettings = () => {
    setPrimaryColor('blue');
    setSidebarTheme('dark');
    setLayoutMode('vertical');
    setPageAnimation('slide-left');
    setGrayMode(false);
    setRememberTabState(true);
    setMaxTabCount(DEFAULT_MAX_TAB_COUNT);
    setShowLanguageSwitch(true);
  };

  const initSettings = () => {
    // Restore from localStorage
    const savedPrimaryColor = localStorage.getItem('app-primary-color');
    const savedCustomPrimaryColor = localStorage.getItem('app-custom-primary-color');
    const savedSidebarTheme = localStorage.getItem('app-sidebar-theme') as SidebarTheme;
    const savedLayoutMode = localStorage.getItem('app-layout-mode') as LayoutMode;
    const savedPageAnimation = localStorage.getItem('app-page-animation') as PageAnimation;
    const savedGrayMode = localStorage.getItem('app-gray-mode');
    const savedRememberTabState = localStorage.getItem('app-remember-tab-state');
    const savedShowLanguageSwitch = localStorage.getItem('app-show-language-switch');

    if (savedCustomPrimaryColor) {
      setCustomPrimaryColor(savedCustomPrimaryColor);
    } else if (savedPrimaryColor && isPrimaryColor(savedPrimaryColor)) {
      setPrimaryColor(savedPrimaryColor);
    }
    if (savedSidebarTheme) setSidebarTheme(savedSidebarTheme);
    if (savedLayoutMode) setLayoutMode(savedLayoutMode);
    if (savedPageAnimation && PAGE_ANIMATION_VALUES.has(savedPageAnimation)) {
      setPageAnimation(savedPageAnimation);
    }
    if (savedGrayMode) setGrayMode(savedGrayMode === 'true');
    rememberTabState.value = savedRememberTabState !== 'false';
    maxTabCount.value = readMaxTabCount();
    if (savedShowLanguageSwitch !== null) {
      showLanguageSwitch.value = savedShowLanguageSwitch !== 'false';
    }
  };

  return {
    // State
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
    // Actions
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
