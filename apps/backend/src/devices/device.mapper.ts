import {
  permissionStatusSchema,
  type Device as DeviceDto,
  type InstalledApp as InstalledAppDto,
  type PermissionStatus,
} from '@safekid/shared';

import type { Device, InstalledApp } from '../generated/prisma/client.js';

export function parsePermissionStatus(value: unknown): PermissionStatus {
  const parsed = permissionStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

export function toDeviceDto(device: Device): DeviceDto {
  return {
    id: device.id,
    childId: device.childId,
    platform: device.platform,
    model: device.model,
    osVersion: device.osVersion,
    appVersion: device.appVersion,
    deviceName: device.deviceName,
    status: device.status,
    permissionStatus: parsePermissionStatus(device.permissionStatus),
    appliedPolicyVersion: device.appliedPolicyVersion,
    lastHeartbeatAt: device.lastHeartbeatAt?.toISOString() ?? null,
    inOtherSpace: device.inOtherSpace,
    createdAt: device.createdAt.toISOString(),
  };
}

export function toInstalledAppDto(app: InstalledApp): InstalledAppDto {
  return { appId: app.appId, label: app.label, isSystem: app.isSystem };
}
