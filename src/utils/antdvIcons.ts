import type { Component } from 'vue';

import { antdIconGroups, antdIconNames } from 'virtual:local-icon-assets';

import { getIconShard } from './iconShard';

const names = new Set(antdIconNames);
const groups = new Map<number, Promise<Record<string, Component>>>();

function loadGroup(index: number): Promise<Record<string, Component>> {
  const cached = groups.get(index);
  if (cached) return cached;
  const promise = antdIconGroups[index]!()
    .then((module) => module.default)
    .catch((error: unknown) => {
      groups.delete(index);
      throw error;
    });
  groups.set(index, promise);
  return promise;
}

export async function loadAntdvIcon(name: string): Promise<Component | undefined> {
  if (!names.has(name)) return undefined;
  return (await loadGroup(getIconShard(name)))[name];
}

export function getAntdvIconNames(): string[] {
  return [...antdIconNames];
}

export async function preloadAntdvIcons(): Promise<void> {
  for (let start = 0; start < antdIconGroups.length; start += 4) {
    // oxlint-disable-next-line no-await-in-loop -- Bound concurrent module downloads to four groups.
    await Promise.all(
      antdIconGroups.slice(start, start + 4).map((_loader, offset) => loadGroup(start + offset)),
    );
  }
}
