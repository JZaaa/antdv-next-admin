import type { CellValueProps } from '@/adapters/table-value';

import { describe, expect, it, vi } from 'vitest';

import { cellValueRenderer } from '@/adapters/table-value';
import ValueDisplay from '@/components/ValueDisplay/index.vue';

vi.mock('@/components/ValueDisplay/index.vue', () => ({ default: { name: 'ValueDisplay' } }));

describe('CellValue adapter', () => {
  it('reads nested fields and preserves falsy values without changing the row', () => {
    const row = Object.freeze({
      account: Object.freeze({ amount: 0 }),
      enabled: false,
      items: [{ name: 'A' }],
    });
    for (const [field, value] of [
      ['account.amount', 0],
      ['enabled', false],
      ['items[0].name', 'A'],
      ['account.missing', undefined],
    ]) {
      const vnode = cellValueRenderer.renderTableDefault(
        {},
        { row, column: { field: String(field) } },
      );
      expect(vnode.type).toBe(ValueDisplay);
      expect(vnode.props?.value).toBe(value);
    }
  });

  it('passes display options but always uses the current row value', () => {
    const props = {
      type: 'money',
      options: { symbol: '$', precision: 1 },
      copyable: true,
      copyMode: 'display',
      value: 'ignored',
    } satisfies CellValueProps & { value: unknown };
    const row = { amount: 12.3 };
    const params = { row, column: { field: 'amount' } };
    const vnode = cellValueRenderer.renderTableDefault({ props }, params);
    expect(vnode.props).toMatchObject({ ...props, value: 12.3 });
    expect(vnode.props?.options).toBe(props.options);
    row.amount = 0;
    expect(cellValueRenderer.renderTableDefault({ props }, params).props?.value).toBe(0);
  });

  it('forwards copy events with the row and column context', () => {
    const copy = vi.fn(),
      copyError = vi.fn();
    const params = { row: { amount: 0 }, column: { field: 'amount' } };
    const vnode = cellValueRenderer.renderTableDefault({ events: { copy, copyError } }, params);
    vnode.props?.onCopy('¥0.00');
    vnode.props?.onCopyError();
    expect(copy).toHaveBeenCalledExactlyOnceWith(params, '¥0.00');
    expect(copyError).toHaveBeenCalledExactlyOnceWith(params);
  });

  it('exports enum labels and formatted numbers, or original values on request', () => {
    const cases: { value: unknown; props: CellValueProps; display: string; raw: string }[] = [
      {
        value: 0,
        props: { type: 'tag', valueEnum: { 0: { text: 'Pending' } } },
        display: 'Pending',
        raw: '0',
      },
      { value: 1234.5, props: { type: 'money' }, display: '¥1,234.50', raw: '1234.5' },
      { value: false, props: {}, display: 'false', raw: 'false' },
      {
        value: 0.25,
        props: { type: 'percent', options: { percentScale: 'fraction' } },
        display: '25.00%',
        raw: '0.25',
      },
      {
        value: 0,
        props: { type: 'dateTime', options: { timeZone: 'UTC' } },
        display: '1970-01-01 00:00:00',
        raw: '0',
      },
    ];
    for (const { value, props, display, raw } of cases) {
      const params = {
        row: { nested: { value } },
        column: { field: 'nested.value', cellRender: { props } },
      };
      expect(cellValueRenderer.tableExportMethod({ ...params, options: {} })).toBe(display);
      expect(cellValueRenderer.tableExportMethod({ ...params, options: { original: true } })).toBe(
        raw,
      );
    }
  });

  it('exports configured placeholders for missing/invalid display data and no DOM content', () => {
    const params = {
      row: { amount: null },
      column: {
        field: 'amount',
        cellRender: { props: { type: 'money', emptyText: 'N/A' } satisfies CellValueProps },
      },
    };
    expect(cellValueRenderer.tableExportMethod({ ...params, options: {} })).toBe('N/A');
    expect(cellValueRenderer.tableExportMethod({ ...params, options: { original: true } })).toBe(
      '',
    );
    expect(
      cellValueRenderer.tableExportMethod({ row: {}, column: { field: 'missing' }, options: {} }),
    ).toBe('—');
  });
});
