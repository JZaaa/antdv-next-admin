import { isRef } from 'vue';

function plain(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !isRef(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}

/** Config defaults: arrays retain identity, null/undefined fall back; row data is never cloned. */
export function mergeConfig<T>(patch: Partial<T>, previous: T): T {
  if (!plain(patch) || !plain(previous)) return (patch ?? previous) as T;
  const result: Record<string, unknown> = { ...previous };
  for (const [key, value] of Object.entries(patch)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (value == null) continue;
    result[key] = plain(value) && plain(previous[key]) ? mergeConfig(value, previous[key]) : value;
  }
  return result as T;
}
