import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';

import { formatDisplayValue, getLinkHref, getRawText } from '@/components/ValueDisplay/format';

describe('ValueDisplay formatting', () => {
  it.each([null, undefined, '', '  ', NaN, Infinity])(
    'keeps missing/invalid value %s distinct from zero',
    (value) => {
      expect(formatDisplayValue(value, 'money')).toBeUndefined();
      expect(formatDisplayValue(value, 'percent')).toBeUndefined();
    },
  );

  it('preserves zero, false and numeric strings without coercing booleans to money', () => {
    expect(formatDisplayValue(0)).toBe('0');
    expect(formatDisplayValue(false)).toBe('false');
    expect(formatDisplayValue(0, 'money')).toBe('¥0.00');
    expect(formatDisplayValue(false, 'money')).toBeUndefined();
    expect(formatDisplayValue('-12345.678', 'money', { symbol: '$', precision: 2 })).toBe(
      '$-12,345.68',
    );
    expect(formatDisplayValue('bad', 'money')).toBeUndefined();
    expect(formatDisplayValue({}, 'money')).toBeUndefined();
  });

  it('defines percentage units and bounds precision and progress', () => {
    expect(formatDisplayValue(25, 'percent')).toBe('25.00%');
    expect(formatDisplayValue(0.25, 'percent')).toBe('0.25%');
    expect(formatDisplayValue(0.25, 'percent', { percentScale: 'fraction' })).toBe('25.00%');
    expect(formatDisplayValue(1, 'money', { precision: -5 })).toBe('¥1');
    expect(formatDisplayValue(1, 'money', { precision: 200 })).toBe('¥1.00000000000000000000');
    expect(formatDisplayValue(1, 'money', { precision: NaN })).toBe('¥1.00');
    expect(formatDisplayValue(1.25, 'percent', { precision: 1.9 })).toBe('1.3%');
    expect(
      formatDisplayValue(Number.MAX_VALUE, 'percent', { percentScale: 'fraction' }),
    ).toBeUndefined();
    expect(formatDisplayValue(-5, 'progress')).toBe('0%');
    expect(formatDisplayValue('150', 'progress')).toBe('100%');
  });

  it('formats epoch, Date and Dayjs with explicit timezone and validates invalid input', () => {
    for (const value of [0, new Date(0), dayjs(0)]) {
      expect(formatDisplayValue(value, 'dateTime', { timeZone: 'UTC' })).toBe(
        '1970-01-01 00:00:00',
      );
    }
    expect(formatDisplayValue('2026-09-16T08:30:00+08:00', 'dateTime', { timeZone: 'UTC' })).toBe(
      '2026-09-16 00:30:00',
    );
    expect(formatDisplayValue(0, 'dateTime', { timeZone: 'Asia/Shanghai' })).toBe(
      '1970-01-01 08:00:00',
    );
    expect(formatDisplayValue('bad-date', 'date')).toBeUndefined();
    expect(formatDisplayValue(new Date(NaN), 'date')).toBeUndefined();
    expect(formatDisplayValue(dayjs('bad-date'), 'date')).toBeUndefined();
    expect(formatDisplayValue(0, 'date', { timeZone: 'bad-zone' })).toBeUndefined();
  });

  it('does not inherit the VXE global default timezone', () => {
    dayjs.tz.setDefault('Pacific/Honolulu');
    try {
      expect(formatDisplayValue(0, 'dateTime')).toBe(
        dayjs(0).local().format('YYYY-MM-DD HH:mm:ss'),
      );
    } finally {
      dayjs.tz.setDefault();
    }
  });

  it('supports time-only strings and complete ranges', () => {
    expect(formatDisplayValue('08:30', 'time')).toBe('08:30:00');
    expect(formatDisplayValue('08:30:45', 'time', { format: 'HH:mm', timeZone: 'UTC' })).toBe(
      '08:30',
    );
    expect(formatDisplayValue('25:30', 'time')).toBeUndefined();
    expect(formatDisplayValue([0, 86400000], 'dateRange', { timeZone: 'UTC' })).toBe(
      '1970-01-01 ~ 1970-01-02',
    );
    expect(
      formatDisplayValue([0, 86400000], 'dateRange', {
        timeZone: 'UTC',
        format: 'MM/DD',
        rangeSeparator: ' – ',
      }),
    ).toBe('01/01 – 01/02');
    expect(formatDisplayValue([0, null], 'dateRange')).toBeUndefined();
    expect(formatDisplayValue([0], 'dateRange')).toBeUndefined();
  });

  it('resolves enums without losing falsy values or reading inherited keys', () => {
    const values = { '0': { text: 'Zero' }, false: { text: 'Disabled' }, empty: { text: '' } };
    expect(formatDisplayValue(0, 'tag', {}, values)).toBe('Zero');
    expect(formatDisplayValue(false, 'badge', {}, values)).toBe('Disabled');
    expect(formatDisplayValue('empty', 'tag', {}, values)).toBe('');
    expect(formatDisplayValue('unknown', 'tag', {}, values)).toBe('unknown');
    expect(formatDisplayValue('constructor', 'tag', {}, values)).toBe('constructor');
  });

  it('serializes copy values and restricts link protocols', () => {
    expect(getRawText(0)).toBe('0');
    expect(getRawText(false)).toBe('false');
    expect(getRawText(new Date(0))).toBe('1970-01-01T00:00:00.000Z');
    expect(getRawText([0, 1])).toBe('0 ~ 1');
    expect(getRawText({ secret: 'value' })).toBeUndefined();
    expect(getRawText(' ')).toBeUndefined();
    for (const link of [
      'https://example.com',
      '/details/1',
      'mailto:test@example.com',
      'tel:123',
    ]) {
      expect(getLinkHref(link)).toBe(link);
    }
    expect(getLinkHref('javascript:alert(1)')).toBeUndefined();
    expect(getLinkHref('data:text/html,test')).toBeUndefined();
  });
});
