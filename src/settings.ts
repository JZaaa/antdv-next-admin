import type { AuthSettings } from './types/auth.ts';
import type { AppFeatures, UserPreferences } from './types/preferences.ts';

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
  auth: AuthSettings;
  features: AppFeatures;
  updateCheck: {
    enabled: boolean;
    intervalMinutes: number;
  };
  preferences: UserPreferences;
  layout: {
    sidebarWidth: number;
    collapsedWidth: number;
  };
  input: InputDefaultSettings;
  select: SelectDefaultSettings;
  datePicker: DatePickerDefaultSettings;
  button: ButtonDefaultSettings;
}

export const appDefaultSettings: AppDefaultSettings = {
  // 认证协议与登录策略只读取源码配置，不写入 localStorage/sessionStorage 或用户偏好。
  auth: {
    enableRefreshToken: true,
    // 开启时显示记住登录复选框；关闭时固定使用 rememberLogin。
    enableRememberLogin: true,
    // true 使用 localStorage，false 使用当前标签页的 sessionStorage。
    rememberLogin: false,
    tokenField: 'token',
    refreshTokenField: 'refreshToken',
    expiresInField: 'expiresIn',
    refreshTokenRequestField: 'refreshToken',
    refreshUrl: '/auth/refresh',
    headerName: 'Authorization',
    tokenPrefix: 'Bearer',
  },
  // System switches are code-only. Cache and the preferences drawer cannot override them.
  features: {
    // 页面 Logo 图片显隐，仅由源码控制。
    logo: true,
    personalization: true,
    // false 隐藏偏好设置中的“页面与标签”分组，true 显示。
    pagePreferences: true,
    search: true,
    notifications: true,
    fullscreen: true,
    themeSwitch: true,
    languageSwitch: true,
    aiChat: true,
    tabs: true,
    breadcrumb: true,
  },
  updateCheck: {
    enabled: true,
    intervalMinutes: 5,
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
