/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const APP_DEPENDENCY_VERSIONS: Readonly<Record<string, string>>;

declare module 'virtual:local-icon-assets' {
  export const localIconAssets: Partial<Record<'ri' | 'mdi' | 'ion', readonly (string | null)[]>>;
  export const localIconAliases: Partial<Record<'ri' | 'mdi' | 'ion', Record<string, string>>>;
  export const iconBuildSettings: {
    collections: Record<'ri' | 'mdi' | 'ion', 'off' | 'used' | 'all'>;
    antd: 'off' | 'used' | 'all';
    safelist: readonly string[];
    online: boolean;
  };
  export const antdIconNames: readonly string[];
  export const antdIconGroups: readonly (() => Promise<{
    default: Record<string, import('vue').Component>;
  }>)[];
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, unknown>;
  export default component;
}

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly VITE_APP_NAMESPACE: string;
  readonly VITE_APP_CACHE_VERSION: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_USE_MOCK: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
