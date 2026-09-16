import dayjs from 'dayjs';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { VxeGridApi } from '../../src/libs/table/core/api';
import { formatTableDate } from '../../src/libs/table/core/format';
import { mergeConfig } from '../../src/libs/table/core/merge';
import { PROXY_CALLBACKS, wrapProxy } from '../../src/libs/table/core/proxy';
import { createViewedRows } from '../../src/libs/table/viewed-row/viewed';

describe('VXE wrapper config and state', () => {
  it('formats null, epoch, invalid input and default timezone like the reference formatter', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    dayjs.tz.setDefault('UTC');
    try {
      expect(formatTableDate(null, 'YYYY-MM-DD')).toBe('');
      expect(formatTableDate(0, 'YYYY-MM-DD')).toBe('1970-01-01');
      expect(formatTableDate('bad-date', 'YYYY-MM-DD')).toBe('bad-date');
      expect(formatTableDate('2026-09-16T08:30:00+08:00', 'YYYY-MM-DD HH:mm:ss')).toBe(
        '2026-09-16 00:30:00',
      );
      expect(log).toHaveBeenCalledOnce();
    } finally {
      dayjs.tz.setDefault();
      log.mockRestore();
    }
  });
  it('replaces arrays without cloning rows, preserves refs/functions, falls back on nullish config', () => {
    const rows = [{ id: 1 }],
      columns = [{ field: 'id' }],
      fn = () => 1,
      value = ref([1]);
    const previous = { data: rows, columns, loading: false, nested: { a: 1, b: 2 }, fn, value };
    const next = mergeConfig({ loading: true, nested: { a: 3, b: 2 } }, previous);
    expect(next.data).toBe(rows);
    expect(next.columns).toBe(columns);
    expect(next.fn).toBe(fn);
    expect(next.value).toBe(value);
    expect(mergeConfig({ data: [] }, previous).data).toEqual([]);
    expect(mergeConfig({ nested: undefined }, previous).nested).toBe(previous.nested);
  });
  it('isolates APIs, notifies store subscriptions, accepts updater, releases native references', () => {
    const first = new VxeGridApi(),
      second = new VxeGridApi();
    const listen = vi.fn();
    const subscription = first.store.subscribe(listen);
    first.setState((old) => ({ tableTitle: old.tableTitle ?? 'First' }));
    first.setLoading(true);
    expect(listen).toHaveBeenCalledTimes(2);
    expect(first.useStore((state) => state.tableTitle).value).toBe('First');
    expect(second.state.tableTitle).toBeUndefined();
    expect(first.toggleSearchForm()).toBe(false);
    subscription.unsubscribe();
    first.unmount();
    expect(first.grid).toBeUndefined();
    expect(first.formApi).toBeUndefined();
  });
});
describe('proxy callback contracts', () => {
  it('discards late query responses and callbacks after unmount', async () => {
    let active = true;
    let release!: (result: object) => void;
    const success = vi.fn();
    const wrapped = wrapProxy(
      {
        ajax: {
          query: () =>
            new Promise((resolve) => {
              release = resolve;
            }),
          querySuccess: success,
        },
      },
      () => ({}),
      () => active,
    )!;
    const query = wrapped.ajax!.query as (...args: unknown[]) => Promise<unknown>;
    const result = query({});
    active = false;
    release({ items: [1] });
    await expect(result).rejects.toThrow('unmounted');
    const callback = wrapped.ajax!.querySuccess as (...args: unknown[]) => Promise<unknown>;
    await callback({});
    expect(success).not.toHaveBeenCalled();
  });
  it.each(PROXY_CALLBACKS)(
    '%s injects submitted snapshot once, preserves this/extra args and result',
    async (key) => {
      const callback = vi.fn(function (this: unknown, ...args: unknown[]) {
        return { receiver: this, args };
      });
      const source = { ajax: { [key]: callback } };
      const latest = { name: 'submitted' };
      const wrapped = wrapProxy(source, () => latest)!;
      const method = wrapped.ajax![key] as (
        ...args: unknown[]
      ) => Promise<{ receiver: unknown; args: unknown[] }>;
      const receiver = {};
      const result = await method.call(
        receiver,
        { page: 1 },
        { name: 'custom', extra: true },
        'tail',
      );
      expect(result).toEqual({
        receiver,
        args: [{ page: 1 }, { name: 'submitted', extra: true }, 'tail'],
      });
      expect(callback).toHaveBeenCalledTimes(1);
      expect(source.ajax[key]).toBe(callback);
      await method({}, new Event('click'));
      expect(callback.mock.calls[1]?.[1]).toEqual(latest);
    },
  );
});
describe('viewed row asynchronous storage', () => {
  it('flushes already requested marks after disposal while a restore is pending', async () => {
    let restore!: (keys: number[]) => void;
    const saved = vi.fn(async () => {});
    const helper = createViewedRows({
      persist: {
        type: 'custom',
        storage: {
          getKeys: () =>
            new Promise((resolve) => {
              restore = resolve;
            }),
          setKeys: saved,
          removeKeys: async () => {},
        },
      },
    });
    helper.mark([2]);
    helper.dispose();
    restore([1]);
    await helper.flush();
    expect(saved).toHaveBeenLastCalledWith([1, 2]);
  });
  it('retains memory state when storage fails and reports the error', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const helper = createViewedRows({
        persist: {
          type: 'custom',
          storage: {
            getKeys: async () => {
              throw new Error('blocked');
            },
            setKeys: async () => {
              throw new Error('quota');
            },
            removeKeys: async () => {},
          },
        },
      });
      await helper.ready;
      helper.mark([1]);
      await helper.flush();
      expect(helper.keys.value.has(1)).toBe(true);
      expect(log).toHaveBeenCalledTimes(2);
      helper.dispose();
    } finally {
      log.mockRestore();
    }
  });
  it('merges slow restore before local keys, preserves FIFO and typed keys', async () => {
    let restore!: (keys: (string | number)[]) => void;
    const setKeys = vi.fn(async () => {});
    const helper = createViewedRows({
      persist: {
        type: 'custom',
        maxSize: 3,
        storage: {
          getKeys: () =>
            new Promise((resolve) => {
              restore = resolve;
            }),
          setKeys,
          removeKeys: async () => {},
        },
      },
    });
    helper.mark([3, '3']);
    restore([1, 2]);
    await helper.flush();
    expect([...helper.keys.value]).toEqual([2, 3, '3']);
    expect(setKeys).toHaveBeenLastCalledWith([2, 3, '3']);
    helper.dispose();
  });
  it('clear defeats late restore and queued writes; subsequent marks persist after clear', async () => {
    let restore!: (keys: number[]) => void;
    const actions: unknown[] = [];
    const helper = createViewedRows({
      persist: {
        type: 'custom',
        storage: {
          getKeys: () =>
            new Promise((resolve) => {
              restore = resolve;
            }),
          setKeys: async (keys) => {
            actions.push(keys);
          },
          removeKeys: async () => {
            actions.push('clear');
          },
        },
      },
    });
    helper.mark([1]);
    helper.clear();
    helper.mark([9]);
    restore([2]);
    await helper.flush();
    expect([...helper.keys.value]).toEqual([9]);
    expect(actions[actions.length - 1]).toEqual([9]);
    helper.dispose();
  });
  it('removal while restoring cannot resurrect deleted keys', async () => {
    let restore!: (keys: number[]) => void;
    const helper = createViewedRows({
      persist: {
        type: 'custom',
        storage: {
          getKeys: () =>
            new Promise((resolve) => {
              restore = resolve;
            }),
          setKeys: async () => {},
          removeKeys: async () => {},
        },
      },
    });
    helper.remove([1]);
    restore([1, 2]);
    await helper.flush();
    expect([...helper.keys.value]).toEqual([2]);
    helper.dispose();
  });
});
