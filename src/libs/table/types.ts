import type { ViewedRowOptions } from './viewed-row/types';
import type { Component, Ref, VNodeChild } from 'vue';
import type {
  VxeGridInstance,
  VxeGridListeners,
  VxeGridProps,
  VxeGridSlots,
  VxeGridPropTypes,
} from 'vxe-table';

export type TableRow = Record<string, unknown>;
export type ClassType = string | Record<string, boolean> | ClassType[];
export type TableLocale = 'zh-CN' | 'en-US' | 'ja-JP' | 'ko-KR';
export interface VxeTableGridOptions<T = TableRow> extends VxeGridProps<T> {
  toolbarConfig?: VxeGridPropTypes.ToolbarConfig & { search?: boolean };
}
export type VxeTableGridColumns<T = TableRow> = VxeTableGridOptions<T>['columns'];
/** Form is injected by the host. The table never imports a form engine. */
export interface TableSearchBridge<F = unknown, A = unknown> {
  component: Component;
  api: A;
  getLatest: () => object;
  initialize: () => Promise<void>;
  update: (options: F) => void;
  dispose: () => void;
}
export type TableSearchFactory<F, A> = (
  options: F,
  reload: (params?: object) => Promise<void>,
) => TableSearchBridge<F, A>;
export interface TableProps<T = TableRow, F = unknown> {
  tableData?: T[];
  tableTitle?: string;
  tableTitleHelp?: string;
  class?: ClassType;
  gridClass?: ClassType;
  gridOptions?: VxeTableGridOptions<T>;
  gridEvents?: VxeGridListeners<T>;
  formOptions?: F | false;
  showSearchForm?: boolean;
  separator?: boolean | { show?: boolean; backgroundColor?: string };
  viewedRowOptions?: boolean | ViewedRowOptions<T>;
}
export type TableSlots<T> = Omit<VxeGridSlots<T>, 'form'> & {
  'table-title'?: () => VNodeChild;
  'toolbar-actions'?: (scope: { $grid: VxeGridInstance<T> }) => VNodeChild;
  'toolbar-tools'?: (scope: { $grid: VxeGridInstance<T> }) => VNodeChild;
  form?: (scope: { formApi: unknown }) => VNodeChild;
};
export type TableComponent<T, F> = new () => {
  $props: TableProps<T, F>;
  $slots: TableSlots<T>;
};
export interface TableSetupOptions {
  locale?: TableLocale | Ref<TableLocale>;
  theme?: 'light' | 'dark' | Ref<'light' | 'dark'>;
  configVxeTable?: (ui: typeof import('vxe-pc-ui').VxeUI) => void;
}
