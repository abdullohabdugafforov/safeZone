import request from 'supertest';

import { createTestApp, type TestContext } from './app.js';

describe('health & error format (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /v1/health reports ok', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/v1/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('unknown routes use the standard error shape', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/v1/nope').expect(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  it('sets security headers', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
