import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';

import { snapshotFormValue } from '@/libs/form/internal/snapshot';

describe('SchemaForm value snapshot contract', () => {
  it('isolates nested objects and arrays while preserving aliases', () => {
    const shared = { label: 'original' };
    const value = { nested: { rows: [shared] }, alias: shared };
    const copy = snapshotFormValue(value);
    copy.nested.rows[0]!.label = 'snapshot-only';
    expect(value.alias.label).toBe('original');
    expect(copy.alias).toBe(copy.nested.rows[0]);
  });
  it('preserves empty values, numbers and sparse arrays without JSON conversion', () => {
    const sparse = new Array<string>(3);
    sparse[2] = 'end';
    const value = { nullable: null, unset: undefined, enabled: false, zero: 0, nan: NaN, sparse };
    const copy = snapshotFormValue(value);
    expect(copy).toEqual(value);
    expect(Object.hasOwn(copy, 'unset')).toBe(true);
    expect(0 in copy.sparse).toBe(false);
  });
  it('preserves Date and Dayjs semantics', () => {
    const value = { date: new Date('2026-01-01T00:00:00Z'), day: dayjs('2026-01-01') };
    const copy = snapshotFormValue(value);
    copy.date.setUTCFullYear(2030);
    expect(value.date.getUTCFullYear()).toBe(2026);
    expect(dayjs.isDayjs(copy.day)).toBe(true);
    expect(copy.day).not.toBe(value.day);
    expect(copy.day.add(1, 'day').format('YYYY-MM-DD')).toBe('2026-01-02');
    expect(value.day.format('YYYY-MM-DD')).toBe('2026-01-01');
  });
  it('copies File/Blob identity while preserving immutable bytes and file metadata', async () => {
    const value = {
      file: new File(['hello'], 'test.txt', { type: 'text/plain', lastModified: 123 }),
      blob: new Blob(['world']),
    };
    const copy = snapshotFormValue(value);
    expect(copy.file).not.toBe(value.file);
    expect(copy.file.name).toBe('test.txt');
    expect(copy.file.lastModified).toBe(123);
    expect(await copy.file.text()).toBe('hello');
    expect(await copy.blob.text()).toBe('world');
  });
  it('rejects cycles and unsupported classes instead of silently serializing them', () => {
    const cycle: { self?: unknown } = {};
    cycle.self = cycle;
    expect(() => snapshotFormValue(cycle)).toThrow('cycles');
    expect(() => snapshotFormValue(new Map())).toThrow('Unsupported');
    expect(() => snapshotFormValue({ callback: () => 1 })).toThrow('functions');
  });
  it('preserves upload uid and isolates custom file metadata', () => {
    const file = Object.assign(new File(['bytes'], 'upload.txt'), {
      uid: 'upload-1',
      metadata: { source: 'original' },
    });
    const copy = snapshotFormValue(file);
    expect(copy.uid).toBe('upload-1');
    copy.metadata.source = 'changed';
    expect(file.metadata.source).toBe('original');
    const cyclic = Object.assign(new Blob(['bytes']), { self: {} });
    cyclic.self = cyclic;
    expect(() => snapshotFormValue(cyclic)).toThrow('cycles');
  });
  it('does not invoke getters or prototype setters while copying', () => {
    let calls = 0;
    expect(() =>
      snapshotFormValue({
        get field() {
          calls++;
          return 1;
        },
      }),
    ).toThrow('accessors');
    expect(calls).toBe(0);
    const value: Record<string, unknown> = JSON.parse('{"__proto__":{"polluted":true}}');
    const copy = snapshotFormValue(value);
    expect(Object.getPrototypeOf(copy)).toBe(Object.prototype);
    expect(Object.hasOwn(copy, '__proto__')).toBe(true);
    expect(Reflect.get({}, 'polluted')).toBeUndefined();
  });
});
