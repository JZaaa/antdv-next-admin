import type { IconsJson } from '../src/utils/iconify.ts';

import { getIconShard, ICON_SHARD_COUNT } from '../src/utils/iconShard.ts';

export function getAliasRoots(collection: IconsJson): Record<string, string> {
  const roots: Record<string, string> = {};
  function root(name: string, chain = new Set<string>()): string {
    if (Object.hasOwn(collection.icons, name)) return name;
    if (Object.hasOwn(roots, name)) return roots[name]!;
    if (chain.has(name)) throw new Error(`Circular icon alias: ${collection.prefix}:${name}`);
    chain.add(name);
    const alias = collection.aliases?.[name];
    if (
      !alias ||
      typeof alias !== 'object' ||
      !('parent' in alias) ||
      typeof alias.parent !== 'string'
    ) {
      throw new Error(`Invalid icon alias: ${collection.prefix}:${name}`);
    }
    roots[name] = root(alias.parent, chain);
    return roots[name]!;
  }
  for (const name of Object.keys(collection.aliases ?? {})) root(name);
  return roots;
}

export function selectIcons(collection: IconsJson, names: Iterable<string>): IconsJson {
  const { icons, aliases, ...defaults } = collection;
  const result: IconsJson = { ...defaults, icons: {}, ...(aliases ? { aliases: {} } : {}) };
  const roots = getAliasRoots(collection);
  function include(name: string): void {
    if (Object.hasOwn(icons, name)) {
      result.icons[name] = icons[name];
      return;
    }
    const alias = aliases?.[name];
    if (
      !Object.hasOwn(roots, name) ||
      !alias ||
      typeof alias !== 'object' ||
      !('parent' in alias)
    ) {
      throw new Error(`Unknown local icon: ${collection.prefix}:${name}`);
    }
    if (result.aliases && !Object.hasOwn(result.aliases, name)) {
      result.aliases[name] = alias;
      include(String(alias.parent));
    }
  }
  for (const name of names) include(name);
  return result;
}

export function splitIconCollection(collection: IconsJson): IconsJson[] {
  const { icons, aliases, ...defaults } = collection;
  const roots = getAliasRoots(collection);
  const shards: IconsJson[] = Array.from({ length: ICON_SHARD_COUNT }, () => ({
    ...defaults,
    icons: {},
    ...(aliases ? { aliases: {} } : {}),
  }));
  for (const [name, icon] of Object.entries(icons)) {
    shards[getIconShard(name)]!.icons[name] = icon;
  }
  for (const [name, alias] of Object.entries(aliases ?? {})) {
    // Store aliases with their canonical icon: the SVG body is never copied across shards.
    shards[getIconShard(roots[name]!)]!.aliases![name] = alias;
  }
  return shards;
}

export function findIconNames(source: string): string[] {
  const names = new Set<string>();
  // Only complete string literals/attributes; computed names belong in the safelist.
  const pattern =
    /(['"`])((?:iconify:)?(?:ri|mdi|ion):[a-z0-9][a-z0-9-]*|(?:(?:antdv-next|antd):)?[A-Z][A-Za-z0-9]*(?:Outlined|Filled|TwoTone))\1/g;
  for (const match of source.matchAll(pattern)) names.add(match[2]!.replace(/^iconify:/, ''));
  return [...names];
}
