import type { Pinia } from 'pinia';

import { createPinia, disposePinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getUserInfo } from '@/api/auth';
import { setupBrowserMock } from '@/mock/browser';
import { useAuthStore } from '@/stores/auth';
import { usePermissionStore } from '@/stores/permission';
import { getStorageKey } from '@/utils/cache';
import { service } from '@/utils/request';

vi.mock('@/router', () => ({ default: { push: vi.fn() } }));
vi.mock('@/utils/session', () => ({ clearSessionState: vi.fn() }));
vi.mock('antdv-next', () => ({ message: { error: vi.fn() } }));

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe('Pinia and Axios auth integration', () => {
  let pinia: Pinia;
  let mock: ReturnType<typeof setupBrowserMock>;

  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    pinia = createPinia();
    setActivePinia(pinia);
    mock = setupBrowserMock(service);
    mock.delayResponse = 0;
  });

  afterEach(() => {
    mock.restore();
    disposePinia(pinia);
    vi.unstubAllGlobals();
  });

  it.each(['admin', 'user'])(
    'logs in as %s and restores persisted roles and permissions',
    async (username) => {
      const auth = useAuthStore();
      await auth.login(username, '123456');

      expect(auth.isLoggedIn).toBe(true);
      expect(auth.user?.username).toBe(username);
      expect(auth.hasRole(username)).toBe(true);
      expect(auth.hasPermission('dashboard.view')).toBe(true);
      expect(auth.hasPermission('system.user.view')).toBe(username === 'admin');
      expect(localStorage.getItem(getStorageKey('access_token'))).toBe(auth.token);

      const permission = usePermissionStore();
      await permission.generateRoutes(auth.userRoles, auth.userPermissions);
      expect(permission.isRoutesGenerated).toBe(true);
      expect(permission.routes.some((route) => route.path === '/system')).toBe(
        username === 'admin',
      );

      disposePinia(pinia);
      pinia = createPinia();
      setActivePinia(pinia);
      const restored = useAuthStore();
      restored.initAuth();
      expect(restored.isLoggedIn).toBe(true);
      expect(restored.user?.username).toBe(username);
      expect(restored.hasPermission('system.user.view')).toBe(username === 'admin');

      restored.logout();
      expect(restored.isLoggedIn).toBe(false);
      expect(restored.userPermissions).toEqual([]);
      expect(localStorage.getItem(getStorageKey('access_token'))).toBeNull();
      expect(localStorage.getItem(getStorageKey('refresh_token'))).toBeNull();
      expect(localStorage.getItem(getStorageKey('user_info'))).toBeNull();
    },
  );

  it('refreshes the token with the real auth store and API helpers', async () => {
    const auth = useAuthStore();
    await auth.login('admin', '123456');
    const token = await auth.refreshToken();

    expect(token).toBe(auth.token);
    expect(mock.history.post.filter((entry) => entry.url === '/auth/refresh')).toHaveLength(1);
    expect(auth.isLoggedIn).toBe(true);
    expect(localStorage.getItem(getStorageKey('access_token'))).toBe(auth.token);
    expect((await getUserInfo()).data.username).toBe('admin');
  });

  it('replaces admin permissions when switching to the regular user', async () => {
    const auth = useAuthStore();
    await auth.login('admin', '123456');
    await auth.login('user', '123456');

    expect(auth.user?.username).toBe('user');
    expect(auth.hasRole('admin')).toBe(false);
    expect(auth.hasPermission('system.user.view')).toBe(false);
    expect(auth.userPermissions).toEqual(['dashboard.view']);
  });

  it('does not create a session for invalid credentials', async () => {
    const auth = useAuthStore();
    await expect(auth.login('admin', 'incorrect')).rejects.toThrow('Invalid username or password');
    expect(auth.isLoggedIn).toBe(false);
    expect(localStorage.getItem(getStorageKey('access_token'))).toBeNull();
  });

  it('does not restore or delete legacy unscoped login data', () => {
    localStorage.setItem('access_token', 'legacy-token');
    localStorage.setItem('user_info', JSON.stringify({ username: 'old-project' }));
    const auth = useAuthStore();
    auth.initAuth();
    expect(auth.token).toBeNull();
    expect(auth.user).toBeNull();
    auth.logout();
    expect(localStorage.getItem('access_token')).toBe('legacy-token');
  });
});
