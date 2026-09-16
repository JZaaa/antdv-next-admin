import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  appLocalStorage,
  appSessionStorage,
  getStorageKey,
  STORAGE_NAMESPACE,
} from '@/utils/cache';
import { localStorage as jsonStorage, sessionStorage as jsonSessionStorage } from '@/utils/storage';
import { createStorageNamespace, NamespacedStorage } from '@/utils/storageNamespace';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
    clear: () => data.clear(),
  };
}

const base = { project: 'admin', mode: 'production', appVersion: '1.0.0', cacheVersion: '1' };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('project and version storage isolation', () => {
  it.each([
    { project: 'other-admin' },
    { mode: 'demo' },
    { appVersion: '2.0.0' },
    { cacheVersion: '2' },
  ])('isolates identical business keys when %j changes', (change) => {
    const native = memoryStorage();
    const first = new NamespacedStorage(() => native, createStorageNamespace(base));
    const second = new NamespacedStorage(
      () => native,
      createStorageNamespace({ ...base, ...change }),
    );
    first.setItem('access_token', 'first-token');
    expect(second.getItem('access_token')).toBeNull();
    second.setItem('access_token', 'second-token');
    expect(first.getItem('access_token')).toBe('first-token');
    second.removeItem('access_token');
    expect(first.getItem('access_token')).toBe('first-token');
  });

  it('never falls back to unscoped keys or removes another namespace on clear', () => {
    const native = memoryStorage();
    const cache = new NamespacedStorage(() => native, createStorageNamespace(base));
    native.setItem('access_token', 'legacy-token');
    native.setItem('admin:production:2.0.0:1:access_token', 'future-token');
    native.setItem('administrator:production:1.0.0:1:theme', 'dark');
    expect(cache.getItem('access_token')).toBeNull();
    cache.setItem('theme', 'light');
    cache.setItem('tabs', '[]');
    expect(cache.keys()).toEqual(['theme', 'tabs']);
    expect(cache.length).toBe(2);
    expect(cache.key(2)).toBeNull();
    cache.clear();
    expect(cache.keys()).toEqual([]);
    expect(native.length).toBe(3);
    expect(native.getItem('access_token')).toBe('legacy-token');
  });

  it('encodes separators in identifiers and rejects empty namespaces', () => {
    const first = createStorageNamespace({ ...base, project: 'admin:demo' });
    const second = createStorageNamespace({ ...base, project: 'admin', mode: 'demo:production' });
    expect(first).not.toBe(second);
    expect(first).toBe('admin%3Ademo:production:1.0.0:1:');
    expect(() => createStorageNamespace({ ...base, project: ' ' })).toThrow();
    expect(() => new NamespacedStorage(memoryStorage, '')).toThrow();
  });

  it('uses the configured namespace for both browser storage backends', () => {
    const local = memoryStorage();
    const session = memoryStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', session);
    appLocalStorage.setItem('theme-mode', 'dark');
    appSessionStorage.setItem('redirect', '/dashboard');
    expect(local.getItem(getStorageKey('theme-mode'))).toBe('dark');
    expect(local.getItem('theme-mode')).toBeNull();
    expect(session.getItem(STORAGE_NAMESPACE + 'redirect')).toBe('/dashboard');
    appLocalStorage.clear();
    expect(appSessionStorage.getItem('redirect')).toBe('/dashboard');
  });

  it('does not prevent app startup when browser storage access is blocked', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cache = new NamespacedStorage(() => {
      throw new Error('Blocked');
    }, createStorageNamespace(base));
    expect(cache.getItem('theme')).toBeNull();
    expect(cache.keys()).toEqual([]);
    expect(() => cache.setItem('theme', 'dark')).not.toThrow();
    expect(() => cache.removeItem('theme')).not.toThrow();
    expect(() => cache.clear()).not.toThrow();
  });
});

describe('existing JSON and TTL storage facade', () => {
  it('preserves typed values and expires them at the deadline inside the namespace', () => {
    vi.useFakeTimers();
    const native = memoryStorage();
    vi.stubGlobal('localStorage', native);
    jsonStorage.set('draft', { title: 'Draft' }, 2);
    expect(jsonStorage.get('draft')).toEqual({ title: 'Draft' });
    expect(jsonStorage.keys()).toEqual(['draft']);
    vi.advanceTimersByTime(2000);
    expect(jsonStorage.get('draft', 'missing')).toBe('missing');
    expect(native.getItem(getStorageKey('draft'))).toBeNull();
  });

  it('clears only scoped JSON data and keeps local and session storage separate', () => {
    const native = memoryStorage();
    vi.stubGlobal('localStorage', native);
    vi.stubGlobal('sessionStorage', memoryStorage());
    native.setItem('foreign-key', 'preserve');
    jsonStorage.set('draft', 'local');
    jsonSessionStorage.set('draft', 'session');
    jsonStorage.clear();
    expect(native.getItem('foreign-key')).toBe('preserve');
    expect(jsonSessionStorage.get('draft')).toBe('session');
  });
});
