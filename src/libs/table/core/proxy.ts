import type { VxeTableGridOptions } from '../types';

export const PROXY_CALLBACKS = [
  'query',
  'querySuccess',
  'queryError',
  'queryAll',
  'queryAllSuccess',
  'queryAllError',
] as const;
/** Rebuilt from source options, never stored back into the public config. */
export function wrapProxy<T>(
  proxy: VxeTableGridOptions<T>['proxyConfig'],
  latest: () => object,
  active: () => boolean = () => true,
): VxeTableGridOptions<T>['proxyConfig'] {
  if (!proxy) return proxy;
  const ajax = { ...proxy.ajax };
  for (const key of PROXY_CALLBACKS) {
    const callback = ajax[key];
    if (typeof callback !== 'function') continue;
    const fn = callback as (...args: unknown[]) => unknown;
    Object.assign(ajax, {
      [key]: async function (this: unknown, params: unknown, custom: unknown, ...args: unknown[]) {
        if (!active() && key !== 'query' && key !== 'queryAll') return;
        const values =
          custom &&
          typeof custom === 'object' &&
          !(typeof Event !== 'undefined' && custom instanceof Event)
            ? custom
            : {};
        const result = await fn.call(this, params, { ...values, ...latest() }, ...args);
        // Native VXE captures its table before awaiting the request. Rejecting here routes
        // an obsolete result through its error path instead of loading a destroyed table.
        if (!active() && (key === 'query' || key === 'queryAll'))
          throw new Error('VxeGrid unmounted before query completed');
        return result;
      },
    });
  }
  for (const key of ['beforeQuery', 'afterQuery', 'beforeQueryAll', 'afterQueryAll'] as const) {
    const callback = ajax[key];
    if (!callback) continue;
    const fn = callback as (...args: unknown[]) => unknown;
    Object.assign(ajax, {
      [key]: function (this: unknown, ...args: unknown[]) {
        if (!active()) return key.startsWith('before') ? false : undefined;
        return fn.apply(this, args);
      },
    });
  }
  return { ...proxy, enabled: !!proxy.ajax, autoLoad: false, ajax };
}
