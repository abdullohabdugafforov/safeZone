import { createDefaultPolicyDocument } from '@safekid/shared';
import request from 'supertest';

import { clearOutbox, createTestApp, resetState, type TestContext } from './app.js';
import {
  createChild,
  linkDevice,
  setupParent,
  type LinkedDevice,
  type Parent,
} from './fixtures.js';

const allowlist = {
  ...createDefaultPolicyDocument('Asia/Tashkent'),
  mode: 'allowlist',
  allowedApps: ['com.duolingo'],
};

describe('policies (e2e)', () => {
  let ctx: TestContext;
  let alice: Parent;
  let bob: Parent;
  let device: LinkedDevice;
  let childId: string;
  const http = () => request(ctx.app.getHttpServer());
  const put = (body: object, parent = alice) =>
    http().put(`/v1/children/${childId}/policy`).set(parent.auth).send(body);

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetState(ctx);
    alice = await setupParent(ctx, '+998901111111');
    bob = await setupParent(ctx, '+998902222222');
    childId = await createChild(ctx, alice);
    device = await linkDevice(ctx, alice, childId);
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

  it('returns the default policy', async () => {
    const res = await http().get(`/v1/children/${childId}/policy`).set(alice.auth).expect(200);
    expect(res.body).toMatchObject({
      childId,
      version: 1,
      document: { mode: 'unrestricted', lock: { state: 'unlocked' } },
    });
  });

  it('creates a new version and pings the device with a high-priority sync', async () => {
    const res = await put({ baseVersion: 1, document: allowlist }).expect(200);
    expect(res.body).toMatchObject({
      version: 2,
      document: { mode: 'allowlist', allowedApps: ['com.duolingo'] },
    });
    expect(ctx.push.sent).toEqual([
      { token: 'device-fcm', data: { type: 'sync' }, highPriority: true },
    ]);

    const versions = await http()
      .get(`/v1/children/${childId}/policy/versions`)
      .set(alice.auth)
      .expect(200);
    expect(versions.body.map((v: { version: number }) => v.version)).toEqual([2, 1]);
  });

  it('rejects stale base versions (optimistic concurrency)', async () => {
    await put({ baseVersion: 1, document: allowlist }).expect(200);
    const res = await put({ baseVersion: 1, document: allowlist }).expect(409);
    expect(res.body.error).toMatchObject({
      code: 'POLICY_VERSION_CONFLICT',
      details: { currentVersion: 2 },
    });
  });

  it('validates the document', async () => {
    await put({ baseVersion: 1, document: { ...allowlist, mode: 'block-everything' } }).expect(400);
    await put({ baseVersion: 1, document: { ...allowlist, allowedApps: ['a', 'a'] } }).expect(400);
    await put({ document: allowlist }).expect(400);
  });

  it("other parents can't read or change the policy", async () => {
    await http().get(`/v1/children/${childId}/policy`).set(bob.auth).expect(404);
    await put({ baseVersion: 1, document: allowlist }, bob).expect(404);
    await http().post(`/v1/children/${childId}/lock`).set(bob.auth).send({}).expect(404);
    await http().post(`/v1/children/${childId}/unlock`).set(bob.auth).expect(404);
    await http().get(`/v1/children/${childId}/policy/versions`).set(bob.auth).expect(404);
    await http().get(`/v1/children/${childId}/policy`).set(device.auth).expect(401);
    expect(ctx.push.sent).toEqual([]);
  });

  it('lock and unlock are durable policy versions', async () => {
    const until = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const locked = await http()
      .post(`/v1/children/${childId}/lock`)
      .set(alice.auth)
      .send({ until })
      .expect(200);
    expect(locked.body).toMatchObject({
      version: 2,
      document: { lock: { state: 'locked', until } },
    });
    const unlocked = await http()
      .post(`/v1/children/${childId}/unlock`)
      .set(alice.auth)
      .expect(200);
    expect(unlocked.body).toMatchObject({ version: 3, document: { lock: { state: 'unlocked' } } });
    await http()
      .post(`/v1/children/${childId}/lock`)
      .set(alice.auth)
      .send({ until: '2001-01-01T00:00:00Z' })
      .expect(400);
  });

  describe('device sync', () => {
    it('device pulls the latest policy and acks it', async () => {
      await put({ baseVersion: 1, document: allowlist }).expect(200);
      const state = await http().get('/v1/device/state').set(device.auth).expect(200);
      expect(state.body).toMatchObject({
        policy: { version: 2, document: { mode: 'allowlist' } },
        pendingCommands: [],
      });

      await http().post('/v1/device/policy/ack').set(device.auth).send({ version: 2 }).expect(204);
      await http().post('/v1/device/policy/ack').set(device.auth).send({ version: 3 }).expect(400);
      const seen = await http().get(`/v1/devices/${device.deviceId}`).set(alice.auth).expect(200);
      expect(seen.body.appliedPolicyVersion).toBe(2);
    });

    it("a device only ever sees its own child's policy", async () => {
      const bobChild = await createChild(ctx, bob, 'Bobby');
      await http()
        .put(`/v1/children/${bobChild}/policy`)
        .set(bob.auth)
        .send({ baseVersion: 1, document: allowlist })
        .expect(200);
      const state = await http().get('/v1/device/state').set(device.auth).expect(200);
      expect(state.body.policy).toMatchObject({ childId, version: 1 });
    });
  });

  it('flags a probably-uninstalled app when the device push token is dead', async () => {
    ctx.push.invalidTokens.add('device-fcm');
    await put({ baseVersion: 1, document: allowlist }).expect(200);
    const alerts = await http().get('/v1/alerts').set(alice.auth).expect(200);
    expect(alerts.body).toEqual([
      expect.objectContaining({ type: 'APP_REMOVED_SUSPECTED', deviceId: device.deviceId }),
    ]);
    const row = await ctx.prisma.device.findUniqueOrThrow({ where: { id: device.deviceId } });
    expect(row.pushToken).toBeNull();
  });
});
