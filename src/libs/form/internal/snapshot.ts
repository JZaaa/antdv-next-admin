import dayjs from 'dayjs';

// Boundary snapshots preserve supported form values; field updates never clone the whole model.
export function snapshotFormValue<T>(value: T): T {
  const copies = new WeakMap<object, object>();
  const ancestors = new WeakSet<object>();
  function copy(input: unknown): unknown {
    if (typeof input === 'function' || typeof input === 'symbol') {
      throw new TypeError('Form values cannot contain functions or symbols');
    }
    if (input === null || typeof input !== 'object') return input;
    if (ancestors.has(input)) throw new TypeError('Form values cannot contain cycles');
    const existing = copies.get(input);
    if (existing) return existing;
    if (dayjs.isDayjs(input)) {
      const result = input.clone();
      copies.set(input, result);
      return result;
    }
    if (input instanceof Date) {
      const result = new Date(input.getTime());
      copies.set(input, result);
      copyProperties(input, result);
      return result;
    }
    if (typeof File !== 'undefined' && input instanceof File) {
      const result = new File([input], input.name, {
        type: input.type,
        lastModified: input.lastModified,
      });
      copies.set(input, result);
      copyProperties(input, result, true);
      return result;
    }
    if (typeof Blob !== 'undefined' && input instanceof Blob) {
      const result = input.slice(0, input.size, input.type);
      copies.set(input, result);
      copyProperties(input, result, true);
      return result;
    }
    const prototype: unknown = Object.getPrototypeOf(input);
    if (!Array.isArray(input) && prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Unsupported form value class; use an explicit codec');
    }
    const result: object = Array.isArray(input)
      ? new Array(input.length)
      : Object.create(prototype === null ? null : Object.prototype);
    copies.set(input, result);
    copyProperties(input, result);
    return result;
  }
  function copyProperties(input: object, result: object, binary = false): void {
    ancestors.add(input);
    // File/Blob symbol slots are platform internals recreated by their constructors.
    // Their supported application metadata consists of own string properties (e.g. Upload uid).
    for (const key of binary ? Object.getOwnPropertyNames(input) : Reflect.ownKeys(input)) {
      if (Array.isArray(input) && key === 'length') continue;
      if (typeof key === 'symbol') throw new TypeError('Form values cannot contain symbol keys');
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!descriptor || !('value' in descriptor))
        throw new TypeError('Form values cannot contain accessors');
      Object.defineProperty(result, key, {
        value: copy(descriptor.value),
        enumerable: descriptor.enumerable,
        configurable: true,
        writable: true,
      });
    }
    ancestors.delete(input);
  }
  // Every accepted branch preserves its value type; unsupported values throw rather than degrade.
  return copy(value) as T;
}
