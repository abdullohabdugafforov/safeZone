import request from 'supertest';

import { CommandsService } from '../src/commands/commands.service.js';
import { clearOutbox, createTestApp, resetState, type TestContext } from './app.js';
import {
  createChild,
  linkDevice,
  setupParent,
  type LinkedDevice,
  type Parent,
} from './fixtures.js';

describe('commands (e2e)', () => {
  let ctx: TestContext;
  let alice: Parent;
  let bob: Parent;
  let device: LinkedDevice;
  const http = () => request(ctx.app.getHttpServer());
  const send = (body: object, parent = alice, deviceId = device.deviceId) =>
    http().post(`/v1/devices/${deviceId}/commands`).set(parent.auth).send(body);
  const ack = (id: string, body: object, auth = device.auth) =>
    http().post(`/v1/device/commands/${id}/ack`).set(auth).send(body);

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetState(ctx);
    alice = await setupParent(ctx, '+998901111111');
    bob = await setupParent(ctx, '+998902222222');
    device = await linkDevice(ctx, alice, await createChild(ctx, alice));
    await http()
      .put('/v1/device/push-token')
      .set(device.auth)
      .send({ token: 'device-fcm', platform: 'android' })
      .expect(204);
    clearOutbox(ctx);
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('pending -> delivered -> applied, with a push to the device', async () => {
    const created = await send({ type: 'REPORT_APPS', payload: {} }).expect(201);
    expect(created.body).toMatchObject({
      type: 'REPORT_APPS',
      status: 'pending',
      deliveredAt: null,
    });
    expect(ctx.push.sent).toEqual([
      { token: 'device-fcm', data: { type: 'sync' }, highPriority: true },
    ]);

    const beat = await http()
      .post('/v1/device/heartbeat')
      .set(device.auth)
      .send({
        appliedPolicyVersion: 1,
        permissionStatus: {},
        appVersion: '0.1.0',
        enforcementActive: true,
      })
      .expect(200);
    expect(beat.body.hasPendingCommands).toBe(true);

    const state = await http().get('/v1/device/state').set(device.auth).expect(200);
    expect(state.body.pendingCommands).toEqual([
      expect.objectContaining({
        id: created.body.id,
        status: 'delivered',
        deliveredAt: expect.any(String),
      }),
    ]);

    await ack(created.body.id, { status: 'applied' }).expect(204);
    await ack(created.body.id, { status: 'applied' }).expect(204); // idempotent retry
    await ack(created.body.id, { status: 'failed', error: 'late' }).expect(409);

    const history = await http()
      .get(`/v1/devices/${device.deviceId}/commands`)
      .set(alice.auth)
      .expect(200);
    expect(history.body[0]).toMatchObject({ status: 'applied', ackedAt: expect.any(String) });
    expect(
      (await http().get('/v1/device/state').set(device.auth).expect(200)).body.pendingCommands,
    ).toEqual([]);
  });

  it('records failures with an error message', async () => {
    const { body } = await send({ type: 'SYNC_NOW', payload: {} }).expect(201);
    await ack(body.id, { status: 'failed' }).expect(400);
    await ack(body.id, { status: 'failed', error: 'Accessibility service disabled' }).expect(204);
    const row = await ctx.prisma.command.findUniqueOrThrow({ where: { id: body.id } });
    expect(row).toMatchObject({ status: 'failed', error: 'Accessibility service disabled' });
  });

  it('validates command types and payloads', async () => {
    await send({ type: 'WIPE_DEVICE', payload: {} }).expect(400);
    await send({ type: 'SYNC_NOW', payload: { evil: true } }).expect(400);
    await send({ type: 'SYNC_NOW', payload: {}, ttlSeconds: 1 }).expect(400);
  });

  it("other parents can't command or inspect the device", async () => {
    await send({ type: 'SYNC_NOW', payload: {} }, bob).expect(404);
    await http().get(`/v1/devices/${device.deviceId}/commands`).set(bob.auth).expect(404);
    expect(ctx.push.sent).toEqual([]);
  });

  it("a device can't ack another device's command", async () => {
    const other = await linkDevice(ctx, alice, await createChild(ctx, alice, 'Second'));
    const { body } = await send({ type: 'SYNC_NOW', payload: {} }).expect(201);
    await ack(body.id, { status: 'applied' }, other.auth).expect(404);
  });

  it('expires stale commands', async () => {
    const { body } = await send({ type: 'SYNC_NOW', payload: {} }).expect(201);
    const expired = await ctx.app
      .get(CommandsService)
      .expireStale(new Date(Date.now() + 2 * 24 * 3600 * 1000));
    expect(expired).toBe(1);
    await ack(body.id, { status: 'applied' }).expect(409);
  });

  it('refuses commands for unlinked devices', async () => {
    await http().delete(`/v1/devices/${device.deviceId}`).set(alice.auth).expect(204);
    const res = await send({ type: 'SYNC_NOW', payload: {} }).expect(409);
    expect(res.body.error.code).toBe('DEVICE_UNLINKED');
  });
});
