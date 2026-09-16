import type { FormFieldSchema, FormSchema } from '../types';

import { snapshotFormValue } from '../internal/snapshot';

export const clone = snapshotFormValue;
export function isPlain(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}
export function segments(name: string): string[] {
  const path =
    name.startsWith('[') && name.endsWith(']')
      ? [name.slice(1, -1)]
      : (name.match(/[^.[\]]+/g) ?? []);
  if (!path.length || path.some((key) => ['__proto__', 'constructor', 'prototype'].includes(key)))
    throw new TypeError(`Invalid form field path: ${name}`);
  return path;
}
export function getValue(value: unknown, name: string): unknown {
  let cursor = value;
  for (const key of segments(name)) {
    if (!cursor || typeof cursor !== 'object' || !Object.hasOwn(cursor, key)) return undefined;
    cursor = Reflect.get(cursor, key);
  }
  return cursor;
}
export function setValue(values: Record<string, unknown>, name: string, value: unknown): void {
  const path = segments(name);
  let cursor: object = values;
  path.forEach((key, index) => {
    if (index === path.length - 1) {
      Reflect.set(cursor, key, value);
      return;
    }
    let next: unknown = Reflect.get(cursor, key);
    if (!next || typeof next !== 'object') {
      next = /^\d+$/.test(path[index + 1]!) ? [] : {};
      Reflect.set(cursor, key, next);
    }
    cursor = next as object;
  });
}
export function deleteValue(values: Record<string, unknown>, name: string): void {
  const path = segments(name);
  let cursor: unknown = values;
  for (const key of path.slice(0, -1))
    cursor = cursor && typeof cursor === 'object' ? Reflect.get(cursor, key) : undefined;
  if (cursor && typeof cursor === 'object') Reflect.deleteProperty(cursor, path[path.length - 1]!);
}
/** defu semantics: arrays replace, null/undefined fall back. Functions and schemas retain identity. */
export function defaults<T>(patch: T, base: T): T {
  if (patch === undefined || patch === null) return base;
  if (!isPlain(patch) || !isPlain(base)) return patch;
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    result[key] = defaults(value, base[key]);
  }
  return result as T;
}
/** Values differ from configuration: explicit null/undefined overwrite, objects merge, arrays replace. */
export function mergeValues(current: unknown, patch: unknown): unknown {
  if (!isPlain(patch)) return clone(patch);
  const result = isPlain(current) ? clone(current) : {};
  for (const [key, value] of Object.entries(patch)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key))
      throw new TypeError('Unsafe form value key');
    result[key] = mergeValues(result[key], value);
  }
  return result;
}
export function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
  if (Array.isArray(left) && Array.isArray(right))
    return left.length === right.length && left.every((entry, i) => equal(entry, right[i]));
  if (isPlain(left) && isPlain(right)) {
    const keys = Object.keys(left);
    return (
      keys.length === Object.keys(right).length &&
      keys.every((key) => Object.hasOwn(right, key) && equal(left[key], right[key]))
    );
  }
  return false;
}
export function fields<C extends string, P extends object, T extends object>(
  schema: FormSchema<C, P, T>[],
): FormFieldSchema<C, P, T>[] {
  return schema.flatMap((item) =>
    'type' in item && item.type === 'group' ? item.children : [item],
  );
}
export function scopeName(rowPath: string | undefined, fieldName: string): string {
  if (!rowPath) return fieldName;
  if (fieldName.startsWith('$root.')) return fieldName.slice(6);
  if (fieldName.startsWith('$row.')) return `${rowPath}.${fieldName.slice(5)}`;
  return fieldName === rowPath || fieldName.startsWith(`${rowPath}.`)
    ? fieldName
    : `${rowPath}.${fieldName}`;
}
export function childUpdateName(parent: string, name: string): string | undefined {
  if (name.startsWith(`${parent}.`)) return name.slice(parent.length + 1);
  if (name.startsWith(`${parent}[`)) {
    const end = name.indexOf(']', parent.length + 1);
    if (name[end + 1] === '.') return name.slice(end + 2);
  }
  return undefined;
}
export function arrayChildren<T extends object>(
  schema: FormFieldSchema<string, Record<never, never>, T>,
  resolvedProps?: Record<string, unknown>,
): FormFieldSchema<string, Record<never, never>, T>[] {
  if ('children' in schema) return schema.children;
  const props = resolvedProps ?? schema.componentProps;
  return props && typeof props !== 'function' && Array.isArray(props.schema)
    ? (props.schema as FormFieldSchema<string, Record<never, never>, T>[])
    : [];
}
