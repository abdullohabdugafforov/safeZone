import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG } from '../config/config.module.js';
import type { Env } from '../config/env.js';

/**
 * Secrets at rest (OTPs, pairing codes, claim secrets, refresh tokens) are stored
 * as HMAC-SHA256 with a server-side pepper. `purpose` domain-separates hashes so a
 * value hashed for one use can never match another.
 */
@Injectable()
export class CryptoService {
  constructor(@Inject(APP_CONFIG) private readonly config: Env) {}

  hash(purpose: string, value: string): string {
    return createHmac('sha256', this.config.HASH_PEPPER)
      .update(`${purpose}:${value}`)
      .digest('hex');
  }

  verify(purpose: string, value: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hash(purpose, value), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  /** Uniformly random numeric code, e.g. 6 digits for OTP and pairing codes. */
  numericCode(digits = 6): string {
    return randomInt(0, 10 ** digits)
      .toString()
      .padStart(digits, '0');
  }

  /** URL-safe random token with 256 bits of entropy. */
  token(prefix = ''): string {
    return `${prefix}${randomBytes(32).toString('base64url')}`;
  }
}
