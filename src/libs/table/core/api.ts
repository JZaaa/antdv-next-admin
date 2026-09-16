import type { TableProps, TableSearchBridge, TableRow, VxeTableGridOptions } from '../types';
import type { ViewedKey } from '../viewed-row/types';
import type { ViewedRows } from '../viewed-row/viewed';
import type { Ref } from 'vue';
import type { VxeGridInstance } from 'vxe-table';

import { computed, shallowRef, toRaw } from 'vue';

import { mergeConfig } from './merge';

export class VxeGridApi<T = TableRow, F = unknown, A = unknown> {
  grid?: VxeGridInstance<T>;
  search?: TableSearchBridge<F, A>;
  viewed?: ViewedRows<T>;
  private readonly value;
  private readonly subscribers = new Set<(state: TableProps<T, F>) => void>();
  readonly store;
  constructor(options: TableProps<T, F> = {}) {
    this.value = shallowRef<TableProps<T, F>>({
      showSearchForm: true,
      gridOptions: {},
      gridEvents: {},
      ...options,
    });
    const value = this.value;
    const subscribers = this.subscribers;
    this.store = {
      get state(): TableProps<T, F> {
        return value.value;
      },
      setState: (updater: (previous: TableProps<T, F>) => TableProps<T, F>): void => {
        value.value = updater(value.value);
        subscribers.forEach((listener) => listener(value.value));
      },
      subscribe(listener: (state: TableProps<T, F>) => void): { unsubscribe: () => void } {
        subscribers.add(listener);
        return { unsubscribe: () => subscribers.delete(listener) };
      },
    };
  }
  get state(): TableProps<T, F> {
    return this.value.value;
  }
  get formApi(): A | undefined {
    return this.search?.api;
  }
  useStore = <R = TableProps<T, F>>(selector?: (state: TableProps<T, F>) => R): Readonly<Ref<R>> =>
    computed(() => (selector ? selector(this.state) : (this.state as R)));
  setState = (
    patch: Partial<TableProps<T, F>> | ((previous: TableProps<T, F>) => Partial<TableProps<T, F>>),
  ): void => {
    this.store.setState((previous) =>
      mergeConfig(typeof patch === 'function' ? patch(previous) : patch, previous),
    );
  };
  setGridOptions = (options: VxeTableGridOptions<T>): void => {
    this.setState({ gridOptions: options });
  };
  setLoading = (loading: boolean): void => {
    this.setGridOptions({ loading });
  };
  toggleSearchForm = (show?: boolean): boolean => {
    const visible = typeof show === 'boolean' ? show : !this.state.showSearchForm;
    this.setState({ showSearchForm: visible });
    return visible;
  };
  private commit = async (code: 'query' | 'reload', params: object = {}): Promise<void> => {
    try {
      if (!this.grid) throw new Error('VxeGrid is not mounted');
      await this.grid.commitProxy(code, toRaw(params));
    } catch (error) {
      console.error(`[VxeGrid ${code}]`, error);
    }
  };
  query = (params?: object): Promise<void> => this.commit('query', params);
  reload = (params?: object): Promise<void> => this.commit('reload', params);
  getViewedKeys = (): Set<ViewedKey> => new Set(this.viewed?.keys.value);
  markKeysAsViewed = (keys: ViewedKey[]): void => {
    this.viewed?.mark(keys);
  };
  markRowAsViewed = (row: T): void => {
    this.viewed?.markRow(row);
  };
  isRowViewed = (row: T): boolean => this.viewed?.has(row) ?? false;
  removeViewedKeys = (keys: ViewedKey[]): void => {
    this.viewed?.remove(keys);
  };
  clearViewedRows = (): void => {
    this.viewed?.clear();
  };
  unmount = (): void => {
    this.grid = undefined;
    this.search = undefined;
    this.viewed?.dispose();
    this.viewed = undefined;
  };
}
