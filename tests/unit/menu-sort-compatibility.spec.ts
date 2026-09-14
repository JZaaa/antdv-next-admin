import type { AppRouteRecordRaw } from '@/types/router';

import { describe, expect, it } from 'vitest';

import { routesToMenuTree } from '@/router/utils';

describe('menu sorting', () => {
  it('sorts visible parents and children without changing the source arrays', () => {
    const children: AppRouteRecordRaw[] = [
      { path: 'second', meta: { title: 'Second', order: 20 } },
      { path: 'first', meta: { title: 'First', order: 10 } },
    ];
    const routes: AppRouteRecordRaw[] = [
      { path: '/parent', meta: { title: 'Parent', order: 20 }, children },
      { path: '/first', meta: { title: 'First', order: 10 } },
      { path: '/hidden', meta: { title: 'Hidden', hidden: true } },
    ];
    Object.freeze(children);
    Object.freeze(routes);
    const menus = routesToMenuTree(routes);
    expect(menus.map((menu) => menu.path)).toEqual(['/first', '/parent']);
    expect(menus[1].children?.map((menu) => menu.path)).toEqual([
      '/parent/first',
      '/parent/second',
    ]);
    expect(routes[0].path).toBe('/parent');
    expect(children[0].path).toBe('second');
  });
});
