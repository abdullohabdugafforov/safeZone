import { z } from 'zod';

import { idSchema, isoDateTimeSchema } from './common';

/**
 * One-off device actions. Durable state (lock, allowlist) lives in the policy,
 * not in commands — see docs/ARCHITECTURE.md §5.
 */
export const commandTypeSchema = z.enum(['SYNC_NOW', 'REPORT_APPS', 'REFRESH_PERMISSIONS']);
export type CommandType = z.infer<typeof commandTypeSchema>;

const emptyPayload = z.object({}).strict();

/** Payload shape per command type; add new commands here. */
export const commandPayloadSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('SYNC_NOW'), payload: emptyPayload }),
  z.object({ type: z.literal('REPORT_APPS'), payload: emptyPayload }),
  z.object({ type: z.literal('REFRESH_PERMISSIONS'), payload: emptyPayload }),
]);
export type CommandPayload = z.infer<typeof commandPayloadSchema>;

export const DEFAULT_COMMAND_TTL_SECONDS = 24 * 60 * 60;

export const createCommandBodySchema = z.intersection(
  commandPayloadSchema,
  z.object({
    ttlSeconds: z
      .number()
      .int()
      .min(60)
      .max(7 * 24 * 60 * 60)
      .optional(),
  }),
);
export type CreateCommandBody = z.infer<typeof createCommandBodySchema>;

export const commandStatusSchema = z.enum(['pending', 'delivered', 'applied', 'failed', 'expired']);
export type CommandStatus = z.infer<typeof commandStatusSchema>;

export const commandSchema = z.intersection(
  commandPayloadSchema,
  z.object({
    id: idSchema,
    deviceId: idSchema,
    status: commandStatusSchema,
    error: z.string().nullable(),
    createdAt: isoDateTimeSchema,
    expiresAt: isoDateTimeSchema,
    deliveredAt: isoDateTimeSchema.nullable(),
    ackedAt: isoDateTimeSchema.nullable(),
  }),
);
export type Command = z.infer<typeof commandSchema>;

export const commandAckBodySchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('applied') }),
  z.object({ status: z.literal('failed'), error: z.string().trim().min(1).max(500) }),
]);
export type CommandAckBody = z.infer<typeof commandAckBodySchema>;
