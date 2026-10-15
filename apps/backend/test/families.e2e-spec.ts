import request from 'supertest';

import { createTestApp, resetState, type TestContext } from './app.js';
import { createChild, setupParent, type Parent } from './fixtures.js';

describe('families & children access control (e2e)', () => {
  let ctx: TestContext;
  let alice: Parent;
  let bob: Parent;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetState(ctx);
    alice = await setupParent(ctx, '+998901111111');
    bob = await setupParent(ctx, '+998902222222');
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('each parent gets their own family as owner', async () => {
    const res = await http().get('/v1/families/mine').set(alice.auth).expect(200);
    expect(res.body).toEqual([expect.objectContaining({ id: alice.familyId, role: 'owner' })]);
    expect(alice.familyId).not.toBe(bob.familyId);
  });

  it('creates a child with a default policy version 1', async () => {
    const res = await http()
      .post(`/v1/families/${alice.familyId}/children`)
      .set(alice.auth)
      .send({ name: '  Ali  ', birthYear: 2015 })
      .expect(201);
    expect(res.body).toMatchObject({ name: 'Ali', birthYear: 2015, currentPolicyVersion: 1 });
    const policy = await ctx.prisma.policy.findFirst({ where: { childId: res.body.id } });
    expect(policy).toMatchObject({
      version: 1,
      document: expect.objectContaining({ mode: 'unrestricted' }),
    });
  });

  it('validates child input', async () => {
    await http()
      .post(`/v1/families/${alice.familyId}/children`)
      .set(alice.auth)
      .send({ name: '' })
      .expect(400);
    await http()
      .post(`/v1/families/${alice.familyId}/children`)
      .set(alice.auth)
      .send({ name: 'A', birthYear: 3000 })
      .expect(400);
    await http().get('/v1/children/not-a-uuid').set(alice.auth).expect(400);
  });

  it("hides other families' children (404, never 403)", async () => {
    const childId = await createChild(ctx, alice);

    await http().get(`/v1/families/${alice.familyId}/children`).set(bob.auth).expect(404);
    await http()
      .post(`/v1/families/${alice.familyId}/children`)
      .set(bob.auth)
      .send({ name: 'X' })
      .expect(404);
    await http().get(`/v1/children/${childId}`).set(bob.auth).expect(404);
    await http()
      .patch(`/v1/children/${childId}`)
      .set(bob.auth)
      .send({ name: 'Hacked' })
      .expect(404);
    await http().delete(`/v1/children/${childId}`).set(bob.auth).expect(404);

    const child = await http().get(`/v1/children/${childId}`).set(alice.auth).expect(200);
    expect(child.body.name).toBe('Ali');
  });

  it('requires authentication', async () => {
    await http().get('/v1/families/mine').expect(401);
    await http().get(`/v1/families/${alice.familyId}/children`).expect(401);
  });

  it('owner can update and delete their child', async () => {
    const childId = await createChild(ctx, alice);
    await http()
      .patch(`/v1/children/${childId}`)
      .set(alice.auth)
      .send({ name: 'Vali' })
      .expect(200);
    await http().delete(`/v1/children/${childId}`).set(alice.auth).expect(204);
    await http().get(`/v1/children/${childId}`).set(alice.auth).expect(404);
  });
});
