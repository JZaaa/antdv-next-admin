import type { AppFeatures, UserPreferences } from './types/preferences.ts';
import type { ProTableSearch } from './types/pro.ts';

export type ProTableDensity = 'large' | 'middle' | 'small' | 'smal';
export type ProTableHeight = '100%' | 'auto' | string | number;

export interface ProTableSearchDefaultSettings {
  columnsPerRow: NonNullable<ProTableSearch['columnsPerRow']>;
}

export interface ProTableDefaultSettings {
  size: ProTableDensity;
  height: ProTableHeight;
  resizable: boolean;
  columnResizable: boolean;
  ellipsis: boolean;
  bordered: boolean;
  fixedHeader: boolean;
  search: ProTableSearchDefaultSettings;
}

export interface InputDefaultSettings {
  allowClear: boolean;
}

export interface SelectDefaultSettings {
  allowClear: boolean;
}

export interface DatePickerDefaultSettings {
  allowClear: boolean;
}

export interface ButtonDefaultSettings {
  size: 'large' | 'middle' | 'small';
}

export interface AppDefaultSettings {
  features: AppFeatures;
  preferences: UserPreferences;
  layout: {
    sidebarWidth: number;
    collapsedWidth: number;
  };
  proTable: ProTableDefaultSettings;
  input: InputDefaultSettings;
  select: SelectDefaultSettings;
  datePicker: DatePickerDefaultSettings;
  button: ButtonDefaultSettings;
}

export const appDefaultSettings: AppDefaultSettings = {
  // System switches are code-only. Cache and the preferences drawer cannot override them.
  features: {
    personalization: true,
    search: true,
    notifications: true,
    fullscreen: true,
    themeSwitch: true,
    languageSwitch: true,
    aiChat: true,
    tabs: true,
    breadcrumb: true,
  },
  // Defaults are merged with validated user overrides in the current cache namespace.
  preferences: {
    primaryColor: 'blue',
    customPrimaryColor: '',
    sidebarTheme: 'light',
    layoutMode: 'vertical',
    pageAnimation: 'slide-left',
    grayMode: false,
    rememberTabState: true,
    maxTabCount: 10,
    showLanguageSwitch: true,
    themeMode: 'system',
    locale: 'zh-CN',
    sidebarCollapsed: false,
    aiEntryVisible: true,
    aiCollabEnabled: false,
    aiPanelWidth: 420,
  },
  layout: {
    sidebarWidth: 240,
    collapsedWidth: 80,
  },
  proTable: {
    size: 'smal',
    height: 'auto',
    resizable: true,
    columnResizable: true,
    ellipsis: true,
    bordered: true,
    fixedHeader: true,
    search: {
      columnsPerRow: {
        xs: 1,
        sm: 2,
        md: 2,
        lg: 3,
        xl: 3,
      },
    },
  },
  input: {
    allowClear: true,
  },
  select: {
    allowClear: true,
  },
  datePicker: {
    allowClear: true,
  },
  button: {
    size: 'middle',
  },
};
