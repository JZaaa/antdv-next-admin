import { createPinia, setActivePinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useThemeStore } from '@/stores/theme';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('theme transitions without modern browser APIs', () => {
  it.each([false, true])('applies the theme with reduced motion = %s', (reducedMotion) => {
    vi.useFakeTimers();
    const classes = new Set<string>();
    const startViewTransition = vi.fn();
    vi.stubGlobal('document', {
      ...(reducedMotion ? { startViewTransition } : {}),
      documentElement: {
        offsetWidth: 100,
        classList: {
          add: (name: string) => classes.add(name),
          remove: (name: string) => classes.delete(name),
          toggle: (name: string, enabled: boolean) =>
            enabled ? classes.add(name) : classes.delete(name),
        },
      },
    });
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: reducedMotion }),
      setTimeout,
      clearTimeout,
    });
    vi.stubGlobal('localStorage', { setItem: vi.fn() });
    setActivePinia(createPinia());
    const store = useThemeStore();
    store.setTheme('dark', { origin: { x: 20, y: 20 } });
    expect(classes.has('dark')).toBe(true);
    expect(store.isDark).toBe(true);
    expect(startViewTransition).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(classes.has('theme-transition')).toBe(false);
    store.setTheme('light');
    expect(classes.has('dark')).toBe(false);
  });
});
