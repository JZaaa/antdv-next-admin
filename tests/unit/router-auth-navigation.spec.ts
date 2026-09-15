import type { AppRouteRecordRaw } from '@/types/router';
import type { RouteRecordRaw } from 'vue-router';

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

import { resetRouter, setupRouterGuards } from '@/router/guards';
import { basicRoutes, notFoundRoute, staticRoutes } from '@/router/routes';
import { usePermissionStore } from '@/stores/permission';

const auth = vi.hoisted(() => ({
  token: null as string | null,
  user: {},
  userRoles: [] as string[],
  userPermissions: [] as string[],
  hasAnyPermission: (permissions: string[]): boolean =>
    auth.userPermissions.includes('*') ||
    permissions.some((value) => auth.userPermissions.includes(value)),
  hasAnyRole: (roles: string[]): boolean => roles.some((value) => auth.userRoles.includes(value)),
}));

vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }));
vi.mock('@/stores/dict', () => ({ useDictStore: () => ({ loadDictData: vi.fn() }) }));
vi.mock('@/stores/tabs', () => ({
  useTabsStore: () => ({
    tabs: [],
    restoreTabsState: vi.fn(),
    initAffixTabs: vi.fn(),
    addTab: vi.fn(),
    setActiveTab: vi.fn(),
  }),
}));
vi.mock('@/utils/i18n', () => ({ resolveLocaleText: (key: string) => key }));
vi.mock('@/router/routes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/router/routes')>();
  // Use the real route definitions and permission filtering without mounting page components.
  function stubPages(routes: AppRouteRecordRaw[]): AppRouteRecordRaw[] {
    return routes.map((route) => ({
      ...route,
      component: { render: () => null },
      children: route.children ? stubPages(route.children) : undefined,
    }));
  }
  return {
    staticRoutes: stubPages(actual.staticRoutes),
    basicRoutes: stubPages(actual.basicRoutes),
    asyncRoutes: stubPages(actual.asyncRoutes),
    notFoundRoute: stubPages([actual.notFoundRoute])[0],
  };
});

function createTestRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [...staticRoutes, ...basicRoutes, notFoundRoute] as RouteRecordRaw[],
  });
  setupRouterGuards(router);
  return router;
}

beforeEach(() => {
  setActivePinia(createPinia());
  auth.token = null;
  auth.userRoles = [];
  auth.userPermissions = [];
  vi.stubGlobal('document', { title: '' });
  vi.stubGlobal('window', { scrollTo: vi.fn() });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
});

afterEach(() => vi.unstubAllGlobals());

describe('authentication before route resolution', () => {
  it.each(['/dashboard', '/organization/user?status=enabled#list', '/examples/form', '/missing'])(
    'redirects an anonymous visit to %s to login with the original URL',
    async (target) => {
      const router = createTestRouter();
      await router.push(target);
      expect(router.currentRoute.value.name).toBe('Login');
      expect(router.currentRoute.value.query.redirect).toBe(target);
      expect(usePermissionStore().isRoutesGenerated).toBe(false);
    },
  );

  it.each(['/login', '/403', '/404', '/500'])(
    'keeps the public page %s accessible',
    async (path) => {
      const router = createTestRouter();
      await router.push(path);
      expect(router.currentRoute.value.path).toBe(path);
    },
  );

  it.each(['admin', 'user'])(
    'recovers the requested dynamic page after %s logs in',
    async (role) => {
      const router = createTestRouter();
      const target = '/examples/form?mode=edit#details';
      await router.push(target);
      auth.token = 'test-token';
      auth.userRoles = [role];
      auth.userPermissions = role === 'admin' ? ['*'] : [];
      await router.replace(String(router.currentRoute.value.query.redirect));
      expect(router.currentRoute.value.name).toBe('ExamplesForm');
      expect(router.currentRoute.value.fullPath).toBe(target);

      auth.token = null;
      usePermissionStore().resetPermission();
      resetRouter(router);
      await router.push('/examples/complex-form');
      expect(router.currentRoute.value.name).toBe('Login');
      expect(router.currentRoute.value.query.redirect).toBe('/examples/complex-form');
    },
  );

  it('shows 404 for a genuinely unknown URL after authenticated routes have been generated', async () => {
    auth.token = 'test-token';
    auth.userPermissions = ['*'];
    const router = createTestRouter();
    await router.push('/missing?from=bookmark#details');
    expect(router.currentRoute.value.name).toBe('NotFoundCatchAll');
    expect(router.currentRoute.value.fullPath).toBe('/missing?from=bookmark#details');
    expect(usePermissionStore().isRoutesGenerated).toBe(true);
  });
});
