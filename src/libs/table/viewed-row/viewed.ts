import type { ViewedKey, ViewedRowOptions } from './types';

import { shallowRef } from 'vue';

import { createStorage } from './storage';

export function createViewedRows<T>(options: ViewedRowOptions<T>, fallbackKey = 'id') {
  const keys = shallowRef(new Set<ViewedKey>());
  const adapter = createStorage(options.persist);
  const maximum = options.persist?.maxSize ?? 100;
  const keyField = options.keyField ?? fallbackKey;
  let cleared = false;
  let disposed = false;
  const removed = new Set<ViewedKey>();
  let writes = Promise.resolve();
  const report = (error: unknown): void => console.error('[VxeGrid viewed rows]', error);
  function trim(values: Set<ViewedKey>): Set<ViewedKey> {
    if (maximum > 0) while (values.size > maximum) values.delete(values.values().next().value!);
    return values;
  }
  const ready = (async () => {
    try {
      const stored = (await adapter?.getKeys()) ?? [];
      if (!cleared)
        keys.value = trim(new Set([...stored.filter((key) => !removed.has(key)), ...keys.value]));
    } catch (error) {
      report(error);
    }
  })();
  function persist(clear = false): void {
    if (!adapter) return;
    // Capture after restore, but serialize all later mutations. Clear cannot be resurrected by an old read/write.
    const snapshot = [...keys.value];
    writes = writes
      .then(async () => {
        await ready;
        if (clear) await adapter.removeKeys();
        else await adapter.setKeys(snapshot);
      })
      .catch(report);
  }
  function mark(values: ViewedKey[]): void {
    if (disposed) return;
    const next = new Set(keys.value);
    for (const key of values) {
      removed.delete(key);
      next.add(key);
    }
    keys.value = trim(next);
    // Wait for restore so a new mark cannot overwrite stored keys before merging them.
    void ready.then(() => persist());
  }
  function keyOf(row: T): ViewedKey | undefined {
    const key = (row as Record<string, unknown>)[keyField];
    return typeof key === 'string' || typeof key === 'number' ? key : undefined;
  }
  return {
    keys,
    ready,
    mark,
    markRow(row: T): void {
      const key = keyOf(row);
      if (key !== undefined) mark([key]);
    },
    has(row: T): boolean {
      const key = keyOf(row);
      return key !== undefined && keys.value.has(key);
    },
    remove(values: ViewedKey[]): void {
      if (disposed) return;
      const next = new Set(keys.value);
      values.forEach((key) => {
        removed.add(key);
        next.delete(key);
      });
      keys.value = next;
      void ready.then(() => persist());
    },
    clear(): void {
      cleared = true;
      keys.value = new Set();
      persist(true);
    },
    async flush(): Promise<void> {
      await ready;
      await Promise.resolve();
      await writes;
    },
    dispose(): void {
      disposed = true;
    },
  };
}
export type ViewedRows<T> = ReturnType<typeof createViewedRows<T>>;
