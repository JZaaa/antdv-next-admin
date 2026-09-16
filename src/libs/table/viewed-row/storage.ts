import type { ViewedKey, ViewedRowPersistOptions, ViewedRowStorageAdapter } from './types';

interface Envelope {
  keys: ViewedKey[];
  expires: number;
}
function decode(value: unknown): ViewedKey[] {
  if (!value || typeof value !== 'object') return [];
  const envelope = value as Envelope;
  if (envelope.expires && envelope.expires <= Date.now()) return [];
  return Array.isArray(envelope.keys)
    ? envelope.keys.filter((key) => typeof key === 'string' || typeof key === 'number')
    : [];
}
export function createStorage(
  options?: ViewedRowPersistOptions,
): ViewedRowStorageAdapter | undefined {
  if (!options || options.type === 'memory') return;
  if (options.type === 'custom') return options.storage;
  if (options.type === 'localStorage' || options.type === 'sessionStorage') {
    const { type, key, ttl } = options;
    return {
      async getKeys() {
        return decode(JSON.parse(globalThis[type].getItem(key) ?? 'null'));
      },
      async setKeys(keys) {
        globalThis[type].setItem(
          key,
          JSON.stringify({ keys, expires: ttl ? Date.now() + ttl : 0 }),
        );
      },
      async removeKeys() {
        globalThis[type].removeItem(key);
      },
    };
  }
  if (options.type !== 'indexedDB') return;
  // One transaction per namespace, per-entry expiry preserves original mark time.
  const {
    key,
    dbName = 'viewed-table-db',
    dbVersion = 1,
    storeName = 'viewed-table-row',
    ttl,
  } = options;
  type Entry = { key: ViewedKey; expires: number };
  async function transaction<R>(
    write: boolean,
    action: (store: IDBObjectStore, finish: (value: R) => void) => void,
  ): Promise<R> {
    return await new Promise<R>((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(storeName))
          request.result.createObjectStore(storeName);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Viewed row database upgrade is blocked'));
      request.onsuccess = () => {
        const db = request.result;
        let result: R;
        try {
          const tx = db.transaction(storeName, write ? 'readwrite' : 'readonly');
          tx.oncomplete = () => {
            db.close();
            resolve(result);
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error ?? new Error('Viewed row transaction aborted'));
          };
          action(tx.objectStore(storeName), (value) => {
            result = value;
          });
        } catch (error) {
          db.close();
          reject(error);
        }
      };
    });
  }
  return {
    async getKeys() {
      return await transaction<ViewedKey[]>(false, (store, finish) => {
        const read = store.get(key);
        read.onsuccess = () =>
          finish(
            ((read.result ?? []) as Entry[])
              .filter((entry) => !entry.expires || entry.expires > Date.now())
              .map((entry) => entry.key),
          );
      });
    },
    async setKeys(keys) {
      await transaction<void>(true, (store, finish) => {
        const read = store.get(key);
        read.onsuccess = () => {
          const old = new Map(
            ((read.result ?? []) as Entry[])
              .filter((entry) => !entry.expires || entry.expires > Date.now())
              .map((entry) => [entry.key, entry]),
          );
          store.put(
            keys.map(
              (value) => old.get(value) ?? { key: value, expires: ttl ? Date.now() + ttl : 0 },
            ),
            key,
          );
          finish();
        };
      });
    },
    async removeKeys() {
      await transaction<void>(true, (store, finish) => {
        store.delete(key);
        finish();
      });
    },
  };
}
