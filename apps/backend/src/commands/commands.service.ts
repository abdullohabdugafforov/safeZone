import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  DEFAULT_COMMAND_TTL_SECONDS,
  type CommandAckBody,
  type CreateCommandBody,
} from '@safekid/shared';

import { AuditService } from '../audit/audit.service.js';
import type { AuthDevice } from '../auth/principal.js';
import { AppException } from '../common/app-exception.js';
import { FamilyAccessService } from '../families/family-access.service.js';
import type { Command } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const MAX_PENDING_PER_SYNC = 50;

/**
 * Command lifecycle: pending -> delivered (returned by /device/state)
 * -> applied | failed (device ack), or expired after expires_at.
 */
@Injectable()
export class CommandsService {
  private readonly logger = new Logger(CommandsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FamilyAccessService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, deviceId: string, body: CreateCommandBody): Promise<Command> {
    const device = await this.access.requireDevice(userId, deviceId);
    if (device.status !== 'active') {
      throw new AppException('DEVICE_UNLINKED', 'Device is no longer linked', HttpStatus.CONFLICT);
    }
    const ttl = body.ttlSeconds ?? DEFAULT_COMMAND_TTL_SECONDS;
    const command = await this.prisma.command.create({
      data: {
        deviceId,
        type: body.type,
        payload: body.payload,
        createdById: userId,
        expiresAt: new Date(Date.now() + ttl * 1000),
      },
    });
    await this.audit.log({
      actorType: 'user',
      actorId: userId,
      action: 'command.created',
      familyId: device.child.familyId,
      targetType: 'device',
      targetId: deviceId,
      meta: { commandId: command.id, type: body.type },
    });
    await this.notifications.notifyDevice(deviceId, { type: 'sync' });
    return command;
  }

  async list(userId: string, deviceId: string, limit = 50): Promise<Command[]> {
    await this.access.requireDevice(userId, deviceId);
    return this.prisma.command.findMany({
      where: { deviceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** Returns open commands for the device and marks pending ones as delivered. */
  async takeOpen(deviceId: string): Promise<Command[]> {
    const now = new Date();
    const open = await this.prisma.command.findMany({
      where: { deviceId, status: { in: ['pending', 'delivered'] }, expiresAt: { gt: now } },
      orderBy: { createdAt: 'asc' },
      take: MAX_PENDING_PER_SYNC,
    });
    const pendingIds = open.filter((c) => c.status === 'pending').map((c) => c.id);
    if (pendingIds.length > 0) {
      await this.prisma.command.updateMany({
        where: { id: { in: pendingIds }, status: 'pending' },
        data: { status: 'delivered', deliveredAt: now },
      });
    }
    return open.map((c) =>
      pendingIds.includes(c.id) ? { ...c, status: 'delivered', deliveredAt: now } : c,
    );
  }

  /** Idempotent for repeated identical acks (devices retry on flaky networks). */
  async ack(device: AuthDevice, commandId: string, body: CommandAckBody): Promise<void> {
    const command = await this.prisma.command.findFirst({
      where: { id: commandId, deviceId: device.id },
    });
    if (!command) throw AppException.notFound('Command');
    if (command.status === body.status) return;
    const open = command.status === 'pending' || command.status === 'delivered';
    if (!open || command.expiresAt <= new Date()) {
      throw new AppException(
        'CONFLICT',
        `Command is already ${command.status}`,
        HttpStatus.CONFLICT,
      );
    }
    await this.prisma.command.update({
      where: { id: commandId },
      data: {
        status: body.status,
        error: body.status === 'failed' ? body.error : null,
        ackedAt: new Date(),
        deliveredAt: command.deliveredAt ?? new Date(),
      },
    });
    await this.notifications.notifyFamily(device.familyId, {
      type: 'device.updated',
      deviceId: device.id,
    });
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireStale(now = new Date()): Promise<number> {
    const { count } = await this.prisma.command.updateMany({
      where: { status: { in: ['pending', 'delivered'] }, expiresAt: { lte: now } },
      data: { status: 'expired' },
    });
    if (count > 0) this.logger.log(`Expired ${count} command(s)`);
    return count;
  }
}
