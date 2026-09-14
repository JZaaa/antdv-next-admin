export const ICON_SHARD_COUNT = 32;

// Shared by the build and browser so any icon name resolves without a large name index.
export function getIconShard(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (Math.imul(hash, 31) + name.charCodeAt(index)) >>> 0;
  }
  return hash % ICON_SHARD_COUNT;
}
