import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const addCollection = vi.hoisted(() => vi.fn(() => true));
vi.mock('@iconify/vue', () => ({ addCollection }));

const mdi = { prefix: 'mdi', icons: { home: { body: '<path d="M0 0"/>' } } };

describe('local icon collection assets', () => {
  beforeEach(() => {
    vi.resetModules();
    addCollection.mockReset().mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads only the requested shard and shares concurrent and subsequent requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => mdi });
    vi.stubGlobal('fetch', fetchMock);
    const { loadLocalIconifyIcon } = await import('@/utils/iconify');
    expect(fetchMock).not.toHaveBeenCalled();
    const first = loadLocalIconifyIcon('mdi', 'home');
    const second = loadLocalIconifyIcon('mdi', 'home');
    expect(first).toBe(second);
    expect(await first).toEqual(mdi);
    expect(await loadLocalIconifyIcon('mdi', 'home')).toEqual(mdi);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toMatch(/\.json$/);
    expect(addCollection).toHaveBeenCalledExactlyOnceWith(mdi);
  });

  it('retries a failed HTTP request instead of caching its rejection', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => mdi });
    vi.stubGlobal('fetch', fetchMock);
    const { loadLocalIconifyIcon } = await import('@/utils/iconify');
    await expect(loadLocalIconifyIcon('mdi', 'home')).rejects.toThrow('HTTP 503');
    expect(addCollection).not.toHaveBeenCalled();
    await expect(loadLocalIconifyIcon('mdi', 'home')).resolves.toEqual(mdi);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reuses ordinary icon shards when the full picker catalogue is opened', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => mdi });
    vi.stubGlobal('fetch', fetchMock);
    const { loadLocalIconifyIcon, loadLocalIconifySet } = await import('@/utils/iconify');
    const { localIconAssets } = await import('virtual:local-icon-assets');
    await loadLocalIconifyIcon('mdi', 'home');
    await Promise.all([loadLocalIconifySet('mdi'), loadLocalIconifySet('mdi')]);
    await loadLocalIconifyIcon('mdi', 'home');
    expect(fetchMock).toHaveBeenCalledTimes(localIconAssets.mdi!.filter(Boolean).length);
    expect(new Set(fetchMock.mock.calls.map(([url]) => url)).size).toBe(
      fetchMock.mock.calls.length,
    );
  });

  it('rejects a collection with the wrong prefix before registering it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...mdi, prefix: 'ri' }),
      }),
    );
    const { loadLocalIconifyIcon } = await import('@/utils/iconify');
    await expect(loadLocalIconifyIcon('mdi', 'home')).rejects.toThrow(
      'Invalid mdi icon collection',
    );
    expect(addCollection).not.toHaveBeenCalled();
  });

  it('rejects invalid icon data when Iconify refuses to register it', async () => {
    addCollection.mockReturnValue(false);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => mdi }));
    const { loadLocalIconifyIcon } = await import('@/utils/iconify');
    await expect(loadLocalIconifyIcon('mdi', 'home')).rejects.toThrow(
      'Invalid mdi icon collection',
    );
  });
});
