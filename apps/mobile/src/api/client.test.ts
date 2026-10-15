import { tokenPairSchema } from '@safekid/shared';
import { z } from 'zod';

import { ApiError, createApiClient, singleFlight, type AuthProvider } from './client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('api client', () => {
  it('sends JSON with the bearer token and validates the response', async () => {
    const fetchMock = jest.fn().mockResolvedValue(json(200, { status: 'ok' }));
    const api = createApiClient('http://api', fetchMock);
    const auth: AuthProvider = { getAccessToken: async () => 'tok', refresh: async () => null };

    const result = await api.post('/x', {
      body: { a: 1 },
      schema: z.object({ status: z.literal('ok') }),
      auth,
    });

    expect(result).toEqual({ status: 'ok' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api/v1/x');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.body).toBe('{"a":1}');
  });

  it('maps server errors to ApiError with the server code', async () => {
    const api = createApiClient(
      'http://api',
      jest.fn().mockResolvedValue(
        json(429, {
          error: { code: 'RATE_LIMITED', message: 'Too many', details: { retryAfterSeconds: 30 } },
        }),
      ),
    );
    await expect(api.get('/x')).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      details: { retryAfterSeconds: 30 },
    });
  });

  it('reports network failures as NETWORK_ERROR', async () => {
    const api = createApiClient(
      'http://api',
      jest.fn().mockRejectedValue(new TypeError('offline')),
    );
    await expect(api.get('/x')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });

  it('rejects responses that do not match the schema', async () => {
    const api = createApiClient(
      'http://api',
      jest.fn().mockResolvedValue(json(200, { nope: true })),
    );
    await expect(api.get('/x', { schema: tokenPairSchema })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } }))
      .mockResolvedValueOnce(json(200, {}));
    const refresh = jest.fn().mockResolvedValue('new-token');
    const api = createApiClient('http://api', fetchMock);

    await api.get('/x', { auth: { getAccessToken: async () => 'old', refresh } });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer new-token');
  });

  it('surfaces 401 when refresh fails', async () => {
    const api = createApiClient(
      'http://api',
      jest.fn().mockResolvedValue(json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } })),
    );
    await expect(
      api.get('/x', { auth: { getAccessToken: async () => 'old', refresh: async () => null } }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe('singleFlight', () => {
  it('shares one in-flight call between concurrent callers', async () => {
    let resolve!: (v: string) => void;
    const fn = jest.fn(() => new Promise<string>((r) => (resolve = r)));
    const once = singleFlight(fn);
    const a = once();
    const b = once();
    resolve('token');
    await expect(Promise.all([a, b])).resolves.toEqual(['token', 'token']);
    expect(fn).toHaveBeenCalledTimes(1);
    void once();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
