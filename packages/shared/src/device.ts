import { z } from 'zod';

import { appIdSchema, idSchema, isoDateTimeSchema, platformSchema } from './common';

export const deviceInfoSchema = z.object({
  platform: platformSchema,
  model: z.string().trim().min(1).max(100),
  osVersion: z.string().trim().min(1).max(50),
  appVersion: z.string().trim().min(1).max(50),
  deviceName: z.string().trim().min(1).max(100).optional(),
});
export type DeviceInfo = z.infer<typeof deviceInfoSchema>;

export const permissionKindSchema = z.enum([
  'accessibility',
  'usageAccess',
  'deviceAdmin',
  'notifications',
  'batteryOptimization',
  'familyControls',
]);
export type PermissionKind = z.infer<typeof permissionKindSchema>;

export const permissionStateSchema = z.enum(['granted', 'denied', 'unavailable']);
export type PermissionState = z.infer<typeof permissionStateSchema>;

export const permissionStatusSchema = z.partialRecord(permissionKindSchema, permissionStateSchema);
export type PermissionStatus = z.infer<typeof permissionStatusSchema>;

export const deviceStatusSchema = z.enum(['active', 'unlinked']);
export type DeviceStatus = z.infer<typeof deviceStatusSchema>;

/** Device as seen by a parent. */
export const deviceSchema = z.object({
  id: idSchema,
  childId: idSchema,
  platform: platformSchema,
  model: z.string(),
  osVersion: z.string(),
  appVersion: z.string(),
  deviceName: z.string().nullable(),
  status: deviceStatusSchema,
  permissionStatus: permissionStatusSchema,
  appliedPolicyVersion: z.number().int().nullable(),
  lastHeartbeatAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});
export type Device = z.infer<typeof deviceSchema>;

export const heartbeatBodySchema = z.object({
  appliedPolicyVersion: z.number().int().positive().nullable(),
  permissionStatus: permissionStatusSchema,
  appVersion: z.string().trim().min(1).max(50),
  batteryLevel: z.number().int().min(0).max(100).optional(),
  enforcementActive: z.boolean(),
});
export type HeartbeatBody = z.infer<typeof heartbeatBodySchema>;

export const heartbeatResponseSchema = z.object({
  latestPolicyVersion: z.number().int().positive(),
  hasPendingCommands: z.boolean(),
  serverTime: isoDateTimeSchema,
});
export type HeartbeatResponse = z.infer<typeof heartbeatResponseSchema>;

export const MAX_INSTALLED_APPS = 2000;

export const installedAppSchema = z.object({
  appId: appIdSchema,
  label: z.string().trim().min(1).max(200),
  isSystem: z.boolean(),
});
export type InstalledApp = z.infer<typeof installedAppSchema>;

export const putInstalledAppsBodySchema = z.object({
  apps: z.array(installedAppSchema).max(MAX_INSTALLED_APPS),
});
export type PutInstalledAppsBody = z.infer<typeof putInstalledAppsBodySchema>;
