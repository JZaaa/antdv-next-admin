import type { AppRouteRecordRaw, MenuItem } from '@/types/router';
import type { RouteRecordRaw } from 'vue-router';

import { defineStore } from 'pinia';
import { ref } from 'vue';

import { basicRoutes, asyncRoutes } from '@/router/routes';
import { filterRoutesByPermission, filterRoutesByRole, routesToMenuTree } from '@/router/utils';

/**
 * 复制路由配置并保留 meta getter，避免显式翻译在权限过滤时被冻结。
 * @param routes 待复制的路由树。
 * @returns 独立的路由树，保留动态标题的属性描述符。
 */
function cloneRoutes(routes: AppRouteRecordRaw[]): AppRouteRecordRaw[] {
  return routes.map((route) => ({
    ...route,
    meta: route.meta
      ? Object.defineProperties({ title: '' }, Object.getOwnPropertyDescriptors(route.meta))
      : undefined,
    children: route.children ? cloneRoutes(route.children) : undefined,
  }));
}

export const usePermissionStore = defineStore('permission', () => {
  // State
  const routes = ref<RouteRecordRaw[]>([]);
  const menuTree = ref<MenuItem[]>([]);
  const isRoutesGenerated = ref(false);

  // Actions
  const generateRoutes = async (
    roles: string[],
    permissions: string[],
  ): Promise<RouteRecordRaw[]> => {
    const clonedAsyncRoutes = cloneRoutes(asyncRoutes);
    const clonedBasicChildren = cloneRoutes(basicRoutes.flatMap((route) => route.children || []));

    let accessedRoutes = filterRoutesByPermission(clonedAsyncRoutes, permissions);
    accessedRoutes = filterRoutesByRole(accessedRoutes, roles);

    routes.value = accessedRoutes as unknown as RouteRecordRaw[];
    menuTree.value = routesToMenuTree([...clonedBasicChildren, ...accessedRoutes]);
    isRoutesGenerated.value = true;

    return routes.value;
  };

  const getAccessibleMenus = (permissions: string[]): MenuItem[] => {
    const hasAllPermission = permissions.includes('*');

    // Filter menu tree based on permissions
    const filterMenu = (menus: MenuItem[]): MenuItem[] => {
      return menus
        .filter((menu) => {
          if (hasAllPermission) {
            return true;
          }

          if (!menu.requiredPermissions || menu.requiredPermissions.length === 0) {
            return true;
          }
          return menu.requiredPermissions.some((perm) => permissions.includes(perm));
        })
        .map((menu) => {
          if (menu.children) {
            return {
              ...menu,
              children: filterMenu(menu.children),
            };
          }
          return menu;
        });
    };

    return filterMenu(menuTree.value);
  };

  const setRoutes = (newRoutes: RouteRecordRaw[]) => {
    routes.value = newRoutes;
  };

  const setMenuTree = (newMenuTree: MenuItem[]) => {
    menuTree.value = newMenuTree;
  };

  const resetPermission = () => {
    routes.value = [];
    menuTree.value = [];
    isRoutesGenerated.value = false;
  };

  return {
    // State
    routes,
    menuTree,
    isRoutesGenerated,
    // Actions
    generateRoutes,
    getAccessibleMenus,
    setRoutes,
    setMenuTree,
    resetPermission,
  };
});
