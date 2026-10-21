import { z } from 'zod';

import { idSchema, isoDateTimeSchema } from './common';
import { permissionKindSchema } from './device';

/** Alerts the device itself may report. */
export const deviceAlertTypeSchema = z.enum([
  'PERMISSION_REVOKED',
  'DEVICE_ADMIN_DISABLE_REQUESTED',
  'DEVICE_ADMIN_DISABLED',
  'ENFORCEMENT_STOPPED',
  'TIME_CHANGED',
  'TAMPER_ATTEMPT',
  'SECOND_SPACE_ENTERED',
  'SECOND_SPACE_LEFT',
]);
export type DeviceAlertType = z.infer<typeof deviceAlertTypeSchema>;

/** Alerts raised by the server (e.g. watchdog). */
export const serverAlertTypeSchema = z.enum(['HEARTBEAT_LOST', 'APP_REMOVED_SUSPECTED']);

export const alertTypeSchema = z.enum([
  ...deviceAlertTypeSchema.options,
  ...serverAlertTypeSchema.options,
]);
export type AlertType = z.infer<typeof alertTypeSchema>;

export const deviceAlertBodySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PERMISSION_REVOKED'), permission: permissionKindSchema }),
  z.object({ type: z.literal('DEVICE_ADMIN_DISABLE_REQUESTED') }),
  z.object({ type: z.literal('DEVICE_ADMIN_DISABLED') }),
  z.object({ type: z.literal('ENFORCEMENT_STOPPED') }),
  z.object({
    type: z.literal('TIME_CHANGED'),
    /** Device clock minus server clock, in seconds. */
    skewSeconds: z.number().int(),
  }),
  z.object({
    type: z.literal('TAMPER_ATTEMPT'),
    /** What was blocked: a protected settings screen or an uninstall dialog. */
    target: z.enum([
      'device_admin',
      'uninstall',
      'accessibility_settings',
      'app_settings',
      'second_space',
    ]),
  }),
  /** Switched to another Android user (Xiaomi Second space, Vivo/Oppo equivalents). */
  z.object({ type: z.literal('SECOND_SPACE_ENTERED') }),
  z.object({
    type: z.literal('SECOND_SPACE_LEFT'),
    minutes: z
      .number()
      .int()
      .min(0)
      .max(60 * 24 * 30),
  }),
]);
export type DeviceAlertBody = z.infer<typeof deviceAlertBodySchema>;

export const alertSchema = z.object({
  id: idSchema,
  deviceId: idSchema,
  childId: idSchema,
  type: alertTypeSchema,
  details: z.record(z.string(), z.unknown()),
  createdAt: isoDateTimeSchema,
  readAt: isoDateTimeSchema.nullable(),
});
export type Alert = z.infer<typeof alertSchema>;

export const listAlertsQuerySchema = z.object({
  childId: idSchema.optional(),
  unreadOnly: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  /** Cursor: return alerts created before this time. */
  before: isoDateTimeSchema.optional(),
});
export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>;

/** Devices send a heartbeat about every minute; silence longer than this raises HEARTBEAT_LOST. */
export const HEARTBEAT_INTERVAL_SECONDS = 60;
export const HEARTBEAT_LOST_AFTER_SECONDS = 10 * 60;
