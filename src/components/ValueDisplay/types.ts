export type ValueType =
  | 'text'
  | 'date'
  | 'dateTime'
  | 'dateRange'
  | 'time'
  | 'tag'
  | 'badge'
  | 'money'
  | 'percent'
  | 'avatar'
  | 'image'
  | 'link'
  | 'progress';

export interface ValueDisplayEnumItem {
  text: string;
  color?: string;
  status?: string;
}

export interface ValueDisplayOptions {
  format?: string;
  /** Local time by default; also accepts UTC or an IANA timezone. */
  timeZone?: string;
  rangeSeparator?: string;
  symbol?: string;
  /** Decimal places, clamped to 0–20; defaults to 2. */
  precision?: number;
  /** percent: 25 → 25%; fraction: 0.25 → 25%. */
  percentScale?: 'percent' | 'fraction';
  size?: number;
  width?: number;
  status?: 'normal' | 'exception' | 'success' | 'active';
  showInfo?: boolean;
  strokeColor?: string;
}

export interface ValueDisplayProps {
  value: unknown;
  type?: ValueType;
  valueEnum?: Record<string, ValueDisplayEnumItem>;
  options?: ValueDisplayOptions;
  emptyText?: string;
  copyable?: boolean;
  copyMode?: 'raw' | 'display';
}
