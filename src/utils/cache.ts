import pkg from '../../package.json';
import { createStorageNamespace, NamespacedStorage } from './storageNamespace';

export const STORAGE_NAMESPACE = createStorageNamespace({
  project: import.meta.env.VITE_APP_NAMESPACE || pkg.name,
  mode: import.meta.env.MODE,
  appVersion: pkg.version,
  cacheVersion: import.meta.env.VITE_APP_CACHE_VERSION || '1',
});

/** For third-party storage adapters. Do not prefix keys passed to appLocalStorage again. */
export function getStorageKey(key: string): string {
  return STORAGE_NAMESPACE + key;
}

// Resolve lazily: importing a store must not require browser storage to be available.
export const appLocalStorage = new NamespacedStorage(
  () => globalThis.localStorage,
  STORAGE_NAMESPACE,
);
export const appSessionStorage = new NamespacedStorage(
  () => globalThis.sessionStorage,
  STORAGE_NAMESPACE,
);
