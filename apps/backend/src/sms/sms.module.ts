import { Global, Module } from '@nestjs/common';

import { APP_CONFIG } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { ConsoleSmsProvider } from './console-sms.provider.js';
import { EskizSmsProvider } from './eskiz-sms.provider.js';
import { SmsProvider } from './sms.provider.js';

@Global()
@Module({
  providers: [
    {
      provide: SmsProvider,
      inject: [APP_CONFIG],
      useFactory: (config: Env): SmsProvider =>
        config.SMS_PROVIDER === 'eskiz' ? new EskizSmsProvider(config) : new ConsoleSmsProvider(),
    },
  ],
  exports: [SmsProvider],
})
export class SmsModule {}
