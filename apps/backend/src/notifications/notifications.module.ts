import { Global, Module } from '@nestjs/common';

import { APP_CONFIG } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { ConsolePushProvider } from '../push/console-push.provider.js';
import { FcmPushProvider } from '../push/fcm-push.provider.js';
import { PushProvider } from '../push/push.provider.js';
import { NotificationsService } from './notifications.service.js';
import { RealtimeGateway } from './realtime.gateway.js';

@Global()
@Module({
  providers: [
    {
      provide: PushProvider,
      inject: [APP_CONFIG],
      useFactory: (config: Env): Promise<PushProvider> | PushProvider =>
        config.PUSH_PROVIDER === 'fcm'
          ? FcmPushProvider.create(config.FCM_SERVICE_ACCOUNT_PATH!)
          : new ConsolePushProvider(),
    },
    RealtimeGateway,
    NotificationsService,
  ],
  exports: [NotificationsService, PushProvider],
})
export class NotificationsModule {}
