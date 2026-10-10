import type { ValueDisplayEnumItem, ValueDisplayOptions, ValueType } from './types';

import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

export function isEmptyValue(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim() === '');
}

export function getNumericValue(value: unknown): number | undefined {
  if (isEmptyValue(value) || (typeof value !== 'string' && typeof value !== 'number')) {
    return undefined;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function getEnumItem(
  value: unknown,
  valueEnum?: Record<string, ValueDisplayEnumItem>,
): ValueDisplayEnumItem | undefined {
  if (!valueEnum || !['string', 'number', 'boolean'].includes(typeof value)) return undefined;
  const key = String(value);
  return Object.prototype.hasOwnProperty.call(valueEnum, key) ? valueEnum[key] : undefined;
}

export function getRawText(value: unknown): string | undefined {
  if (isEmptyValue(value)) return undefined;
  if (dayjs.isDayjs(value)) return value.isValid() ? value.toISOString() : undefined;
  if (value instanceof Date)
    return Number.isFinite(value.getTime()) ? value.toISOString() : undefined;
  if (typeof value === 'number' && !Number.isFinite(value)) return undefined;
  if (['string', 'number', 'boolean', 'bigint'].includes(typeof value)) return String(value);
  if (Array.isArray(value) && value.length === 2) {
    const start = getRawText(value[0]);
    const end = getRawText(value[1]);
    return start !== undefined && end !== undefined ? `${start} ~ ${end}` : undefined;
  }
  return undefined;
}

function formatDateValue(
  value: unknown,
  type: ValueType,
  options: ValueDisplayOptions,
): string | undefined {
  if (isEmptyValue(value)) return undefined;
  let date = dayjs.isDayjs(value)
    ? value
    : typeof value === 'string' || typeof value === 'number' || value instanceof Date
      ? dayjs(value)
      : undefined;
  // A time-only string is a wall-clock value, not an instant in a timezone.
  const clockOnly =
    type === 'time' && typeof value === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(value);
  if (clockOnly) date = dayjs(value, ['HH:mm:ss', 'HH:mm'], true);
  if (!date?.isValid()) return undefined;
  try {
    if (!clockOnly) {
      date =
        options.timeZone && options.timeZone !== 'local' ? date.tz(options.timeZone) : date.local();
    }
    const pattern =
      options.format ||
      (type === 'time' ? 'HH:mm:ss' : type === 'dateTime' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD');
    return date.format(pattern);
  } catch {
    // Invalid timezone configuration is rendered as unavailable, never a broken page.
    return undefined;
  }
}

/** Text representation shared by the component and future formatter/export adapters. */
export function formatDisplayValue(
  value: unknown,
  type: ValueType = 'text',
  options: ValueDisplayOptions = {},
  valueEnum?: Record<string, ValueDisplayEnumItem>,
): string | undefined {
  if (isEmptyValue(value)) return undefined;
  if (type === 'date' || type === 'dateTime' || type === 'time') {
    return formatDateValue(value, type, options);
  }
  if (type === 'dateRange') {
    if (!Array.isArray(value) || value.length !== 2) return undefined;
    const start = formatDateValue(value[0], 'date', options);
    const end = formatDateValue(value[1], 'date', options);
    return start !== undefined && end !== undefined
      ? `${start}${options.rangeSeparator ?? ' ~ '}${end}`
      : undefined;
  }
  if (type === 'money' || type === 'percent' || type === 'progress') {
    const number = getNumericValue(value);
    if (number === undefined) return undefined;
    if (type === 'progress') return `${Math.min(100, Math.max(0, number))}%`;
    const precision = Number.isFinite(options.precision)
      ? Math.min(20, Math.max(0, Math.trunc(options.precision!)))
      : 2;
    if (type === 'percent') {
      const percent = options.percentScale === 'fraction' ? number * 100 : number;
      return Number.isFinite(percent) ? `${percent.toFixed(precision)}%` : undefined;
    }
    const [integer, fraction] = number.toFixed(precision).split('.');
    const grouped = integer!.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${options.symbol ?? '¥'}${grouped}${fraction === undefined ? '' : `.${fraction}`}`;
  }
  if (type === 'tag' || type === 'badge')
    return getEnumItem(value, valueEnum)?.text ?? getRawText(value);
  if (type === 'image' || type === 'avatar' || type === 'link') {
    return typeof value === 'string' ? value : undefined;
  }
  return getRawText(value);
}

export function getLinkHref(value: unknown): string | undefined {
  if (typeof value !== 'string' || isEmptyValue(value)) return undefined;
  try {
    const url = new URL(value, 'https://value-display.invalid/');
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? value : undefined;
  } catch {
    return undefined;
  }
}
