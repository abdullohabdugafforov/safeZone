import { z } from 'zod';

import { tokenPairSchema } from './auth';
import {
  displayNameSchema,
  idSchema,
  isoDateTimeSchema,
  phoneSchema,
  sixDigitCodeSchema,
} from './common';
import { deviceInfoSchema } from './device';
import { policyEnvelopeSchema } from './policy';

export const PAIRING_CODE_TTL_SECONDS = 10 * 60;

// --- Parent: issue a code -------------------------------------------------

export const createPairingCodeBodySchema = z.object({
  /** Link to an existing child; omit to let the parent pick/create the child at approval. */
  childId: idSchema.optional(),
});
export type CreatePairingCodeBody = z.infer<typeof createPairingCodeBodySchema>;

export const pairingCodeResponseSchema = z.object({
  id: idSchema,
  code: sixDigitCodeSchema,
  qrPayload: z.string(),
  expiresAt: isoDateTimeSchema,
});
export type PairingCodeResponse = z.infer<typeof pairingCodeResponseSchema>;

const QR_PREFIX = 'safekid://pair?code=';

export function buildPairingQrPayload(code: string): string {
  return `${QR_PREFIX}${code}`;
}

/** Returns the pairing code from a scanned QR payload, or null if it is not ours. */
export function parsePairingQrPayload(payload: string): string | null {
  if (!payload.startsWith(QR_PREFIX)) return null;
  const code = payload.slice(QR_PREFIX.length);
  return sixDigitCodeSchema.safeParse(code).success ? code : null;
}

// --- Child: submit a request ---------------------------------------------

export const pairingMethodSchema = z.enum(['code', 'phone']);
export type PairingMethod = z.infer<typeof pairingMethodSchema>;

export const createPairingRequestBodySchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('code'), code: sixDigitCodeSchema, device: deviceInfoSchema }),
  z.object({ method: z.literal('phone'), parentPhone: phoneSchema, device: deviceInfoSchema }),
]);
export type CreatePairingRequestBody = z.input<typeof createPairingRequestBodySchema>;

export const createPairingRequestResponseSchema = z.object({
  requestId: idSchema,
  /** Secret only the requesting device knows; required to poll and claim. Never shown to the parent. */
  claimSecret: z.string().min(32),
  expiresAt: isoDateTimeSchema,
});
export type CreatePairingRequestResponse = z.infer<typeof createPairingRequestResponseSchema>;

export const pairingRequestStatusSchema = z.enum(['pending', 'approved', 'rejected', 'expired']);
export type PairingRequestStatus = z.infer<typeof pairingRequestStatusSchema>;

export const claimSecretBodySchema = z.object({
  claimSecret: z.string().min(32).max(128),
});
export type ClaimSecretBody = z.infer<typeof claimSecretBodySchema>;

export const pairingRequestStatusResponseSchema = z.object({
  status: pairingRequestStatusSchema,
});
export type PairingRequestStatusResponse = z.infer<typeof pairingRequestStatusResponseSchema>;

export const pairingClaimResponseSchema = z.object({
  deviceId: idSchema,
  childId: idSchema,
  childName: z.string(),
  tokens: tokenPairSchema,
  policy: policyEnvelopeSchema,
});
export type PairingClaimResponse = z.infer<typeof pairingClaimResponseSchema>;

// --- Parent: review requests ---------------------------------------------

export const pairingRequestSchema = z.object({
  id: idSchema,
  familyId: idSchema,
  method: pairingMethodSchema,
  /** Child preselected by the pairing code, if any. */
  childId: idSchema.nullable(),
  device: deviceInfoSchema,
  status: pairingRequestStatusSchema,
  createdAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema,
});
export type PairingRequest = z.infer<typeof pairingRequestSchema>;

export const approvePairingBodySchema = z.union([
  z.object({ childId: idSchema }).strict(),
  z.object({ newChildName: displayNameSchema }).strict(),
]);
export type ApprovePairingBody = z.infer<typeof approvePairingBodySchema>;
