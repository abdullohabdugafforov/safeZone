import { Injectable, Logger } from '@nestjs/common';
import { maskPhone } from '@safekid/shared';

import { SmsProvider } from './sms.provider.js';

/** Development only (rejected in production by env validation): prints messages to the log. */
@Injectable()
export class ConsoleSmsProvider extends SmsProvider {
  private readonly logger = new Logger('ConsoleSms');

  async send(to: string, text: string): Promise<void> {
    this.logger.log(`to ${maskPhone(to)}: ${text}`);
  }
}
