import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

export function formatTableDate(value: unknown, pattern: string): string {
  if (value === undefined || value === null || value === '') return '';
  const date = dayjs.isDayjs(value)
    ? value
    : typeof value === 'string' || typeof value === 'number' || value instanceof Date
      ? dayjs(value)
      : undefined;
  if (!date?.isValid()) {
    console.error('[VxeGrid formatter] Invalid date');
    return String(value);
  }
  return date.tz().format(pattern);
}
