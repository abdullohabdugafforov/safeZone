import { Injectable, Logger } from '@nestjs/common';

import { PushProvider, type PushMessage, type PushResult } from './push.provider.js';

/** Development: logs pushes instead of sending them. */
@Injectable()
export class ConsolePushProvider extends PushProvider {
  private readonly logger = new Logger('ConsolePush');

  async send(message: PushMessage): Promise<PushResult> {
    this.logger.debug(
      `${message.highPriority ? 'HIGH' : 'normal'} ${JSON.stringify(message.data)}`,
    );
    return 'sent';
  }
}
