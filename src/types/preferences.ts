import type { LayoutMode, PageAnimation, PrimaryColor, SidebarTheme, ThemeMode } from './layout';

/** User-adjustable values. System feature switches deliberately live outside this type. */
export interface UserPreferences {
  primaryColor: PrimaryColor;
  customPrimaryColor: string;
  sidebarTheme: SidebarTheme;
  layoutMode: LayoutMode;
  pageAnimation: PageAnimation;
  grayMode: boolean;
  rememberTabState: boolean;
  maxTabCount: number;
  showLanguageSwitch: boolean;
  themeMode: ThemeMode;
  locale: 'zh-CN' | 'en-US';
  sidebarCollapsed: boolean;
  aiEntryVisible: boolean;
  aiCollabEnabled: boolean;
  aiPanelWidth: number;
}

/** Deployment policy: only editable in source, never restored from browser storage. */
export interface AppFeatures {
  /** 控制页面 Logo 图片，保留系统名称与浏览器标签页图标。 */
  logo: boolean;
  personalization: boolean;
  search: boolean;
  notifications: boolean;
  fullscreen: boolean;
  themeSwitch: boolean;
  languageSwitch: boolean;
  aiChat: boolean;
  tabs: boolean;
  breadcrumb: boolean;
}
