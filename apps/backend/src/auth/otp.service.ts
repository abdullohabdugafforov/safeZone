import { HttpStatus, Injectable } from '@nestjs/common';
import type { OtpRequestResponse } from '@safekid/shared';

import { AppException } from '../common/app-exception.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RateLimitService } from '../rate-limit/rate-limit.service.js';
import { SmsProvider } from '../sms/sms.provider.js';

export const OTP_LIMITS = {
  ttlSeconds: 5 * 60,
  maxAttempts: 5,
  resendCooldownSeconds: 60,
  perPhonePerHour: 5,
  perIpPerHour: 20,
  verifyPerIpPerHour: 60,
} as const;

const HOUR = 60 * 60;

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly rateLimit: RateLimitService,
    private readonly sms: SmsProvider,
  ) {}

  /** Same response whether or not the phone is registered (no enumeration). */
  async request(phone: string, ip: string | null): Promise<OtpRequestResponse> {
    await this.rateLimit.cooldown(`otp:resend:${phone}`, OTP_LIMITS.resendCooldownSeconds);
    await this.rateLimit.consume(
      { key: `otp:req:phone:${phone}`, limit: OTP_LIMITS.perPhonePerHour, windowSeconds: HOUR },
      ...(ip
        ? [{ key: `otp:req:ip:${ip}`, limit: OTP_LIMITS.perIpPerHour, windowSeconds: HOUR }]
        : []),
    );

    const code = this.crypto.numericCode(6);
    const now = new Date();
    await this.prisma.$transaction([
      // Only the newest code is valid.
      this.prisma.otpChallenge.updateMany({
        where: { phone, consumedAt: null },
        data: { consumedAt: now },
      }),
      this.prisma.otpChallenge.create({
        data: {
          phone,
          codeHash: this.crypto.hash(`otp:${phone}`, code),
          expiresAt: new Date(now.getTime() + OTP_LIMITS.ttlSeconds * 1000),
        },
      }),
    ]);
    await this.sms.send(phone, `SafeKid code: ${code}. Do not share it with anyone.`);

    return {
      expiresInSeconds: OTP_LIMITS.ttlSeconds,
      resendAfterSeconds: OTP_LIMITS.resendCooldownSeconds,
    };
  }

  /** Consumes the code or throws OTP_INVALID / OTP_EXPIRED / OTP_TOO_MANY_ATTEMPTS. */
  async verify(phone: string, code: string, ip: string | null): Promise<void> {
    if (ip) {
      await this.rateLimit.consume({
        key: `otp:verify:ip:${ip}`,
        limit: OTP_LIMITS.verifyPerIpPerHour,
        windowSeconds: HOUR,
      });
    }

    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge || challenge.expiresAt <= new Date()) {
      throw new AppException(
        'OTP_EXPIRED',
        'Code expired, request a new one',
        HttpStatus.BAD_REQUEST,
      );
    }

    const { count } = await this.prisma.otpChallenge.updateMany({
      where: { id: challenge.id, attempts: { lt: OTP_LIMITS.maxAttempts } },
      data: { attempts: { increment: 1 } },
    });
    if (count === 0) {
      throw new AppException(
        'OTP_TOO_MANY_ATTEMPTS',
        'Too many attempts, request a new code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!this.crypto.verify(`otp:${phone}`, code, challenge.codeHash)) {
      throw new AppException('OTP_INVALID', 'Wrong code', HttpStatus.BAD_REQUEST);
    }

    const consumed = await this.prisma.otpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count === 0) {
      throw new AppException('OTP_EXPIRED', 'Code already used', HttpStatus.BAD_REQUEST);
    }
  }
}
