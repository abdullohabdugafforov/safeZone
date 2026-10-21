import { HEARTBEAT_LOST_AFTER_SECONDS } from '@safekid/shared';
import request from 'supertest';

import { AlertsService } from '../src/alerts/alerts.service.js';
import { createTestApp, resetState, type TestContext } from './app.js';
import {
  createChild,
  linkDevice,
  setupParent,
  type LinkedDevice,
  type Parent,
} from './fixtures.js';

const GRANTED = {
  accessibility: 'granted',
  usageAccess: 'granted',
  deviceAdmin: 'granted',
} as const;
const heartbeat = (overrides: object = {}) => ({
  appliedPolicyVersion: 1,
  permissionStatus: GRANTED,
  appVersion: '0.1.0',
  batteryLevel: 80,
  enforcementActive: true,
  ...overrides,
});

describe('devices (e2e)', () => {
  let ctx: TestContext;
  let alice: Parent;
  let bob: Parent;
  let device: LinkedDevice;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetState(ctx);
    alice = await setupParent(ctx, '+998901111111');
    bob = await setupParent(ctx, '+998902222222');
    device = await linkDevice(ctx, alice, await createChild(ctx, alice));
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  describe('device auth', () => {
    it('device endpoints require a device token, not a parent token', async () => {
      await http().post('/v1/device/heartbeat').send(heartbeat()).expect(401);
      await http().post('/v1/device/heartbeat').set(alice.auth).send(heartbeat()).expect(401);
      await http().post('/v1/device/heartbeat').set(device.auth).send(heartbeat()).expect(200);
    });

    it('parent endpoints reject device tokens', async () => {
      await http().get(`/v1/devices/${device.deviceId}`).set(device.auth).expect(401);
    });
  });

  describe('heartbeat', () => {
    it('updates device state visible to the parent', async () => {
      const res = await http()
        .post('/v1/device/heartbeat')
        .set(device.auth)
        .send(heartbeat())
        .expect(200);
      expect(res.body).toEqual({
        latestPolicyVersion: 1,
        hasPendingCommands: false,
        serverTime: expect.any(String),
      });

      const list = await http()
        .get(`/v1/children/${device.childId}/devices`)
        .set(alice.auth)
        .expect(200);
      expect(list.body).toEqual([
        expect.objectContaining({
          id: device.deviceId,
          permissionStatus: GRANTED,
          appliedPolicyVersion: 1,
          lastHeartbeatAt: expect.any(String),
        }),
      ]);
    });

    it('validates the body', async () => {
      await http()
        .post('/v1/device/heartbeat')
        .set(device.auth)
        .send(heartbeat({ batteryLevel: 150 }))
        .expect(400);
      await http()
        .post('/v1/device/heartbeat')
        .set(device.auth)
        .send(heartbeat({ permissionStatus: { accessibility: 'maybe' } }))
        .expect(400);
    });

    it('raises tamper alerts when a permission is revoked or enforcement stops', async () => {
      await http().post('/v1/device/heartbeat').set(device.auth).send(heartbeat()).expect(200);
      await http()
        .post('/v1/device/heartbeat')
        .set(device.auth)
        .send(
          heartbeat({
            permissionStatus: { ...GRANTED, accessibility: 'denied' },
            enforcementActive: false,
          }),
        )
        .expect(200);

      const alerts = await http().get('/v1/alerts').set(alice.auth).expect(200);
      expect(alerts.body.map((a: { type: string }) => a.type).sort()).toEqual([
        'ENFORCEMENT_STOPPED',
        'PERMISSION_REVOKED',
      ]);
      expect(
        alerts.body.find((a: { type: string }) => a.type === 'PERMISSION_REVOKED').details,
      ).toMatchObject({
        permission: 'accessibility',
      });
      const audit = await ctx.prisma.auditLog.count({
        where: { action: 'alert.PERMISSION_REVOKED' },
      });
      expect(audit).toBe(1);
    });
  });

  describe('heartbeat watchdog', () => {
    it('raises HEARTBEAT_LOST once, and again only after the device comes back and goes silent', async () => {
      const watchdog = ctx.app.get(AlertsService);
      await http().post('/v1/device/heartbeat').set(device.auth).send(heartbeat()).expect(200);
      const later = (seconds: number) => new Date(Date.now() + seconds * 1000);

      expect(await watchdog.runHeartbeatWatchdog(later(60))).toBe(0);
      expect(await watchdog.runHeartbeatWatchdog(later(HEARTBEAT_LOST_AFTER_SECONDS + 60))).toBe(1);
      expect(await watchdog.runHeartbeatWatchdog(later(HEARTBEAT_LOST_AFTER_SECONDS + 120))).toBe(
        0,
      );

      await http().post('/v1/device/heartbeat').set(device.auth).send(heartbeat()).expect(200);
      expect(await watchdog.runHeartbeatWatchdog(later(HEARTBEAT_LOST_AFTER_SECONDS + 60))).toBe(1);
      expect(await ctx.prisma.alert.count({ where: { type: 'HEARTBEAT_LOST' } })).toBe(2);
    });
  });

  describe('installed apps', () => {
    it('replaces the snapshot and is visible only to the family', async () => {
      const apps = [
        { appId: 'com.duolingo', label: 'Duolingo', isSystem: false },
        { appId: 'com.android.chrome', label: 'Chrome', isSystem: true },
      ];
      await http().put('/v1/device/apps').set(device.auth).send({ apps }).expect(204);
      await http()
        .put('/v1/device/apps')
        .set(device.auth)
        .send({ apps: apps.slice(0, 1) })
        .expect(204);

      const res = await http()
        .get(`/v1/devices/${device.deviceId}/apps`)
        .set(alice.auth)
        .expect(200);
      expect(res.body).toEqual([apps[0]]);
      await http().get(`/v1/devices/${device.deviceId}/apps`).set(bob.auth).expect(404);
    });
  });

  describe('device-reported alerts', () => {
    it('stores tamper events and lets the parent mark them read', async () => {
      await http()
        .post('/v1/device/alerts')
        .set(device.auth)
        .send({ type: 'DEVICE_ADMIN_DISABLE_REQUESTED' })
        .expect(204);
      await http()
        .post('/v1/device/alerts')
        .set(device.auth)
        .send({ type: 'HEARTBEAT_LOST' })
        .expect(400);

      const unread = await http().get('/v1/alerts?unreadOnly=true').set(alice.auth).expect(200);
      expect(unread.body).toHaveLength(1);
      const alertId = unread.body[0].id;

      await http().get('/v1/alerts').set(bob.auth).expect(200).expect([]);
      await http().post(`/v1/alerts/${alertId}/read`).set(bob.auth).expect(404);
      await http().post(`/v1/alerts/${alertId}/read`).set(alice.auth).expect(204);
      expect(
        (await http().get('/v1/alerts?unreadOnly=true').set(alice.auth).expect(200)).body,
      ).toEqual([]);
    });
  });

  describe('tamper attempts', () => {
    it('records blocked attempts to reach protected screens', async () => {
      await http()
        .post('/v1/device/alerts')
        .set(device.auth)
        .send({ type: 'TAMPER_ATTEMPT', target: 'uninstall' })
        .expect(204);
      await http()
        .post('/v1/device/alerts')
        .set(device.auth)
        .send({ type: 'TAMPER_ATTEMPT', target: 'something-else' })
        .expect(400);
      const alerts = await http().get('/v1/alerts').set(alice.auth).expect(200);
      expect(alerts.body).toEqual([
        expect.objectContaining({
          type: 'TAMPER_ATTEMPT',
          details: expect.objectContaining({ target: 'uninstall' }),
        }),
      ]);
    });
  });

  describe('second space', () => {
    it('shows when the phone is in another user space and records enter/leave', async () => {
      await http()
        .post('/v1/device/heartbeat')
        .set(device.auth)
        .send(heartbeat({ inOtherSpace: true }))
        .expect(200);
      const seen = await http().get(`/v1/devices/${device.deviceId}`).set(alice.auth).expect(200);
      expect(seen.body.inOtherSpace).toBe(true);

      await http()
        .post('/v1/device/alerts')
        .set(device.auth)
        .send({ type: 'SECOND_SPACE_ENTERED' })
        .expect(204);
      await http()
        .post('/v1/device/alerts')
        .set(device.auth)
        .send({ type: 'SECOND_SPACE_LEFT', minutes: 12 })
        .expect(204);
      await http()
        .post('/v1/device/alerts')
        .set(device.auth)
        .send({ type: 'TAMPER_ATTEMPT', target: 'second_space' })
        .expect(204);
      const alerts = await http().get('/v1/alerts').set(alice.auth).expect(200);
      expect(alerts.body.map((a: { type: string }) => a.type).sort()).toEqual([
        'SECOND_SPACE_ENTERED',
        'SECOND_SPACE_LEFT',
        'TAMPER_ATTEMPT',
      ]);

      await http().post('/v1/device/heartbeat').set(device.auth).send(heartbeat()).expect(200);
      expect(
        (await http().get(`/v1/devices/${device.deviceId}`).set(alice.auth)).body.inOtherSpace,
      ).toBe(false);
    });
  });

  describe('parent access control', () => {
    it("other parents can't see or unlink the device", async () => {
      await http().get(`/v1/devices/${device.deviceId}`).set(bob.auth).expect(404);
      await http().get(`/v1/children/${device.childId}/devices`).set(bob.auth).expect(404);
      await http().delete(`/v1/devices/${device.deviceId}`).set(bob.auth).expect(404);
      await http().post('/v1/device/heartbeat').set(device.auth).send(heartbeat()).expect(200);
    });
  });

  describe('unlink', () => {
    it('revokes device access and refresh tokens', async () => {
      await http().delete(`/v1/devices/${device.deviceId}`).set(alice.auth).expect(204);

      const res = await http()
        .post('/v1/device/heartbeat')
        .set(device.auth)
        .send(heartbeat())
        .expect(401);
      expect(res.body.error.code).toBe('DEVICE_UNLINKED');
      await http().post('/v1/auth/refresh').send({ refreshToken: device.refreshToken }).expect(401);
      expect(
        (await http().get(`/v1/children/${device.childId}/devices`).set(alice.auth).expect(200))
          .body,
      ).toEqual([]);
    });

    it('deleting the child cuts off its devices', async () => {
      await http().delete(`/v1/children/${device.childId}`).set(alice.auth).expect(204);
      await http().post('/v1/device/heartbeat').set(device.auth).send(heartbeat()).expect(401);
      await http().post('/v1/auth/refresh').send({ refreshToken: device.refreshToken }).expect(401);
    });
  });
});
