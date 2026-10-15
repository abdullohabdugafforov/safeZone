import type { AddressInfo } from 'node:net';

import { REALTIME_NAMESPACE } from '@safekid/shared';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';

import { createTestApp, resetState, type TestContext } from './app.js';
import { createChild, DEVICE_INFO, linkDevice, setupParent, type Parent } from './fixtures.js';

describe('realtime (e2e)', () => {
  let ctx: TestContext;
  let url: string;
  let alice: Parent;
  const sockets: Socket[] = [];

  const connect = (token: string) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = io(`${url}${REALTIME_NAMESPACE}`, {
        auth: { token },
        transports: ['websocket'],
        forceNew: true,
      });
      sockets.push(socket);
      socket.once('ready', () => resolve(socket));
      socket.once('disconnect', () => reject(new Error('disconnected')));
      socket.once('connect_error', reject);
    });
  const nextEvent = (socket: Socket) =>
    new Promise<unknown>((resolve) => socket.once('event', resolve));

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.listen(0);
    url = `http://127.0.0.1:${(ctx.app.getHttpServer().address() as AddressInfo).port}`;
  });
  beforeEach(async () => {
    await resetState(ctx);
    alice = await setupParent(ctx, '+998901111111');
  });
  afterEach(() => {
    sockets.splice(0).forEach((s) => s.disconnect());
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('parents get pairing requests for their family in realtime', async () => {
    const socket = await connect(alice.auth.Authorization.slice('Bearer '.length));
    const event = nextEvent(socket);
    const code = await request(ctx.app.getHttpServer())
      .post(`/v1/families/${alice.familyId}/pairing-codes`)
      .set(alice.auth)
      .send({})
      .expect(201);
    const req = await request(ctx.app.getHttpServer())
      .post('/v1/pairing/requests')
      .send({ method: 'code', code: code.body.code, device: DEVICE_INFO })
      .expect(201);
    expect(await event).toEqual({ type: 'pairing.requested', requestId: req.body.requestId });
  });

  it('devices get sync hints on policy change', async () => {
    const childId = await createChild(ctx, alice);
    const device = await linkDevice(ctx, alice, childId);
    const socket = await connect(device.auth.Authorization.slice('Bearer '.length));
    const event = nextEvent(socket);
    await request(ctx.app.getHttpServer())
      .post(`/v1/children/${childId}/lock`)
      .set(alice.auth)
      .send({})
      .expect(200);
    expect(await event).toEqual({ type: 'sync' });
  });

  it('rejects connections without a valid token', async () => {
    await expect(connect('garbage')).rejects.toThrow();
  });
});
