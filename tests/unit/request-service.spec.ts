import type { AxiosError } from 'axios';

import AxiosMockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { clearSessionState, push, refreshToken } = vi.hoisted(() => ({
  clearSessionState: vi.fn(),
  push: vi.fn(),
  refreshToken: vi.fn(),
}));

vi.mock('antdv-next', () => ({
  message: {
    error: vi.fn(),
  },
}));

vi.mock('@/router', () => ({
  default: {
    push,
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    refreshToken,
    token: null,
  }),
}));

vi.mock('@/utils/session', () => ({
  clearSessionState,
}));

import { request, service } from '@/utils/request';

const originalAdapter = service.defaults.adapter;

describe('request service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.defaults.adapter = originalAdapter;
  });

  it('exports the axios instance used by request helpers', () => {
    expect(service.defaults.timeout).toBe(15000);
    expect(service.defaults.headers['Content-Type']).toBe('application/json');
  });

  it.each(['get', 'post', 'put', 'delete', 'patch'] as const)(
    '%s returns the API payload without an extra response envelope',
    async (method) => {
      const payload = { code: 200, data: { id: 'example' } };
      const mock = new AxiosMockAdapter(service);
      mock.onAny('/example').reply(200, payload);

      await expect(request[method]<typeof payload>('/example')).resolves.toEqual(payload);
    },
  );

  it('preserves the standard Axios response on the exported service', async () => {
    const payload = { code: 200, data: { id: 'example' } };
    const mock = new AxiosMockAdapter(service);
    mock.onGet('/example').reply(200, payload);

    const response = await service.get<typeof payload>('/example');

    expect(response.status).toBe(200);
    expect(response.data).toEqual(payload);
  });

  it('still rejects business errors after a successful HTTP response', async () => {
    const mock = new AxiosMockAdapter(service);
    mock.onPost('/example').reply(200, { code: 500, message: 'Business failure' });

    await expect(
      request.post('/example', { name: 'test' }, { skipErrorMessage: true }),
    ).rejects.toThrow('Business failure');
    expect(refreshToken).not.toHaveBeenCalled();
  });

  it('shares token refresh and unwraps both retried responses exactly once', async () => {
    const mock = new AxiosMockAdapter(service);
    let finishRefresh: (token: string) => void = () => {
      throw new Error('Refresh promise was not initialized');
    };
    refreshToken.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        finishRefresh = resolve;
      }),
    );
    for (const url of ['/first', '/second']) {
      mock.onGet(url).replyOnce(401);
      mock
        .onGet(url)
        .reply((config) => [
          200,
          { code: 200, data: { authorization: config.headers?.Authorization } },
        ]);
    }

    const responses = Promise.all([request.get('/first'), request.get('/second')]);
    await vi.waitFor(() => {
      expect(mock.history.get).toHaveLength(2);
      expect(refreshToken).toHaveBeenCalledOnce();
    });
    finishRefresh('fresh-token');

    await expect(responses).resolves.toEqual([
      { code: 200, data: { authorization: 'Bearer fresh-token' } },
      { code: 200, data: { authorization: 'Bearer fresh-token' } },
    ]);
    expect(refreshToken).toHaveBeenCalledOnce();
    expect(clearSessionState).not.toHaveBeenCalled();
  });

  it('does not refresh again when a retried request is still unauthorized', async () => {
    const mock = new AxiosMockAdapter(service);
    mock.onGet('/protected').reply(401);
    refreshToken.mockResolvedValueOnce('fresh-token');

    await expect(
      request.get('/protected', { skipErrorMessage: true, skipRedirect: true }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    expect(refreshToken).toHaveBeenCalledOnce();
    expect(mock.history.get).toHaveLength(2);
  });

  it('clears the complete session when token refresh fails', async () => {
    const refreshError = new Error('refresh failed');
    refreshToken.mockRejectedValueOnce(refreshError);
    service.defaults.adapter = async (config) => {
      throw {
        config,
        response: { status: 401 },
      } as AxiosError;
    };

    await expect(
      service.get('/protected', {
        skipErrorMessage: true,
      }),
    ).rejects.toBe(refreshError);

    expect(clearSessionState).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith('/login');
  });
});
