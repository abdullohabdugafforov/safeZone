import request from 'supertest';

import { OTP_LIMITS } from '../src/auth/otp.service.js';
import { TokenService } from '../src/auth/token.service.js';
import { createTestApp, loginParent, resetState, type TestContext } from './app.js';

const PHONE = '+998901234567';

describe('auth (e2e)', () => {
  let ctx: TestContext;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetState(ctx);
    ctx.sms.sent.length = 0;
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const requestOtp = (phone = PHONE) => http().post('/v1/auth/otp/request').send({ phone });
  const verifyOtp = (code: string, phone = PHONE) =>
    http().post('/v1/auth/otp/verify').send({ phone, code });
  const wrongCode = (code: string) => (code === '000000' ? '111111' : '000000');

  describe('OTP request', () => {
    it('normalizes the phone and sends a 6-digit code', async () => {
      const res = await requestOtp('90 123 45 67').expect(200);
      expect(res.body).toEqual({
        expiresInSeconds: OTP_LIMITS.ttlSeconds,
        resendAfterSeconds: OTP_LIMITS.resendCooldownSeconds,
      });
      expect(ctx.sms.sent).toHaveLength(1);
      expect(ctx.sms.lastCodeFor(PHONE)).toMatch(/^\d{6}$/);
    });

    it('stores only a hash of the code', async () => {
      await requestOtp().expect(200);
      const code = ctx.sms.lastCodeFor(PHONE);
      const rows = await ctx.prisma.otpChallenge.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.codeHash).not.toContain(code);
    });

    it('rejects invalid phone numbers', async () => {
      const res = await requestOtp('12345').expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(ctx.sms.sent).toHaveLength(0);
    });

    it('enforces the resend cooldown', async () => {
      await requestOtp().expect(200);
      const res = await requestOtp().expect(429);
      expect(res.body.error.code).toBe('RATE_LIMITED');
      expect(res.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
      expect(ctx.sms.sent).toHaveLength(1);
    });

    it('enforces the hourly per-phone limit', async () => {
      for (let i = 0; i < OTP_LIMITS.perPhonePerHour; i++) {
        await requestOtp().expect(200);
        await ctx.redis.del(`cd:otp:resend:${PHONE}`);
      }
      await requestOtp().expect(429);
    });

    it('enforces the hourly per-IP limit across phones', async () => {
      for (let i = 0; i < OTP_LIMITS.perIpPerHour; i++) {
        await requestOtp(`+99890${String(1000000 + i)}`).expect(200);
      }
      await requestOtp('+998935555555').expect(429);
    });

    it('responds identically for new and existing users', async () => {
      await loginParent(ctx, PHONE);
      await ctx.redis.flushdb();
      const existing = await requestOtp().expect(200);
      const fresh = await requestOtp('+998911111111').expect(200);
      expect(existing.body).toEqual(fresh.body);
    });
  });

  describe('OTP verify', () => {
    it('creates the parent with a family on first login', async () => {
      await requestOtp().expect(200);
      const res = await verifyOtp(ctx.sms.lastCodeFor(PHONE)).expect(200);
      expect(res.body.isNewUser).toBe(true);
      expect(res.body.user).toMatchObject({ phone: PHONE, name: null, locale: 'uz' });
      expect(res.body.tokens).toEqual({
        accessToken: expect.any(String),
        accessTokenExpiresAt: expect.any(String),
        refreshToken: expect.stringMatching(/^rt_/),
      });
      const members = await ctx.prisma.familyMember.findMany({
        where: { userId: res.body.user.id },
      });
      expect(members).toEqual([expect.objectContaining({ role: 'owner' })]);
    });

    it('does not create a second family on later logins', async () => {
      const first = await loginParent(ctx, PHONE);
      await ctx.redis.flushdb();
      await requestOtp().expect(200);
      const res = await verifyOtp(ctx.sms.lastCodeFor(PHONE)).expect(200);
      expect(res.body.isNewUser).toBe(false);
      expect(res.body.user.id).toBe(first.userId);
      expect(await ctx.prisma.family.count()).toBe(1);
    });

    it('rejects a wrong code', async () => {
      await requestOtp().expect(200);
      const res = await verifyOtp(wrongCode(ctx.sms.lastCodeFor(PHONE))).expect(400);
      expect(res.body.error.code).toBe('OTP_INVALID');
    });

    it('locks the code after too many attempts, even for the right code', async () => {
      await requestOtp().expect(200);
      const code = ctx.sms.lastCodeFor(PHONE);
      for (let i = 0; i < OTP_LIMITS.maxAttempts; i++) await verifyOtp(wrongCode(code)).expect(400);
      const res = await verifyOtp(code).expect(429);
      expect(res.body.error.code).toBe('OTP_TOO_MANY_ATTEMPTS');
    });

    it('rejects expired codes', async () => {
      await requestOtp().expect(200);
      await ctx.prisma.otpChallenge.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const res = await verifyOtp(ctx.sms.lastCodeFor(PHONE)).expect(400);
      expect(res.body.error.code).toBe('OTP_EXPIRED');
    });

    it('accepts each code only once', async () => {
      await requestOtp().expect(200);
      const code = ctx.sms.lastCodeFor(PHONE);
      await verifyOtp(code).expect(200);
      const res = await verifyOtp(code).expect(400);
      expect(res.body.error.code).toBe('OTP_EXPIRED');
    });

    it('invalidates the previous code when a new one is requested', async () => {
      await requestOtp().expect(200);
      const oldCode = ctx.sms.lastCodeFor(PHONE);
      await ctx.redis.del(`cd:otp:resend:${PHONE}`);
      await requestOtp().expect(200);
      const newCode = ctx.sms.lastCodeFor(PHONE);
      if (oldCode !== newCode) await verifyOtp(oldCode).expect(400);
      await verifyOtp(newCode).expect(200);
    });

    it('does not accept a code issued for another phone', async () => {
      await requestOtp('+998911111111').expect(200);
      await requestOtp().expect(200);
      const otherCode = ctx.sms.lastCodeFor('+998911111111');
      if (otherCode !== ctx.sms.lastCodeFor(PHONE)) await verifyOtp(otherCode).expect(400);
    });
  });

  describe('tokens', () => {
    it('protects /me and accepts a valid access token', async () => {
      await http().get('/v1/me').expect(401);
      await http().get('/v1/me').set('Authorization', 'Bearer garbage').expect(401);
      const { accessToken } = await loginParent(ctx, PHONE);
      const res = await http()
        .get('/v1/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.phone).toBe(PHONE);
    });

    it('rejects expired access tokens', async () => {
      const { userId } = await loginParent(ctx, PHONE);
      const tokens = ctx.app.get(TokenService);
      const original = ctx.env.JWT_ACCESS_TTL_SECONDS;
      ctx.env.JWT_ACCESS_TTL_SECONDS = -10;
      const { token } = await tokens.signAccess('user', userId);
      ctx.env.JWT_ACCESS_TTL_SECONDS = original;
      await http().get('/v1/me').set('Authorization', `Bearer ${token}`).expect(401);
    });

    it('rejects device tokens on parent routes', async () => {
      const { userId } = await loginParent(ctx, PHONE);
      const { token } = await ctx.app.get(TokenService).signAccess('device', userId);
      await http().get('/v1/me').set('Authorization', `Bearer ${token}`).expect(401);
    });

    it('rotates refresh tokens', async () => {
      const { refreshToken } = await loginParent(ctx, PHONE);
      const res = await http().post('/v1/auth/refresh').send({ refreshToken }).expect(200);
      expect(res.body.refreshToken).not.toBe(refreshToken);
      await http().get('/v1/me').set('Authorization', `Bearer ${res.body.accessToken}`).expect(200);
    });

    it('revokes the whole chain when a rotated token is reused', async () => {
      const { refreshToken, userId } = await loginParent(ctx, PHONE);
      const rotated = await http().post('/v1/auth/refresh').send({ refreshToken }).expect(200);

      const reuse = await http().post('/v1/auth/refresh').send({ refreshToken }).expect(401);
      expect(reuse.body.error.code).toBe('REFRESH_TOKEN_INVALID');
      // The legitimately rotated token is now revoked as well.
      await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: rotated.body.refreshToken })
        .expect(401);

      const audit = await ctx.prisma.auditLog.findFirst({
        where: { action: 'auth.refresh_token_reuse' },
      });
      expect(audit).toMatchObject({ actorType: 'user', actorId: userId });
    });

    it('rejects unknown and expired refresh tokens', async () => {
      await http().post('/v1/auth/refresh').send({ refreshToken: 'rt_unknown' }).expect(401);
      const { refreshToken } = await loginParent(ctx, PHONE);
      await ctx.prisma.refreshToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await http().post('/v1/auth/refresh').send({ refreshToken }).expect(401);
    });

    it('logout revokes the refresh token', async () => {
      const { refreshToken } = await loginParent(ctx, PHONE);
      await http().post('/v1/auth/logout').send({ refreshToken }).expect(204);
      await http().post('/v1/auth/refresh').send({ refreshToken }).expect(401);
    });

    it('stores refresh tokens hashed', async () => {
      const { refreshToken } = await loginParent(ctx, PHONE);
      const rows = await ctx.prisma.refreshToken.findMany();
      expect(rows.some((r) => r.tokenHash.includes(refreshToken))).toBe(false);
    });
  });

  describe('/me', () => {
    it('updates profile and push token with validation', async () => {
      const { accessToken } = await loginParent(ctx, PHONE);
      const auth = { Authorization: `Bearer ${accessToken}` };
      const res = await http()
        .patch('/v1/me')
        .set(auth)
        .send({ name: 'Aziza', locale: 'ru' })
        .expect(200);
      expect(res.body).toMatchObject({ name: 'Aziza', locale: 'ru' });
      await http().patch('/v1/me').set(auth).send({ locale: 'de' }).expect(400);
      await http().patch('/v1/me').set(auth).send({}).expect(400);
      await http()
        .put('/v1/me/push-token')
        .set(auth)
        .send({ token: 'fcm-token', platform: 'android' })
        .expect(204);
    });
  });
});
