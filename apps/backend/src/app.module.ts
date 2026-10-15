import { Module, type DynamicModule } from '@nestjs/common';

import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from './config/config.module.js';
import { CryptoModule } from './crypto/crypto.module.js';
import type { Env } from './config/env.js';
import { FamiliesModule } from './families/families.module.js';
import { HealthModule } from './health/health.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PairingModule } from './pairing/pairing.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RateLimitModule } from './rate-limit/rate-limit.module.js';
import { RedisModule } from './redis/redis.module.js';
import { SmsModule } from './sms/sms.module.js';
import { UsersModule } from './users/users.module.js';

@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(env),
        PrismaModule,
        RedisModule,
        CryptoModule,
        RateLimitModule,
        AuditModule,
        SmsModule,
        NotificationsModule,
        AuthModule,
        UsersModule,
        FamiliesModule,
        PairingModule,
        HealthModule,
      ],
    };
  }
}
