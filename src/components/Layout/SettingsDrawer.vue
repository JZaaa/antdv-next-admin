<template>
  <a-drawer
    v-if="settingsStore.features.personalization"
    v-model:open="visible"
    :title="$t('settings.title')"
    placement="right"
    size="min(400px, 100vw)"
    :styles="{
      body: { padding: '20px', background: 'var(--color-bg-layout)' },
      footer: { padding: '16px 20px' },
    }"
  >
    <div class="settings-drawer">
      <p class="settings-intro">{{ $t('settings.description') }}</p>

      <section class="settings-section" aria-labelledby="appearance-heading">
        <h3 id="appearance-heading" class="section-title">
          <BgColorsOutlined aria-hidden="true" />
          {{ $t('settings.appearance') }}
        </h3>
        <div class="settings-card">
          <div class="setting-block">
            <div class="setting-heading">
              <h4 id="theme-color-label">{{ $t('settings.themeColor') }}</h4>
              <span class="color-value">{{ settingsStore.primaryColorHex.toUpperCase() }}</span>
            </div>
            <div class="color-picker" role="group" aria-labelledby="theme-color-label">
              <a-tooltip
                v-for="color in PRESET_COLORS"
                :key="color.value"
                :title="$t('settings.colors.' + color.value)"
              >
                <button
                  type="button"
                  class="color-item"
                  :class="{
                    active:
                      settingsStore.primaryColor === color.value &&
                      !settingsStore.customPrimaryColor,
                  }"
                  :style="{ '--swatch-color': color.hex }"
                  :aria-label="$t('settings.colors.' + color.value)"
                  :aria-pressed="
                    settingsStore.primaryColor === color.value && !settingsStore.customPrimaryColor
                  "
                  @click="settingsStore.setPrimaryColor(color.value)"
                >
                  <CheckOutlined
                    v-if="
                      settingsStore.primaryColor === color.value &&
                      !settingsStore.customPrimaryColor
                    "
                  />
                </button>
              </a-tooltip>
              <a-color-picker
                v-model:value="customColor"
                :presets="colorPresets"
                @change="handleCustomColorChange"
              >
                <button
                  type="button"
                  class="color-item color-picker-trigger"
                  :class="{ active: !!settingsStore.customPrimaryColor }"
                  :style="
                    settingsStore.customPrimaryColor
                      ? { '--swatch-color': settingsStore.customPrimaryColor }
                      : undefined
                  "
                  :aria-label="$t('settings.customColor')"
                  :title="$t('settings.customColor')"
                  :aria-pressed="!!settingsStore.customPrimaryColor"
                >
                  <CheckOutlined v-if="settingsStore.customPrimaryColor" />
                  <PlusOutlined v-else />
                </button>
              </a-color-picker>
            </div>
          </div>
          <div class="setting-row">
            <h4 id="sidebar-theme-label">{{ $t('settings.sidebarTheme') }}</h4>
            <a-radio-group
              :value="settingsStore.sidebarTheme"
              @change="settingsStore.setSidebarTheme($event.target.value)"
              class="theme-options"
              option-type="button"
              button-style="solid"
              aria-labelledby="sidebar-theme-label"
            >
              <a-radio-button value="light">{{ $t('settings.light') }}</a-radio-button>
              <a-radio-button value="dark">{{ $t('settings.dark') }}</a-radio-button>
            </a-radio-group>
          </div>
          <div class="setting-block">
            <h4 id="layout-mode-label">{{ $t('settings.layoutMode') }}</h4>
            <div class="layout-options" role="group" aria-labelledby="layout-mode-label">
              <button
                v-for="mode in LAYOUT_MODES"
                :key="mode"
                type="button"
                class="layout-option"
                :class="{ active: settingsStore.layoutMode === mode }"
                :aria-pressed="settingsStore.layoutMode === mode"
                @click="settingsStore.setLayoutMode(mode)"
              >
                <span class="layout-preview" :class="'layout-preview--' + mode" aria-hidden="true">
                  <span
                    class="preview-sidebar"
                    :class="{ 'preview-sidebar--dark': settingsStore.sidebarTheme === 'dark' }"
                  ></span>
                  <span class="preview-header"></span>
                  <span class="preview-content"><span></span><span></span></span>
                </span>
                <span class="layout-caption">
                  {{ $t('settings.' + mode) }}
                  <CheckOutlined class="layout-check" aria-hidden="true" />
                </span>
              </button>
            </div>
          </div>
          <div class="setting-row">
            <div class="setting-copy">
              <h4 id="gray-mode-label">{{ $t('settings.grayMode') }}</h4>
              <p id="gray-mode-hint" class="hint">{{ $t('settings.grayModeHint') }}</p>
            </div>
            <a-switch
              :checked="settingsStore.grayMode"
              @change="settingsStore.setGrayMode"
              aria-labelledby="gray-mode-label"
              aria-describedby="gray-mode-hint"
            />
          </div>
        </div>
      </section>

      <section class="settings-section" aria-labelledby="page-heading">
        <h3 id="page-heading" class="section-title">
          <AppstoreOutlined aria-hidden="true" />{{ $t('settings.pagePreferences') }}
        </h3>
        <div class="settings-card">
          <div class="setting-block">
            <h4 id="page-animation-label">{{ $t('settings.pageAnimation') }}</h4>
            <div class="animation-select">
              <a-select
                :value="settingsStore.pageAnimation"
                @change="settingsStore.setPageAnimation"
                :options="pageAnimationOptions"
                style="width: 100%"
                aria-labelledby="page-animation-label"
              />
            </div>
          </div>
          <div class="setting-row">
            <div class="setting-copy">
              <h4 id="remember-tabs-label">{{ $t('settings.rememberTabState') }}</h4>
              <p id="remember-tabs-hint" class="hint">{{ $t('settings.rememberTabStateHint') }}</p>
            </div>
            <a-switch
              :checked="settingsStore.rememberTabState"
              @change="settingsStore.setRememberTabState"
              aria-labelledby="remember-tabs-label"
              aria-describedby="remember-tabs-hint"
            />
          </div>
          <div class="setting-block">
            <div class="setting-heading">
              <h4 id="max-tab-count-label">{{ $t('settings.maxTabCount') }}</h4>
              <a-input-number
                :value="settingsStore.maxTabCount"
                :min="1"
                :max="MAX_TAB_COUNT"
                :precision="0"
                class="tab-count-input"
                aria-labelledby="max-tab-count-label"
                aria-describedby="max-tab-count-hint"
                @change="settingsStore.setMaxTabCount"
              />
            </div>
            <p id="max-tab-count-hint" class="hint">
              {{
                $t('settings.maxTabCountHint', {
                  defaultCount: appDefaultSettings.preferences.maxTabCount,
                })
              }}
            </p>
          </div>
        </div>
      </section>

      <section
        v-if="settingsStore.features.aiChat || settingsStore.features.languageSwitch"
        class="settings-section"
        aria-labelledby="toolbar-heading"
      >
        <h3 id="toolbar-heading" class="section-title">
          <ControlOutlined aria-hidden="true" />{{ $t('settings.toolbar') }}
        </h3>
        <div class="settings-card">
          <div
            v-if="settingsStore.features.aiChat"
            class="setting-row"
            :class="{ 'setting-row--disabled': layoutStore.isMobile }"
          >
            <div class="setting-copy">
              <h4 id="ai-collab-label">{{ $t('settings.aiCollab') }}</h4>
              <p id="ai-collab-hint" class="hint">
                {{
                  layoutStore.isMobile
                    ? $t('settings.aiCollabHintMobile')
                    : $t('settings.aiCollabHint')
                }}
              </p>
            </div>
            <a-switch
              :checked="layoutStore.aiEntryVisible"
              :disabled="layoutStore.isMobile"
              aria-labelledby="ai-collab-label"
              aria-describedby="ai-collab-hint"
              @change="handleAiEntryChange"
            />
          </div>
          <div v-if="settingsStore.features.languageSwitch" class="setting-row">
            <div class="setting-copy">
              <h4 id="language-switch-label">{{ $t('settings.languageSwitch') }}</h4>
              <p id="language-switch-hint" class="hint">{{ $t('settings.languageSwitchHint') }}</p>
            </div>
            <a-switch
              :checked="settingsStore.showLanguageSwitch"
              aria-labelledby="language-switch-label"
              aria-describedby="language-switch-hint"
              @change="handleLanguageSwitchChange"
            />
          </div>
        </div>
      </section>
    </div>
    <template #footer>
      <a-button block class="settings-reset" @click="handleReset">
        <template #icon><ReloadOutlined /></template>
        {{ $t('settings.reset') }}
      </a-button>
    </template>
  </a-drawer>
</template>

<script setup lang="ts">
import type { PrimaryColor } from '@/types/layout';

import {
  AppstoreOutlined,
  BgColorsOutlined,
  CheckOutlined,
  ControlOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@antdv-next/icons';
import { App } from 'antdv-next';
import { computed, ref, watch } from 'vue';

import { $t } from '@/locales';
import { appDefaultSettings } from '@/settings';
import { useLayoutStore } from '@/stores/layout';
import { MAX_TAB_COUNT, useSettingsStore } from '@/stores/settings';

const visible = defineModel<boolean>('open', { default: false });
const settingsStore = useSettingsStore();
const layoutStore = useLayoutStore();
const { modal } = App.useApp();
const customColor = ref(settingsStore.primaryColorHex);

const PRESET_COLORS: Array<{ value: PrimaryColor; hex: string }> = [
  { value: 'blue', hex: '#1890ff' },
  { value: 'green', hex: '#52c41a' },
  { value: 'purple', hex: '#722ed1' },
  { value: 'red', hex: '#f5222d' },
  { value: 'orange', hex: '#fa8c16' },
  { value: 'cyan', hex: '#13c2c2' },
];

const LAYOUT_MODES = ['vertical', 'horizontal'] as const;

const colorPresets = computed(() => [
  {
    label: $t('settings.themeColor'),
    colors: PRESET_COLORS.map((c) => c.hex),
  },
]);

const pageAnimationOptions = computed(() => [
  { label: $t('settings.fade'), value: 'fade' },
  { label: $t('settings.slideLeft'), value: 'slide-left' },
  { label: $t('settings.slideRight'), value: 'slide-right' },
  { label: $t('settings.slideUp'), value: 'slide-up' },
  { label: $t('settings.slideDown'), value: 'slide-down' },
  { label: $t('settings.zoom'), value: 'zoom' },
  { label: $t('settings.zoomBig'), value: 'zoom-big' },
  { label: $t('settings.none'), value: 'none' },
]);

const handleCustomColorChange = (value: string | { toHexString: () => string }) => {
  const hex = typeof value === 'string' ? value : value.toHexString();
  settingsStore.setCustomPrimaryColor(hex);
};

watch(
  () => settingsStore.primaryColorHex,
  (value) => {
    customColor.value = value;
  },
);

const handleReset = () => {
  modal.confirm({
    title: $t('settings.confirmReset'),
    onOk: () => {
      settingsStore.resetSettings();
      customColor.value = settingsStore.primaryColorHex;
    },
  });
};

const handleAiEntryChange = (checked: boolean) => {
  layoutStore.setAiEntryVisible(checked);
};

const handleLanguageSwitchChange = (checked: boolean) => {
  settingsStore.setShowLanguageSwitch(checked);
};
</script>

<style scoped lang="scss">
.settings-drawer {
  color: var(--color-text-primary);

  h3,
  h4,
  p {
    margin: 0;
  }

  h4 {
    font-size: 13px;
    font-weight: var(--font-weight-medium);
    line-height: 1.6;
  }

  .settings-intro {
    margin-bottom: 24px;
    color: var(--color-text-tertiary);
    font-size: 12px;
    line-height: 1.7;
  }
}

.settings-section + .settings-section {
  margin-top: 24px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 2px 10px;
  font-size: 13px;
  font-weight: var(--font-weight-semibold);

  .anticon {
    color: var(--color-text-tertiary);
    font-size: 15px;
  }
}

.settings-card {
  padding: 0 16px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 12px;
  background: var(--color-bg-container);
}

.setting-block,
.setting-row {
  padding: 16px 0;

  & + &,
  & + .setting-block,
  & + .setting-row {
    border-top: 1px solid var(--color-border-secondary);
  }
}

.setting-row,
.setting-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.setting-copy {
  min-width: 0;
}

.setting-row > :deep(.ant-switch) {
  flex-shrink: 0;
}

.setting-row--disabled h4 {
  color: var(--color-text-tertiary);
}

.settings-drawer .hint {
  margin-top: 5px;
  color: var(--color-text-tertiary);
  font-size: 12px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.color-value {
  color: var(--color-text-tertiary);
  font-family: var(--font-family-code);
  font-size: 11px;
}

.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.color-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 3px solid var(--color-bg-container);
  border-radius: 50%;
  background: var(--swatch-color);
  color: #fff;
  box-shadow: 0 0 0 1px var(--color-border-secondary);
  cursor: pointer;
  transition:
    transform var(--duration-base),
    box-shadow var(--duration-base);

  &:hover {
    transform: translateY(-2px);
  }

  &.active {
    box-shadow: 0 0 0 2px var(--swatch-color);
  }

  .anticon {
    font-size: 13px;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
  }
}

.color-picker-trigger {
  background: var(
    --swatch-color,
    conic-gradient(#1890ff, #722ed1, #f5222d, #fa8c16, #52c41a, #13c2c2, #1890ff)
  );
}

.color-item:focus-visible,
.layout-option:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 4px;
}

.theme-options {
  display: flex;
  flex-shrink: 0;

  :deep(.ant-radio-button-wrapper) {
    padding-inline: 12px;
    font-size: 12px;
  }
}

.layout-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.layout-option {
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 8px;
  background: var(--color-bg-container);
  color: var(--color-text-secondary);
  font: inherit;
  cursor: pointer;
  transition:
    border-color var(--duration-base),
    background-color var(--duration-base);

  &:hover {
    border-color: var(--color-primary);
  }

  &.active {
    border-color: var(--color-primary);
    background: var(--color-primary-bg-hover);
    color: var(--color-primary);

    .layout-check {
      visibility: visible;
    }
  }
}

.layout-preview {
  display: grid;
  height: 64px;
  gap: 4px;
  padding: 5px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 5px;
  background: var(--color-bg-layout);
  grid-template-columns: 24px 1fr;
  grid-template-rows: 10px 1fr;
}

.preview-sidebar {
  grid-row: 1 / 3;
  border-radius: 2px;
  border: 1px solid var(--color-border);
  background: #fff;

  &--dark {
    border-color: #25334a;
    background: #25334a;
  }
}

.preview-header {
  border-radius: 2px;
  background: var(--color-primary);
  opacity: 0.6;
}

.preview-content {
  display: flex;
  gap: 4px;
  padding: 5px;
  border-radius: 2px;
  background: var(--color-bg-container);

  > span {
    flex: 1;
    border-radius: 2px;
    background: var(--color-border-secondary);
  }
}

.layout-preview--horizontal {
  grid-template-columns: 1fr;

  .preview-sidebar {
    display: none;
  }
}

.layout-caption {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
}

.layout-check {
  visibility: hidden;
  font-size: 11px;
}

.animation-select {
  width: 100%;
  margin-top: 12px;
}

.tab-count-input {
  flex: 0 0 80px;
  width: 80px;
}

.settings-reset {
  height: 36px;
}

@media (max-width: 359px) {
  .settings-card {
    padding-inline: 12px;
  }

  .setting-row,
  .setting-heading {
    gap: 10px;
  }

  .color-picker {
    gap: 8px;
  }

  .color-item {
    width: 28px;
    height: 28px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .color-item,
  .layout-option {
    transition: none;
  }
}
</style>
