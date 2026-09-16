import type { IconsJson } from '../types/icon';

import { addCollection } from '@iconify/vue';
import { localIconAssets, localIconAliases } from 'virtual:local-icon-assets';

import { getIconShard } from './iconShard';

export type LocalIconifyPrefix = 'ri' | 'mdi' | 'ion';

export type { IconsJson } from '../types/icon';

const localPrefixes = new Set<string>(['ri', 'mdi', 'ion']);
const localIconifyLoadPromises = new Map<LocalIconifyPrefix, Promise<IconsJson>>();
const shardLoadPromises = new Map<string, Promise<IconsJson>>();

export const isLocalIconifyPrefix = (prefix: string): prefix is LocalIconifyPrefix =>
  localPrefixes.has(prefix);

function loadShard(prefix: LocalIconifyPrefix, index: number): Promise<IconsJson> {
  const url = localIconAssets[prefix]?.[index];
  if (!url) return Promise.resolve({ prefix, icons: {} });
  const key = `${prefix}:${index}`;
  const cached = shardLoadPromises.get(key);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    // Vite emits hashed JSON assets and applies the configured base path to these URLs.
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${prefix} icons: HTTP ${response.status}`);
    }
    const iconsJson: IconsJson = await response.json();
    if (
      !iconsJson ||
      iconsJson.prefix !== prefix ||
      !addCollection(iconsJson as unknown as Parameters<typeof addCollection>[0])
    ) {
      throw new Error(`Invalid ${prefix} icon collection`);
    }
    return iconsJson;
  })().catch((error: unknown) => {
    // Failed requests must not prevent a later picker opening from retrying.
    shardLoadPromises.delete(key);
    throw error;
  });

  shardLoadPromises.set(key, promise);
  return promise;
}

export function loadLocalIconifyIcon(prefix: LocalIconifyPrefix, name: string): Promise<IconsJson> {
  return loadShard(prefix, getIconShard(localIconAliases[prefix]?.[name] ?? name));
}

export const loadLocalIconifySet = (prefix: LocalIconifyPrefix): Promise<IconsJson> => {
  const cached = localIconifyLoadPromises.get(prefix);
  if (cached) return cached;
  const promise = (async () => {
    const result: IconsJson = { prefix, icons: {} };
    // Bound concurrency when loading the complete picker catalogue over an intranet.
    const urls = localIconAssets[prefix] ?? [];
    for (let start = 0; start < urls.length; start += 4) {
      // oxlint-disable-next-line no-await-in-loop -- Bound concurrent downloads to four shards.
      const shards = await Promise.all(
        urls.slice(start, start + 4).map((_url, offset) => loadShard(prefix, start + offset)),
      );
      for (const shard of shards) {
        const { icons, aliases, ...defaults } = shard;
        Object.assign(result, defaults);
        Object.assign(result.icons, icons);
        if (aliases) Object.assign((result.aliases ??= {}), aliases);
      }
    }
    return result;
  })().catch((error: unknown) => {
    localIconifyLoadPromises.delete(prefix);
    throw error;
  });
  localIconifyLoadPromises.set(prefix, promise);
  return promise;
};
