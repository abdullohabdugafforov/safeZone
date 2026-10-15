import { PAIRING_CODE_TTL_SECONDS } from '@safekid/shared';
import request from 'supertest';

import { PAIRING_LIMITS } from '../src/pairing/pairing.service.js';
import { createTestApp, resetState, type TestContext } from './app.js';
import { createChild, DEVICE_INFO, linkDevice, setupParent, type Parent } from './fixtures.js';

describe('pairing (e2e)', () => {
  let ctx: TestContext;
  let alice: Parent;
  let bob: Parent;
  let childId: string;
  const http = () => request(ctx.app.getHttpServer());

  const newCode = async (parent = alice, body: object = { childId }) =>
    (
      await http()
        .post(`/v1/families/${parent.familyId}/pairing-codes`)
        .set(parent.auth)
        .send(body)
        .expect(201)
    ).body as { id: string; code: string; qrPayload: string; expiresAt: string };

  const submit = async (code: string) =>
    (
      await http()
        .post('/v1/pairing/requests')
        .send({ method: 'code', code, device: DEVICE_INFO })
        .expect(201)
    ).body as { requestId: string; claimSecret: string };

  const status = (requestId: string, claimSecret: string) =>
    http().post(`/v1/pairing/requests/${requestId}/status`).send({ claimSecret });
  const claim = (requestId: string, claimSecret: string) =>
    http().post(`/v1/pairing/requests/${requestId}/claim`).send({ claimSecret });
  const approve = (requestId: string, body: object = { childId }, parent = alice) =>
    http().post(`/v1/pairing/requests/${requestId}/approve`).set(parent.auth).send(body);

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetState(ctx);
    alice = await setupParent(ctx, '+998901111111');
    bob = await setupParent(ctx, '+998902222222');
    childId = await createChild(ctx, alice);
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  describe('codes', () => {
    it('issues a 6-digit code with QR payload valid for 10 minutes', async () => {
      const code = await newCode();
      expect(code.code).toMatch(/^\d{6}$/);
      expect(code.qrPayload).toBe(`safekid://pair?code=${code.code}`);
      const ttl = (Date.parse(code.expiresAt) - Date.now()) / 1000;
      expect(ttl).toBeGreaterThan(PAIRING_CODE_TTL_SECONDS - 5);
      expect(ttl).toBeLessThanOrEqual(PAIRING_CODE_TTL_SECONDS);
      const row = await ctx.prisma.pairingCode.findUniqueOrThrow({ where: { id: code.id } });
      expect(row.codeHash).not.toContain(code.code);
    });

    it("cannot be issued for another family or another family's child", async () => {
      await http()
        .post(`/v1/families/${alice.familyId}/pairing-codes`)
        .set(bob.auth)
        .send({})
        .expect(404);
      await http()
        .post(`/v1/families/${bob.familyId}/pairing-codes`)
        .set(bob.auth)
        .send({ childId })
        .expect(404);
    });

    it('a new code replaces the previous one', async () => {
      const first = await newCode();
      await newCode();
      const res = await http()
        .post('/v1/pairing/requests')
        .send({ method: 'code', code: first.code, device: DEVICE_INFO })
        .expect(400);
      expect(res.body.error.code).toBe('PAIRING_CODE_INVALID');
    });

    it('rejects expired and revoked codes', async () => {
      const code = await newCode();
      await ctx.prisma.pairingCode.update({
        where: { id: code.id },
        data: { expiresAt: new Date(Date.now() - 1) },
      });
      await http()
        .post('/v1/pairing/requests')
        .send({ method: 'code', code: code.code, device: DEVICE_INFO })
        .expect(400);

      const fresh = await newCode();
      await http().delete(`/v1/pairing-codes/${fresh.id}`).set(bob.auth).expect(404);
      await http().delete(`/v1/pairing-codes/${fresh.id}`).set(alice.auth).expect(204);
      await http()
        .post('/v1/pairing/requests')
        .send({ method: 'code', code: fresh.code, device: DEVICE_INFO })
        .expect(400);
    });
  });

  describe('approval is mandatory', () => {
    it('claim fails while pending and does not create a device', async () => {
      const { requestId, claimSecret } = await submit((await newCode()).code);
      expect((await status(requestId, claimSecret).expect(200)).body).toEqual({
        status: 'pending',
      });
      const res = await claim(requestId, claimSecret).expect(403);
      expect(res.body.error.code).toBe('PAIRING_NOT_APPROVED');
      expect(await ctx.prisma.device.count()).toBe(0);
      expect(await ctx.prisma.refreshToken.count({ where: { deviceId: { not: null } } })).toBe(0);
    });

    it('rejected requests can never be claimed or approved', async () => {
      const { requestId, claimSecret } = await submit((await newCode()).code);
      await http().post(`/v1/pairing/requests/${requestId}/reject`).set(alice.auth).expect(204);
      expect((await status(requestId, claimSecret).expect(200)).body.status).toBe('rejected');
      expect((await claim(requestId, claimSecret).expect(409)).body.error.code).toBe(
        'PAIRING_REQUEST_CLOSED',
      );
      await approve(requestId).expect(409);
    });

    it('expired requests cannot be approved or claimed', async () => {
      const { requestId, claimSecret } = await submit((await newCode()).code);
      await ctx.prisma.pairingRequest.update({
        where: { id: requestId },
        data: { expiresAt: new Date(Date.now() - 1) },
      });
      expect((await status(requestId, claimSecret).expect(200)).body.status).toBe('expired');
      await approve(requestId).expect(409);
      await claim(requestId, claimSecret).expect(409);
    });

    it('another parent cannot see, approve or reject the request', async () => {
      const { requestId } = await submit((await newCode()).code);
      expect((await http().get('/v1/pairing/requests').set(bob.auth).expect(200)).body).toEqual([]);
      await approve(requestId, { newChildName: 'Mine now' }, bob).expect(404);
      await http().post(`/v1/pairing/requests/${requestId}/reject`).set(bob.auth).expect(404);
      expect(await ctx.prisma.device.count()).toBe(0);
    });

    it("cannot attach the device to another family's child", async () => {
      const bobChild = await createChild(ctx, bob, 'Bobby');
      const { requestId } = await submit((await newCode()).code);
      await approve(requestId, { childId: bobChild }).expect(404);
      expect(await ctx.prisma.device.count()).toBe(0);
    });
  });

  describe('happy path', () => {
    it('code -> request -> approve -> claim issues device credentials once', async () => {
      const code = await newCode();
      const { requestId, claimSecret } = await submit(code.code);

      const pending = await http().get('/v1/pairing/requests').set(alice.auth).expect(200);
      expect(pending.body).toEqual([
        expect.objectContaining({
          id: requestId,
          method: 'code',
          childId,
          status: 'pending',
          device: DEVICE_INFO,
        }),
      ]);
      expect(JSON.stringify(pending.body)).not.toContain(claimSecret);

      const approved = await approve(requestId).expect(200);
      expect(approved.body).toEqual({ deviceId: expect.any(String), childId });
      await approve(requestId).expect(409);

      expect((await status(requestId, claimSecret).expect(200)).body.status).toBe('approved');
      const claimed = await claim(requestId, claimSecret).expect(200);
      expect(claimed.body).toMatchObject({
        deviceId: approved.body.deviceId,
        childId,
        childName: 'Ali',
        policy: {
          childId,
          version: 1,
          document: expect.objectContaining({ mode: 'unrestricted' }),
        },
      });

      // single use: second claim fails, code is burnt
      await claim(requestId, claimSecret).expect(409);
      await http()
        .post('/v1/pairing/requests')
        .send({ method: 'code', code: code.code, device: DEVICE_INFO })
        .expect(400);

      // device refresh token works and rotates
      const refreshed = await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: claimed.body.tokens.refreshToken })
        .expect(200);
      expect(refreshed.body.refreshToken).not.toBe(claimed.body.tokens.refreshToken);
    });

    it('can create a new child at approval time', async () => {
      const { requestId } = await submit((await newCode(alice, {})).code);
      const res = await approve(requestId, { newChildName: 'Zarina' }).expect(200);
      const child = await ctx.prisma.child.findUniqueOrThrow({ where: { id: res.body.childId } });
      expect(child).toMatchObject({ name: 'Zarina', familyId: alice.familyId });
    });

    it('audits approval and claim', async () => {
      const { deviceId } = await linkDevice(ctx, alice, childId);
      const actions = (
        await ctx.prisma.auditLog.findMany({ where: { familyId: alice.familyId } })
      ).map((a) => a.action);
      expect(actions).toEqual(
        expect.arrayContaining(['pairing.requested', 'pairing.approved', 'pairing.claimed']),
      );
      expect(await ctx.prisma.device.findUnique({ where: { id: deviceId } })).not.toBeNull();
    });
  });

  describe('claim secret', () => {
    it('wrong secret looks like not found', async () => {
      const { requestId } = await submit((await newCode()).code);
      await approve(requestId).expect(200);
      const wrong = 'x'.repeat(43);
      await status(requestId, wrong).expect(404);
      await claim(requestId, wrong).expect(404);
    });
  });

  describe('phone method', () => {
    it('reaches the parent by phone', async () => {
      const res = await http()
        .post('/v1/pairing/requests')
        .send({ method: 'phone', parentPhone: '90 111 11 11', device: DEVICE_INFO })
        .expect(201);
      const pending = await http().get('/v1/pairing/requests').set(alice.auth).expect(200);
      expect(pending.body).toEqual([
        expect.objectContaining({ id: res.body.requestId, method: 'phone', childId: null }),
      ]);
    });

    it('unknown phone gets an identical-looking response that never resolves', async () => {
      const res = await http()
        .post('/v1/pairing/requests')
        .send({ method: 'phone', parentPhone: '+998935555555', device: DEVICE_INFO })
        .expect(201);
      expect(Object.keys(res.body).sort()).toEqual(['claimSecret', 'expiresAt', 'requestId']);
      expect((await status(res.body.requestId, res.body.claimSecret).expect(200)).body.status).toBe(
        'pending',
      );
      for (const parent of [alice, bob]) {
        expect(
          (await http().get('/v1/pairing/requests').set(parent.auth).expect(200)).body,
        ).toEqual([]);
      }
    });
  });

  describe('rate limits', () => {
    it('limits pairing requests per IP', async () => {
      const { code } = await newCode();
      for (let i = 0; i < PAIRING_LIMITS.requestsPerIpPerHour; i++) {
        await http()
          .post('/v1/pairing/requests')
          .send({ method: 'code', code: '000000', device: DEVICE_INFO });
      }
      await http()
        .post('/v1/pairing/requests')
        .send({ method: 'code', code, device: DEVICE_INFO })
        .expect(429);
    });
  });
});
