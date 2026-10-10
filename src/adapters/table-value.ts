import type { ValueDisplayProps } from '@/components/ValueDisplay/types';
import type { VNode } from 'vue';
import type { VxeGlobalRendererOptions } from 'vxe-pc-ui';

import { h } from 'vue';
import { get } from 'xe-utils';

import { formatDisplayValue, getRawText } from '@/components/ValueDisplay/format';
import ValueDisplay from '@/components/ValueDisplay/index.vue';

export type CellValueProps = Omit<ValueDisplayProps, 'value'>;

export interface CellValueContext<Row = Record<string, unknown>> {
  row: Row;
  column: { field: string };
}

export interface CellValueRenderOptions<Row = Record<string, unknown>> {
  name: 'CellValue';
  props?: CellValueProps;
  events?: {
    copy?: (params: CellValueContext<Row>, text: string) => void;
    copyError?: (params: CellValueContext<Row>) => void;
  };
}

/** Host-only adapter: the independently copyable table library does not import ValueDisplay. */
export const cellValueRenderer = {
  renderTableDefault(
    { props, events }: Omit<CellValueRenderOptions, 'name'>,
    params: CellValueContext,
  ): VNode {
    const value: unknown = get(params.row, params.column.field);
    return h(ValueDisplay, {
      ...props,
      value,
      onCopy: (text: string) => events?.copy?.(params, text),
      onCopyError: () => events?.copyError?.(params),
    });
  },
  tableExportMethod({
    row,
    column,
    options,
  }: {
    row: Record<string, unknown>;
    column: { field: string; cellRender?: { props?: CellValueProps } | null };
    options: { original?: boolean };
  }): string {
    const value: unknown = get(row, column.field);
    if (options.original) return getRawText(value) ?? '';
    const props = column.cellRender?.props ?? {};
    return (
      formatDisplayValue(value, props.type, props.options, props.valueEnum) ??
      props.emptyText ??
      '—'
    );
  },
} satisfies VxeGlobalRendererOptions;
