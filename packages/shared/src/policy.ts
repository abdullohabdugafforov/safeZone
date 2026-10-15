import { z } from 'zod';

import { appIdSchema, idSchema, isoDateTimeSchema, timeZoneSchema } from './common';

export const POLICY_SCHEMA_VERSION = 1;
export const DEFAULT_TIMEZONE = 'Asia/Tashkent';
export const MAX_POLICY_APPS = 500;

const appListSchema = z
  .array(appIdSchema)
  .max(MAX_POLICY_APPS)
  .refine((apps) => new Set(apps).size === apps.length, 'Duplicate app ids');

export const weekdaySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export type Weekday = z.infer<typeof weekdaySchema>;

/** 24h local time "HH:mm", evaluated on the device in the policy time zone. */
export const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm');

export const lockStateSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('unlocked') }),
  z.object({
    state: z.literal('locked'),
    /** Auto-unlock time; absent means locked until the parent unlocks. */
    until: isoDateTimeSchema.optional(),
  }),
]);
export type LockState = z.infer<typeof lockStateSchema>;

// Phase 2+ fields are part of the schema now so devices can ignore them safely.
export const scheduleSchema = z
  .object({
    id: z.string().min(1).max(64),
    days: z.array(weekdaySchema).min(1).max(7),
    start: localTimeSchema,
    /** May be earlier than start, meaning the window crosses midnight. */
    end: localTimeSchema,
    action: z.literal('lock'),
  })
  .refine((s) => s.start !== s.end, 'Schedule start and end must differ');
export type Schedule = z.infer<typeof scheduleSchema>;

export const appLimitSchema = z.object({
  app: appIdSchema,
  dailyMinutes: z
    .number()
    .int()
    .min(0)
    .max(24 * 60),
});
export type AppLimit = z.infer<typeof appLimitSchema>;

export const policyDocumentSchema = z.object({
  schemaVersion: z.literal(POLICY_SCHEMA_VERSION),
  /** unrestricted: everything allowed except lock/schedules; allowlist: only listed apps run. */
  mode: z.enum(['unrestricted', 'allowlist']),
  allowedApps: appListSchema,
  /** Apps that are never blocked (phone, SMS, emergency). SafeKid itself is always allowed on-device. */
  alwaysAllowedApps: appListSchema,
  lock: lockStateSchema,
  schedules: z.array(scheduleSchema).max(20).default([]),
  appLimits: z.array(appLimitSchema).max(MAX_POLICY_APPS).default([]),
  tempUnlock: z.object({ until: isoDateTimeSchema }).optional(),
  web: z.object({ blockedDomains: z.array(z.string().min(1).max(253)).max(1000) }).optional(),
  timezone: timeZoneSchema,
});
export type PolicyDocument = z.infer<typeof policyDocumentSchema>;
export type PolicyDocumentInput = z.input<typeof policyDocumentSchema>;

/** A versioned policy as stored on the server and delivered to devices. */
export const policyEnvelopeSchema = z.object({
  childId: idSchema,
  version: z.number().int().positive(),
  document: policyDocumentSchema,
  createdAt: isoDateTimeSchema,
});
export type PolicyEnvelope = z.infer<typeof policyEnvelopeSchema>;

export const updatePolicyBodySchema = z.object({
  /** Version the client edited; the server rejects with 409 if it is no longer current. */
  baseVersion: z.number().int().positive(),
  document: policyDocumentSchema,
});
export type UpdatePolicyBody = z.input<typeof updatePolicyBodySchema>;

export const lockBodySchema = z.object({
  until: isoDateTimeSchema
    .refine((until) => Date.parse(until) > Date.now(), 'Lock end must be in the future')
    .optional(),
});
export type LockBody = z.infer<typeof lockBodySchema>;

export const policyAckBodySchema = z.object({
  version: z.number().int().positive(),
});
export type PolicyAckBody = z.infer<typeof policyAckBodySchema>;

/** Policy every new child starts with: nothing restricted. */
export function createDefaultPolicyDocument(timezone: string): PolicyDocument {
  return {
    schemaVersion: POLICY_SCHEMA_VERSION,
    mode: 'unrestricted',
    allowedApps: [],
    alwaysAllowedApps: [],
    lock: { state: 'unlocked' },
    schedules: [],
    appLimits: [],
    timezone,
  };
}
