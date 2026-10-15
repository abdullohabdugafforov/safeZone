import { Injectable } from '@nestjs/common';
import {
  permissionKindSchema,
  type DeviceAlertBody,
  type HeartbeatBody,
  type HeartbeatResponse,
  type InstalledApp,
} from '@safekid/shared';

import { AlertsService } from '../alerts/alerts.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthDevice } from '../auth/principal.js';
import { TokenService } from '../auth/token.service.js';
import { FamilyAccessService } from '../families/family-access.service.js';
import type { Device, InstalledApp as InstalledAppRow } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parsePermissionStatus } from './device.mapper.js';

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FamilyAccessService,
    private readonly alerts: AlertsService,
    private readonly tokens: TokenService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  // --- parent side ----------------------------------------------------------

  async listForChild(userId: string, childId: string): Promise<Device[]> {
    await this.access.requireChild(userId, childId);
    return this.prisma.device.findMany({
      where: { childId, status: 'active' },
      orderBy: { createdAt: 'asc' },
    });
  }

  async get(userId: string, deviceId: string): Promise<Device> {
    return this.access.requireDevice(userId, deviceId);
  }

  async apps(userId: string, deviceId: string): Promise<InstalledAppRow[]> {
    await this.access.requireDevice(userId, deviceId);
    return this.prisma.installedApp.findMany({ where: { deviceId }, orderBy: { label: 'asc' } });
  }

  /** Releases the device: it loses its credentials and stops enforcing on next contact. */
  async unlink(userId: string, deviceId: string): Promise<void> {
    const device = await this.access.requireDevice(userId, deviceId);
    if (device.status === 'unlinked') return;
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { status: 'unlinked', pushToken: null },
    });
    await this.tokens.revokeAllForDevice(deviceId);
    await this.audit.log({
      actorType: 'user',
      actorId: userId,
      action: 'device.unlinked',
      familyId: device.child.familyId,
      targetType: 'device',
      targetId: deviceId,
    });
    await this.notifications.notifyDevice(deviceId, { type: 'sync' });
  }

  // --- device side ----------------------------------------------------------

  async heartbeat(auth: AuthDevice, body: HeartbeatBody): Promise<HeartbeatResponse> {
    const before = await this.prisma.device.findUniqueOrThrow({
      where: { id: auth.id },
      include: { child: { select: { currentPolicyVersion: true } } },
    });

    const now = new Date();
    await this.prisma.device.update({
      where: { id: auth.id },
      data: {
        lastHeartbeatAt: now,
        heartbeatLostAlertedAt: null,
        permissionStatus: body.permissionStatus,
        appVersion: body.appVersion,
        batteryLevel: body.batteryLevel ?? null,
        enforcementActive: body.enforcementActive,
        appliedPolicyVersion: body.appliedPolicyVersion,
      },
    });

    // Server-side tamper detection, in case the device could not report it itself.
    const previous = parsePermissionStatus(before.permissionStatus);
    for (const permission of permissionKindSchema.options) {
      if (previous[permission] === 'granted' && body.permissionStatus[permission] === 'denied') {
        await this.alerts.raise(auth, 'PERMISSION_REVOKED', { permission, source: 'heartbeat' });
      }
    }
    if (before.enforcementActive && !body.enforcementActive) {
      await this.alerts.raise(auth, 'ENFORCEMENT_STOPPED', { source: 'heartbeat' });
    }

    const pending = await this.prisma.command.count({
      where: {
        deviceId: auth.id,
        status: { in: ['pending', 'delivered'] },
        expiresAt: { gt: now },
      },
    });
    return {
      latestPolicyVersion: before.child.currentPolicyVersion,
      hasPendingCommands: pending > 0,
      serverTime: now.toISOString(),
    };
  }

  /** Replaces the installed-apps snapshot of the device. */
  async replaceApps(auth: AuthDevice, apps: InstalledApp[]): Promise<void> {
    const unique = [...new Map(apps.map((app) => [app.appId, app])).values()];
    await this.prisma.$transaction([
      this.prisma.installedApp.deleteMany({ where: { deviceId: auth.id } }),
      this.prisma.installedApp.createMany({
        data: unique.map((app) => ({ deviceId: auth.id, ...app })),
      }),
    ]);
    await this.notifications.notifyFamily(auth.familyId, {
      type: 'device.updated',
      deviceId: auth.id,
    });
  }

  async setPushToken(auth: AuthDevice, token: string): Promise<void> {
    await this.prisma.device.update({ where: { id: auth.id }, data: { pushToken: token } });
  }

  async reportAlert(auth: AuthDevice, body: DeviceAlertBody): Promise<void> {
    const { type, ...details } = body;
    await this.alerts.raise(auth, type, { ...details, source: 'device' });
  }
}
