import 'reflect-metadata';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Redis } from 'ioredis';

import { configureApp } from '../src/app.factory.js';
import { AppModule } from '../src/app.module.js';
import type { Env } from '../src/config/env.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { REDIS } from '../src/redis/redis.module.js';
import { testEnv } from './env.js';

export interface TestContext {
  app: NestExpressApplication;
  prisma: PrismaService;
  redis: Redis;
  env: Env;
}

export async function createTestApp(): Promise<TestContext> {
  const env = testEnv();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] }).compile();
  const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>(), env);
  await app.init();
  return { app, env, prisma: app.get(PrismaService), redis: app.get(REDIS) };
}

/** Wipes all data between tests (keeps the schema). */
export async function resetState({ prisma, redis }: TestContext): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  await redis.flushdb();
}
