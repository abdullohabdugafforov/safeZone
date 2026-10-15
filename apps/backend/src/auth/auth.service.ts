import { Injectable } from '@nestjs/common';
import type { AuthResponse, TokenPair } from '@safekid/shared';

import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserDto } from '../users/user.mapper.js';
import { OtpService } from './otp.service.js';
import { TokenService } from './token.service.js';

const DEFAULT_FAMILY_NAME = 'My family';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  /** Verifies the OTP, creates the parent (and their family) on first login, issues tokens. */
  async login(phone: string, code: string, ip: string | null): Promise<AuthResponse> {
    await this.otp.verify(phone, code, ip);

    let user = await this.prisma.user.findUnique({ where: { phone } });
    const isNewUser = !user;
    if (!user) {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.upsert({ where: { phone }, update: {}, create: { phone } });
        const hasFamily = await tx.familyMember.findFirst({ where: { userId: created.id } });
        if (!hasFamily) {
          await tx.family.create({
            data: {
              name: DEFAULT_FAMILY_NAME,
              members: { create: { userId: created.id, role: 'owner' } },
            },
          });
        }
        return created;
      });
    }

    const tokens = await this.tokens.issuePair({ type: 'user', userId: user.id });
    await this.audit.log({
      actorType: 'user',
      actorId: user.id,
      action: 'auth.login',
      meta: { isNewUser },
      ip,
    });
    return { tokens, user: toUserDto(user), isNewUser };
  }

  async refresh(refreshToken: string, ip: string | null): Promise<TokenPair> {
    return (await this.tokens.rotate(refreshToken, ip)).tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }
}
