import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';
import { z } from 'zod';

export const DEFAULT_PHONE_COUNTRY: CountryCode = 'UZ';

export const idSchema = z.uuid();

export const isoDateTimeSchema = z.iso.datetime({ offset: true });

export const localeSchema = z.enum(['uz', 'ru', 'en']);
export type Locale = z.infer<typeof localeSchema>;

export const platformSchema = z.enum(['android', 'ios']);
export type Platform = z.infer<typeof platformSchema>;

/** Six-digit numeric code (OTP or pairing code). */
export const sixDigitCodeSchema = z.string().regex(/^\d{6}$/, 'Must be exactly 6 digits');

/**
 * Normalizes user-entered phone numbers to E.164.
 * Numbers without a "+" prefix are parsed as Uzbek numbers.
 * Returns null for anything that is not a valid phone number.
 */
export function normalizePhone(
  input: string,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string | null {
  const phone = parsePhoneNumberFromString(input.trim(), defaultCountry);
  return phone?.isValid() ? phone.number : null;
}

/** Masks a phone number for logs and UI, e.g. +998901234567 -> +99890*****67. */
export function maskPhone(e164: string): string {
  if (e164.length <= 7) return '*'.repeat(e164.length);
  return `${e164.slice(0, 6)}${'*'.repeat(e164.length - 8)}${e164.slice(-2)}`;
}

/** Accepts any reasonable phone input and outputs a normalized E.164 string. */
export const phoneSchema = z
  .string()
  .max(32)
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'Invalid phone number' });
      return z.NEVER;
    }
    return normalized;
  });

/** Names of people/children/devices shown in the UI. */
export const displayNameSchema = z.string().trim().min(1).max(50);

/** Opaque app identifier: Android package name now, iOS token later. */
export const appIdSchema = z.string().trim().min(1).max(255);

export const timeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(isValidTimeZone, 'Invalid IANA time zone');

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
