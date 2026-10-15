import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  HEARTBEAT_LOST_AFTER_SECONDS,
  type AlertType,
  type ListAlertsQuery,
} from '@safekid/shared';
import type { Redis } from 'ioredis';

import { AuditService } from '../audit/audit.service.js';
import { AppException } from '../common/app-exception.js';
import { FamilyAccessService } from '../families/family-access.service.js';
import type { Alert, Prisma } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { REDIS } from '../redis/redis.module.js';

export interface AlertTarget {
  id: string;
  childId: string;
  familyId: string;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FamilyAccessService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** Records a tamper/security alert, logs it to the audit trail and notifies parents. */
  async raise(
    device: AlertTarget,
    type: AlertType,
    details: Prisma.InputJsonObject = {},
  ): Promise<Alert> {
    const alert = await this.prisma.alert.create({
      data: {
        familyId: device.familyId,
        childId: device.childId,
        deviceId: device.id,
        type,
        details,
      },
    });
    await this.audit.log({
      actorType: 'system',
      action: `alert.${type}`,
      familyId: device.familyId,
      targetType: 'device',
      targetId: device.id,
      meta: details,
    });
    await this.notifications.notifyFamily(device.familyId, {
      type: 'alert.created',
      alertId: alert.id,
      deviceId: device.id,
    });
    return alert;
  }

  async list(userId: string, query: ListAlertsQuery): Promise<Alert[]> {
    const familyIds = await this.access.familyIdsOf(userId);
    return this.prisma.alert.findMany({
      where: {
        familyId: { in: familyIds },
        ...(query.childId ? { childId: query.childId } : {}),
        ...(query.unreadOnly ? { readAt: null } : {}),
        ...(query.before ? { createdAt: { lt: new Date(query.before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    });
  }

  async markRead(userId: string, alertId: string): Promise<void> {
    const familyIds = await this.access.familyIdsOf(userId);
    const alert = await this.prisma.alert.findFirst({
      where: { id: alertId, familyId: { in: familyIds } },
    });
    if (!alert) throw AppException.notFound('Alert');
    if (!alert.readAt)
      await this.prisma.alert.update({ where: { id: alertId }, data: { readAt: new Date() } });
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledWatchdog(): Promise<void> {
    // Only one instance runs the watchdog per tick.
    const lock = await this.redis.set('lock:heartbeat-watchdog', '1', 'EX', 240, 'NX');
    if (lock === null) return;
    const raised = await this.runHeartbeatWatchdog();
    if (raised > 0) this.logger.log(`Raised ${raised} HEARTBEAT_LOST alert(s)`);
  }

  /** Raises HEARTBEAT_LOST once per silence period for each active device. */
  async runHeartbeatWatchdog(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - HEARTBEAT_LOST_AFTER_SECONDS * 1000);
    const silent = await this.prisma.device.findMany({
      where: {
        status: 'active',
        heartbeatLostAlertedAt: null,
        OR: [
          { lastHeartbeatAt: { lt: cutoff } },
          { lastHeartbeatAt: null, createdAt: { lt: cutoff } },
        ],
      },
      include: { child: { select: { familyId: true } } },
    });
    for (const device of silent) {
      // Conditional update so concurrent runs can't double-alert.
      const { count } = await this.prisma.device.updateMany({
        where: { id: device.id, heartbeatLostAlertedAt: null },
        data: { heartbeatLostAlertedAt: now },
      });
      if (count === 0) continue;
      await this.raise(
        { id: device.id, childId: device.childId, familyId: device.child.familyId },
        'HEARTBEAT_LOST',
        {
          lastHeartbeatAt: device.lastHeartbeatAt?.toISOString() ?? null,
        },
      );
    }
    return silent.length;
  }
}
