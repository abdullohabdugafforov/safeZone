import { Injectable, Logger } from '@nestjs/common';
import { toPushData, type RealtimeEvent } from '@safekid/shared';

import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PushProvider } from '../push/push.provider.js';
import { RealtimeGateway } from './realtime.gateway.js';

/**
 * Fans out hints over WebSocket and push. Never throws: a failed notification
 * must not fail the request, devices also catch up on their next heartbeat.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushProvider,
    private readonly gateway: RealtimeGateway,
    private readonly audit: AuditService,
  ) {}

  /** To every parent of the family. */
  async notifyFamily(familyId: string, event: RealtimeEvent): Promise<void> {
    try {
      this.gateway.emitToFamily(familyId, event);
      const parents = await this.prisma.user.findMany({
        where: { memberships: { some: { familyId } }, pushToken: { not: null } },
        select: { id: true, pushToken: true },
      });
      await Promise.all(
        parents.map(async (parent) => {
          const result = await this.push.send({
            token: parent.pushToken!,
            data: toPushData(event),
            highPriority: false,
          });
          if (result === 'invalid-token') {
            await this.prisma.user.update({ where: { id: parent.id }, data: { pushToken: null } });
          }
        }),
      );
    } catch (error) {
      this.logger.error(`notifyFamily(${event.type}) failed`, error as Error);
    }
  }

  /** To one child device (high priority so Doze doesn't delay it). */
  async notifyDevice(deviceId: string, event: RealtimeEvent): Promise<void> {
    try {
      this.gateway.emitToDevice(deviceId, event);
      const device = await this.prisma.device.findUnique({
        where: { id: deviceId },
        select: {
          pushToken: true,
          status: true,
          childId: true,
          child: { select: { familyId: true } },
        },
      });
      if (!device?.pushToken) return;
      const result = await this.push.send({
        token: device.pushToken,
        data: toPushData(event),
        highPriority: true,
      });
      if (result === 'invalid-token') await this.handleDeadDeviceToken(deviceId, device);
    } catch (error) {
      this.logger.error(`notifyDevice(${event.type}) failed`, error as Error);
    }
  }

  async notifyChildDevices(childId: string, event: RealtimeEvent): Promise<void> {
    const devices = await this.prisma.device.findMany({
      where: { childId, status: 'active' },
      select: { id: true },
    });
    await Promise.all(devices.map((device) => this.notifyDevice(device.id, event)));
  }

  /** FCM says the token is gone: typically the app was uninstalled or its data cleared. */
  private async handleDeadDeviceToken(
    deviceId: string,
    device: { status: string; childId: string; child: { familyId: string } },
  ): Promise<void> {
    await this.prisma.device.update({ where: { id: deviceId }, data: { pushToken: null } });
    if (device.status !== 'active') return;
    const alert = await this.prisma.alert.create({
      data: {
        familyId: device.child.familyId,
        childId: device.childId,
        deviceId,
        type: 'APP_REMOVED_SUSPECTED',
        details: { reason: 'push_token_invalid' },
      },
    });
    await this.audit.log({
      actorType: 'system',
      action: 'alert.APP_REMOVED_SUSPECTED',
      familyId: device.child.familyId,
      targetType: 'device',
      targetId: deviceId,
    });
    await this.notifyFamily(device.child.familyId, {
      type: 'alert.created',
      alertId: alert.id,
      deviceId,
    });
  }
}
