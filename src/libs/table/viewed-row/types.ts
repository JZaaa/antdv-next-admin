import type { Ref } from 'vue';
import type { VxeTablePropTypes } from 'vxe-table';
export type ViewedKey = string | number;
export interface ViewedRowStorageAdapter {
  getKeys(): Promise<ViewedKey[]>;
  setKeys(keys: ViewedKey[]): Promise<void>;
  removeKeys(): Promise<void>;
}
interface PersistBase {
  ttl?: number;
  maxSize?: number;
}
export type ViewedRowPersistOptions = PersistBase &
  (
    | { type: 'memory' }
    | { type: 'localStorage' | 'sessionStorage'; key: string }
    | { type: 'indexedDB'; key: string; dbName?: string; dbVersion?: number; storeName?: string }
    | { type: 'custom'; storage: ViewedRowStorageAdapter }
  );
export interface ViewedRowOptions<T = Record<string, unknown>> {
  actionCodes?: string | string[];
  keyField?: string;
  viewedKeys?: ViewedKey[] | Ref<ViewedKey[]>;
  persist?: ViewedRowPersistOptions;
  rowClassName?: VxeTablePropTypes.RowClassName<T>;
  rowStyle?: VxeTablePropTypes.RowStyle<T>;
}
