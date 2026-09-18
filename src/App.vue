<template>
  <StyleProvider layer>
    <a-config-provider
      :theme="antdThemeConfig"
      :input="inputConfig"
      :select="selectConfig"
      :date-picker="datePickerConfig"
      :range-picker="datePickerConfig"
      :button="buttonConfig"
      :locale="antdLocale"
    >
      <a-app>
        <router-view />
        <a-modal
          :open="authStore.sessionChanged"
          :title="t('login.sessionChangedTitle')"
          :closable="false"
          :mask-closable="false"
          :keyboard="false"
        >
          <p>{{ t('login.sessionChangedMessage') }}</p>
          <template #footer>
            <a-button type="primary" @click="reloadSession">{{ t('common.refresh') }}</a-button>
          </template>
        </a-modal>
      </a-app>
    </a-config-provider>
  </StyleProvider>
</template>

<script setup lang="ts">
import {
  App as AntApp,
  ConfigProvider,
  StyleProvider,
  theme as antdTheme,
  type ThemeConfig,
} from 'antdv-next';
import enUS from 'antdv-next/dist/locale/en_US';
import zhCN from 'antdv-next/dist/locale/zh_CN';
import { computed, h, onMounted, onUnmounted, watch, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';

import { applyLocalePreference } from './locales';
import { appDefaultSettings } from './settings';
import { useAuthStore } from './stores/auth';
import { useNotificationStore } from './stores/notification';
import { usePreferencesStore } from './stores/preferences';
import { useSettingsStore } from './stores/settings';
import { useThemeStore } from './stores/theme';
import { useWatermarkStore } from './stores/watermark';

const preferenceStore = usePreferencesStore();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const settingsStore = useSettingsStore();
const watermarkStore = useWatermarkStore();
const notificationStore = useNotificationStore();
const { locale, t } = useI18n();

const antdLocaleMap = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

const antdThemeConfig = computed<ThemeConfig>(() => ({
  algorithm: themeStore.isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: settingsStore.primaryColorHex,
    colorLink: settingsStore.primaryColorHex,
  },
}));

const inputConfig = computed(() => appDefaultSettings.input);
const selectConfig = computed(
  () => appDefaultSettings.select as unknown as Record<string, unknown>,
);
const datePickerConfig = computed(
  () => appDefaultSettings.datePicker as unknown as Record<string, unknown>,
);
const buttonConfig = computed(() => appDefaultSettings.button);
const antdLocale = computed(() => {
  return antdLocaleMap[locale.value as keyof typeof antdLocaleMap] ?? zhCN;
});

watchEffect(() => {
  const currentTheme = antdThemeConfig.value;
  const currentLocale = antdLocale.value;

  ConfigProvider.config({
    holderRender: (children) =>
      h(StyleProvider, { layer: true }, () =>
        h(
          ConfigProvider,
          {
            locale: currentLocale,
            theme: currentTheme,
          },
          () => h(AntApp, null, () => children),
        ),
      ),
  });
});

if (appDefaultSettings.features.notifications) notificationStore.initNotifications();

watch(
  () => preferenceStore.preferences.locale,
  async (value) => {
    try {
      await applyLocalePreference(value);
    } catch (error) {
      console.error('Failed to apply preferred language:', error);
    }
  },
);

/** 重新加载整页，重新恢复身份并清除旧账号的页面和路由状态。@returns 无返回值。 */
function reloadSession(): void {
  window.location.reload();
}

/** 初始化页面偏好并监听共享凭据变化及标签页重新激活。@returns 无返回值。 */
onMounted(() => {
  // Initialize theme and settings from localStorage
  themeStore.initTheme();
  settingsStore.initSettings();
  watermarkStore.initWatermark();
  window.addEventListener('focus', authStore.checkSession);
  window.addEventListener('storage', authStore.checkSession);
  authStore.checkSession();
});

/** 卸载时移除共享会话监听，避免重复订阅。@returns 无返回值。 */
onUnmounted(() => {
  window.removeEventListener('focus', authStore.checkSession);
  window.removeEventListener('storage', authStore.checkSession);
});
</script>

<style>
#app {
  width: 100%;
  height: 100vh;
  font-family: var(--font-family);
  color: var(--color-text-primary);
  background-color: var(--color-bg-layout);
}
</style>
