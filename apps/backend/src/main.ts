import 'dotenv/config';
import 'reflect-metadata';

import { Logger } from '@nestjs/common';

import { createApp } from './app.factory.js';
import { loadEnv } from './config/env.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await createApp(env);
  await app.listen(env.PORT);
  Logger.log(`API listening on :${env.PORT} (${env.NODE_ENV})`, 'Bootstrap');
}

void bootstrap();
