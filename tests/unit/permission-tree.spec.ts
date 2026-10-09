import type { Permission } from '@/types/auth';

import { describe, expect, it } from 'vitest';

import { flattenPermissions } from '@/views/system/permission/tree';

function permission(id: string, extra: Partial<Permission> = {}): Permission {
  return {
    id,
    name: id,
    code: id,
    description: '',
    resource: id,
    action: 'view',
    type: 'menu',
    ...extra,
  };
}

describe('permission virtual tree rows', () => {
  it('preserves nested order and parent relationships without sharing mutable tree rows', () => {
    const tree = [
      permission('root', {
        children: [
          permission('child', {
            children: [permission('button', { type: 'button' })],
          }),
        ],
      }),
      permission('second'),
    ];
    const snapshot = JSON.stringify(tree);
    const rows = flattenPermissions(tree);
    expect(rows.map(({ id, parentId }) => [id, parentId])).toEqual([
      ['root', undefined],
      ['child', 'root'],
      ['button', 'child'],
      ['second', undefined],
    ]);
    expect(rows.every((row) => !('children' in row))).toBe(true);
    // VXE adds child mappings to the flat rows while loading.
    rows[0]!.children = [rows[1]!];
    expect(rows[0]).not.toBe(tree[0]);
    expect(rows[1]).not.toBe(tree[0]!.children![0]);
    expect(JSON.stringify(tree)).toBe(snapshot);
  });

  it('retains a filtered root parent and handles an empty search result', () => {
    expect(
      flattenPermissions([permission('child', { parentId: 'filtered-parent' })])[0]?.parentId,
    ).toBe('filtered-parent');
    expect(flattenPermissions([])).toEqual([]);
  });
});
