import { z } from 'zod';

import { displayNameSchema, idSchema, isoDateTimeSchema } from './common';

export const familyRoleSchema = z.enum(['owner', 'parent']);
export type FamilyRole = z.infer<typeof familyRoleSchema>;

export const familySchema = z.object({
  id: idSchema,
  name: z.string(),
  role: familyRoleSchema,
  createdAt: isoDateTimeSchema,
});
export type Family = z.infer<typeof familySchema>;

export const createFamilyBodySchema = z.object({
  name: displayNameSchema,
});
export type CreateFamilyBody = z.infer<typeof createFamilyBodySchema>;

const birthYearSchema = z
  .number()
  .int()
  .min(1990)
  .refine((year) => year <= new Date().getUTCFullYear(), 'Birth year is in the future');

export const createChildBodySchema = z.object({
  name: displayNameSchema,
  birthYear: birthYearSchema.optional(),
});
export type CreateChildBody = z.infer<typeof createChildBodySchema>;

export const updateChildBodySchema = createChildBodySchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');
export type UpdateChildBody = z.infer<typeof updateChildBodySchema>;

export const childSchema = z.object({
  id: idSchema,
  familyId: idSchema,
  name: z.string(),
  birthYear: z.number().int().nullable(),
  currentPolicyVersion: z.number().int().positive(),
  createdAt: isoDateTimeSchema,
});
export type Child = z.infer<typeof childSchema>;
