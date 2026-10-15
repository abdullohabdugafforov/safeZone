import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import type { Env } from './config/env.js';

export const API_PREFIX = 'v1';

/** Applies global app setup. Shared by main.ts and e2e tests so they behave identically. */
export function configureApp(app: NestExpressApplication, env: Env): NestExpressApplication {
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: false });
  app.useBodyParser('json', { limit: '256kb' });
  app.set('trust proxy', env.TRUST_PROXY);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  return app;
}

export async function createApp(env: Env): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(env), {
    bodyParser: false,
  });
  return configureApp(app, env);
}
