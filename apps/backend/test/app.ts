import 'reflect-metadata';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Redis } from 'ioredis';

import { configureApp } from '../src/app.factory.js';
import { AppModule } from '../src/app.module.js';
import type { Env } from '../src/config/env.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { REDIS } from '../src/redis/redis.module.js';
import { SmsProvider } from '../src/sms/sms.provider.js';
import { testEnv } from './env.js';

/** Captures SMS instead of sending them. */
export class FakeSmsProvider extends SmsProvider {
  readonly sent: { to: string; text: string }[] = [];

  async send(to: string, text: string): Promise<void> {
    this.sent.push({ to, text });
  }

  lastCodeFor(phone: string): string {
    const msg = [...this.sent].reverse().find((m) => m.to === phone);
    const code = msg?.text.match(/\b(\d{6})\b/)?.[1];
    if (!code) throw new Error(`No OTP sent to ${phone}`);
    return code;
  }
}

export interface TestContext {
  app: NestExpressApplication;
  prisma: PrismaService;
  redis: Redis;
  env: Env;
  sms: FakeSmsProvider;
}

export async function createTestApp(): Promise<TestContext> {
  const env = testEnv();
  const sms = new FakeSmsProvider();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
    .overrideProvider(SmsProvider)
    .useValue(sms)
    .compile();
  const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>(), env);
  await app.init();
  return { app, env, sms, prisma: app.get(PrismaService), redis: app.get(REDIS) };
}

/** Wipes all data between tests (keeps the schema). */
export async function resetState({ prisma, redis }: TestContext): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  await redis.flushdb();
}

/** Logs a parent in through the real OTP flow. */
export async function loginParent(
  ctx: TestContext,
  phone: string,
): Promise<{ userId: string; accessToken: string; refreshToken: string }> {
  const server = ctx.app.getHttpServer();
  await request(server).post('/v1/auth/otp/request').send({ phone }).expect(200);
  const res = await request(server)
    .post('/v1/auth/otp/verify')
    .send({ phone, code: ctx.sms.lastCodeFor(phone) })
    .expect(200);
  return {
    userId: res.body.user.id,
    accessToken: res.body.tokens.accessToken,
    refreshToken: res.body.tokens.refreshToken,
  };
}
