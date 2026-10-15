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
