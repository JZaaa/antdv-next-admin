import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const script = html.match(/<script id="app-loading-script">([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error('The standalone loading script is missing');

class LoadingElement extends EventTarget {
  dataset: Record<string, string> = {};
  textContent = '';
  hidden = true;
  lang = '';
  remove = vi.fn();
  setAttribute = vi.fn();
}

function setup(
  options: {
    locale?: string;
    theme?: string;
    dark?: boolean;
    blockedStorage?: boolean;
    defaults?: { locale: string; theme: string; personalization: boolean };
  } = {},
) {
  vi.useFakeTimers();
  const loader = new LoadingElement();
  const description = new LoadingElement();
  const retry = new LoadingElement();
  const style = new LoadingElement();
  const elements: Record<string, LoadingElement> = {
    'app-loading': loader,
    'app-loading-description': description,
    'app-loading-retry': retry,
    'app-loading-style': style,
  };
  const window = Object.assign(new EventTarget(), {
    setTimeout,
    clearTimeout,
    matchMedia: () => ({ matches: options.dark ?? false }),
    location: { reload: vi.fn() },
  });
  runInNewContext(script!, {
    window,
    document: {
      getElementById: (id: string) => elements[id],
      querySelector: (selector: string) => ({
        content: selector.includes('app-preference-defaults')
          ? JSON.stringify(
              options.defaults ?? { locale: 'zh-CN', theme: 'system', personalization: true },
            )
          : 'test-project:development:1.0.0:1:',
      }),
    },
    localStorage: {
      getItem(key: string) {
        if (options.blockedStorage) throw new Error('Storage is disabled');
        return key === 'test-project:development:1.0.0:1:app-locale'
          ? options.locale
          : options.theme;
      },
    },
  });
  return { window, loader, description, retry, style };
}

afterEach(() => vi.useRealTimers());

describe('standalone startup loading screen', () => {
  it('uses code defaults with no saved preference', () => {
    const { loader, description } = setup({
      defaults: { locale: 'en-US', theme: 'dark', personalization: true },
    });
    expect(loader.dataset.theme).toBe('dark');
    expect(description.textContent).toContain('Loading the application');
  });

  it('ignores old preferences when personalization is disabled', () => {
    const { loader } = setup({
      locale: 'zh-CN',
      theme: 'light',
      defaults: { locale: 'en-US', theme: 'dark', personalization: false },
    });
    expect(loader.lang).toBe('en-US');
    expect(loader.dataset.theme).toBe('dark');
  });

  it('falls back to code defaults for invalid cache values', () => {
    const { loader } = setup({
      locale: 'invalid',
      theme: 'invalid',
      defaults: { locale: 'en-US', theme: 'light', personalization: true },
    });
    expect(loader.lang).toBe('en-US');
    expect(loader.dataset.theme).toBe('light');
  });
  it('works without the application bundle or storage access', () => {
    const { loader, description, retry } = setup({ blockedStorage: true, dark: true });
    expect(loader.dataset.theme).toBe('dark');
    expect(description.textContent).toContain('正在加载');
    expect(retry.hidden).toBe(true);
  });

  it('honors saved language and explicit light mode over the system theme', () => {
    const { loader, description, retry } = setup({ locale: 'en-US', theme: 'light', dark: true });
    expect(loader.dataset.theme).toBe('light');
    expect(loader.lang).toBe('en-US');
    expect(description.textContent).toContain('Loading the application');
    expect(retry.textContent).toBe('Reload and retry');
  });

  it('offers a retry for slow loads but still exits when startup eventually completes', () => {
    const { window, loader, description, retry, style } = setup();
    vi.advanceTimersByTime(15000);
    expect(description.textContent).toContain('加载时间较长');
    expect(retry.hidden).toBe(false);
    retry.dispatchEvent(new Event('click'));
    expect(window.location.reload).toHaveBeenCalledOnce();
    window.dispatchEvent(new Event('app:ready'));
    expect(loader.dataset.state).toBe('ready');
    vi.advanceTimersByTime(240);
    expect(loader.remove).toHaveBeenCalledOnce();
    expect(style.remove).toHaveBeenCalledOnce();
  });

  it.each(['app:bootstrap-error', 'unhandledrejection', 'error'])(
    'shows a persistent retry state for %s during startup',
    (event) => {
      const { window, loader, description, retry } = setup();
      window.dispatchEvent(new Event(event));
      vi.advanceTimersByTime(15000);
      expect(loader.dataset.state).toBe('error');
      expect(description.textContent).toContain('系统加载失败');
      expect(retry.hidden).toBe(false);
    },
  );

  it.each(['SCRIPT', 'LINK', 'IMG'])('handles %s resource failures appropriately', (tagName) => {
    const { window, loader } = setup();
    const event = new Event('error');
    Object.defineProperty(event, 'target', { value: { tagName } });
    window.dispatchEvent(event);
    expect(loader.dataset.state).toBe(tagName === 'IMG' ? undefined : 'error');
  });

  it('cleans up startup listeners and timers before normal application errors occur', () => {
    const { window, loader, retry } = setup();
    window.dispatchEvent(new Event('app:ready'));
    window.dispatchEvent(new Event('error'));
    window.dispatchEvent(new Event('unhandledrejection'));
    vi.advanceTimersByTime(16000);
    expect(loader.dataset.state).toBe('ready');
    expect(retry.hidden).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
