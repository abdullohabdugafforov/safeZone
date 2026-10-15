import { z } from 'zod';

import {
  displayNameSchema,
  idSchema,
  isoDateTimeSchema,
  localeSchema,
  phoneSchema,
  platformSchema,
  sixDigitCodeSchema,
} from './common';

export const otpRequestBodySchema = z.object({
  phone: phoneSchema,
});
export type OtpRequestBody = z.input<typeof otpRequestBodySchema>;

export const otpRequestResponseSchema = z.object({
  expiresInSeconds: z.number().int().positive(),
  resendAfterSeconds: z.number().int().nonnegative(),
});
export type OtpRequestResponse = z.infer<typeof otpRequestResponseSchema>;

export const otpVerifyBodySchema = z.object({
  phone: phoneSchema,
  code: sixDigitCodeSchema,
});
export type OtpVerifyBody = z.input<typeof otpVerifyBodySchema>;

export const tokenPairSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresAt: isoDateTimeSchema,
  refreshToken: z.string().min(1),
});
export type TokenPair = z.infer<typeof tokenPairSchema>;

export const userSchema = z.object({
  id: idSchema,
  phone: z.string(),
  name: z.string().nullable(),
  locale: localeSchema,
  createdAt: isoDateTimeSchema,
});
export type User = z.infer<typeof userSchema>;

export const authResponseSchema = z.object({
  tokens: tokenPairSchema,
  user: userSchema,
  isNewUser: z.boolean(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1).max(512),
});
export type RefreshBody = z.infer<typeof refreshBodySchema>;

export const updateMeBodySchema = z
  .object({
    name: displayNameSchema.optional(),
    locale: localeSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');
export type UpdateMeBody = z.infer<typeof updateMeBodySchema>;

export const pushTokenBodySchema = z.object({
  token: z.string().min(1).max(4096),
  platform: platformSchema,
});
export type PushTokenBody = z.infer<typeof pushTokenBodySchema>;
