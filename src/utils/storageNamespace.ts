export interface StorageNamespaceOptions {
  project: string;
  mode: string;
  appVersion: string;
  cacheVersion: string;
}

/** Encode each segment so a project identifier cannot overlap another namespace. */
export function createStorageNamespace(options: StorageNamespaceOptions): string {
  return (
    [options.project, options.mode, options.appVersion, options.cacheVersion]
      .map((segment) => {
        if (!segment.trim()) throw new Error('Storage namespace segments must not be empty');
        return encodeURIComponent(segment.trim());
      })
      .join(':') + ':'
  );
}

/** Native string storage API, restricted to exactly one project/mode/version. */
export class NamespacedStorage implements globalThis.Storage {
  constructor(
    private readonly resolveStorage: () => globalThis.Storage,
    readonly namespace: string,
  ) {
    if (!namespace || !namespace.endsWith(':')) {
      throw new Error('A non-empty, colon-terminated storage namespace is required');
    }
  }

  get length(): number {
    return this.keys().length;
  }

  getItem(key: string): string | null {
    try {
      return this.resolveStorage().getItem(this.namespace + key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      this.resolveStorage().setItem(this.namespace + key, value);
    } catch (error) {
      console.warn('Unable to persist application cache:', error);
    }
  }

  removeItem(key: string): void {
    try {
      this.resolveStorage().removeItem(this.namespace + key);
    } catch (error) {
      console.warn('Unable to remove application cache:', error);
    }
  }

  keys(): string[] {
    try {
      const storage = this.resolveStorage();
      const keys: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key?.startsWith(this.namespace)) keys.push(key.slice(this.namespace.length));
      }
      return keys;
    } catch {
      return [];
    }
  }

  key(index: number): string | null {
    return this.keys()[index] ?? null;
  }

  clear(): void {
    // Never clear the entire origin: another project/version may still be using it.
    for (const key of this.keys()) this.removeItem(key);
  }
}
