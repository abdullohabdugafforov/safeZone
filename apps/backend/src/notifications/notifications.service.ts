import { Injectable, Logger } from '@nestjs/common';
import type { RealtimeEvent } from '@safekid/shared';

/**
 * Fans out realtime/push hints to parents of a family or to a device.
 * Delivery (WebSocket + push providers) is wired in the notifications step;
 * until then events are only logged.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async notifyFamily(familyId: string, event: RealtimeEvent): Promise<void> {
    this.logger.debug(`family ${familyId} <- ${event.type}`);
  }

  async notifyDevice(deviceId: string, event: RealtimeEvent): Promise<void> {
    this.logger.debug(`device ${deviceId} <- ${event.type}`);
  }
}
