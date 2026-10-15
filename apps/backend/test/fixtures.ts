import request from 'supertest';

import { loginParent, type TestContext } from './app.js';

export const DEVICE_INFO = {
  platform: 'android',
  model: 'Pixel 8',
  osVersion: '15',
  appVersion: '0.1.0',
} as const;

export interface Parent {
  userId: string;
  familyId: string;
  auth: { Authorization: string };
}

export async function setupParent(ctx: TestContext, phone: string): Promise<Parent> {
  const { userId, accessToken } = await loginParent(ctx, phone);
  const auth = { Authorization: `Bearer ${accessToken}` };
  const families = await request(ctx.app.getHttpServer())
    .get('/v1/families/mine')
    .set(auth)
    .expect(200);
  return { userId, familyId: families.body[0].id, auth };
}

export async function createChild(ctx: TestContext, parent: Parent, name = 'Ali'): Promise<string> {
  const res = await request(ctx.app.getHttpServer())
    .post(`/v1/families/${parent.familyId}/children`)
    .set(parent.auth)
    .send({ name })
    .expect(201);
  return res.body.id;
}

export interface LinkedDevice {
  deviceId: string;
  childId: string;
  auth: { Authorization: string };
  refreshToken: string;
}

/** Full pairing flow: code -> request -> approve -> claim. */
export async function linkDevice(
  ctx: TestContext,
  parent: Parent,
  childId: string,
): Promise<LinkedDevice> {
  const http = () => request(ctx.app.getHttpServer());
  const code = await http()
    .post(`/v1/families/${parent.familyId}/pairing-codes`)
    .set(parent.auth)
    .send({ childId })
    .expect(201);
  const req = await http()
    .post('/v1/pairing/requests')
    .send({ method: 'code', code: code.body.code, device: DEVICE_INFO })
    .expect(201);
  await http()
    .post(`/v1/pairing/requests/${req.body.requestId}/approve`)
    .set(parent.auth)
    .send({ childId })
    .expect(200);
  const claim = await http()
    .post(`/v1/pairing/requests/${req.body.requestId}/claim`)
    .send({ claimSecret: req.body.claimSecret })
    .expect(200);
  return {
    deviceId: claim.body.deviceId,
    childId,
    auth: { Authorization: `Bearer ${claim.body.tokens.accessToken}` },
    refreshToken: claim.body.tokens.refreshToken,
  };
}
