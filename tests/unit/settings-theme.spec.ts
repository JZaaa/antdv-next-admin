import { createPinia, setActivePinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useSettingsStore } from '@/stores/settings';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('settings theme colors', () => {
  it('removes custom inline color variables when switching to a preset', () => {
    const setProperty = vi.fn();
    const removeProperty = vi.fn();
    const setAttribute = vi.fn();
    const removeAttribute = vi.fn();

    vi.stubGlobal('document', {
      documentElement: {
        setAttribute,
        removeAttribute,
        style: { setProperty, removeProperty },
      },
    });
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    setActivePinia(createPinia());

    const store = useSettingsStore();
    store.setCustomPrimaryColor('#ff00aa');
    removeProperty.mockClear();

    store.setPrimaryColor('green');

    expect(removeProperty.mock.calls.map(([property]) => property)).toEqual([
      '--color-primary',
      ...Array.from({ length: 10 }, (_, index) => `--color-primary-${index + 1}`),
      ...['color-primary', 'color-primary-5'].flatMap((name) =>
        ['r', 'g', 'b', 'rgb', 'alpha'].map((channel) => `--${name}-${channel}`),
      ),
    ]);
    expect(setAttribute).toHaveBeenLastCalledWith('data-primary-color', 'green');
    expect(setProperty).toHaveBeenLastCalledWith('--ant-primary-color', '#52c41a');
    expect(store.customPrimaryColor).toBe('');
    expect(store.primaryColorHex).toBe('#52c41a');
  });

  it('updates custom primary and accent channels along with their colors', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('document', {
      documentElement: {
        removeAttribute: vi.fn(),
        style: { setProperty: (key: string, value: string) => values.set(key, value) },
      },
    });
    vi.stubGlobal('localStorage', { setItem: vi.fn() });
    setActivePinia(createPinia());
    const store = useSettingsStore();
    store.setCustomPrimaryColor('#f0a');
    expect(values.get('--color-primary-rgb')).toBe('255, 0, 170');
    expect(values.get('--color-primary-alpha')).toBe('1');
    expect(values.get('--color-primary-5-rgb')).toBeDefined();
    store.setCustomPrimaryColor('#12345680');
    expect(values.get('--color-primary-rgb')).toBe('18, 52, 86');
    expect(Number(values.get('--color-primary-alpha'))).toBeCloseTo(128 / 255);
    store.setCustomPrimaryColor('invalid');
    expect(store.customPrimaryColor).toBe('#12345680');
  });
});
