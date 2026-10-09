import type { Permission } from '@/types/auth';

/** VXE virtual trees need flat rows; leave the API tree intact for parent labels. */
export function flattenPermissions(tree: Permission[], parentId?: string): Permission[] {
  return tree.flatMap(({ children, ...row }) => [
    { ...row, parentId: parentId ?? row.parentId },
    ...flattenPermissions(children ?? [], row.id),
  ]);
}
