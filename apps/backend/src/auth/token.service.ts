import { randomUUID } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { TokenPair } from '@safekid/shared';
import { jwtVerify, SignJWT } from 'jose';

import { AuditService } from '../audit/audit.service.js';
import { AppException } from '../common/app-exception.js';
import { APP_CONFIG } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type Audience = 'user' | 'device';
export type TokenOwner = { type: 'user'; userId: string } | { type: 'device'; deviceId: string };

const ISSUER = 'safekid';
const REFRESH_PURPOSE = 'refresh';
const DAY_MS = 24 * 60 * 60 * 1000;

const invalidRefresh = () =>
  new AppException('REFRESH_TOKEN_INVALID', 'Refresh token is invalid', HttpStatus.UNAUTHORIZED);

/**
 * Short-lived JWT access tokens + opaque rotating refresh tokens.
 * Refresh tokens are stored hashed; presenting an already-rotated token is
 * treated as theft and revokes the whole rotation chain.
 */
@Injectable()
export class TokenService {
  private readonly key: Uint8Array;

  constructor(
    @Inject(APP_CONFIG) private readonly config: Env,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {
    this.key = new TextEncoder().encode(config.JWT_ACCESS_SECRET);
  }

  async issuePair(owner: TokenOwner, chainId: string = randomUUID()): Promise<TokenPair> {
    const refreshToken = this.crypto.token('rt_');
    const ttlDays =
      owner.type === 'user'
        ? this.config.USER_REFRESH_TTL_DAYS
        : this.config.DEVICE_REFRESH_TTL_DAYS;
    await this.prisma.refreshToken.create({
      data: {
        userId: owner.type === 'user' ? owner.userId : null,
        deviceId: owner.type === 'device' ? owner.deviceId : null,
        tokenHash: this.crypto.hash(REFRESH_PURPOSE, refreshToken),
        chainId,
        expiresAt: new Date(Date.now() + ttlDays * DAY_MS),
      },
    });
    const access = await this.signAccess(
      owner.type,
      owner.type === 'user' ? owner.userId : owner.deviceId,
    );
    return { accessToken: access.token, accessTokenExpiresAt: access.expiresAt, refreshToken };
  }

  async signAccess(aud: Audience, sub: string): Promise<{ token: string; expiresAt: string }> {
    const expiresAt = new Date(Date.now() + this.config.JWT_ACCESS_TTL_SECONDS * 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(ISSUER)
      .setAudience(aud)
      .setSubject(sub)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.key);
    return { token, expiresAt: expiresAt.toISOString() };
  }

  /** Returns the subject id; throws 401 for any invalid, expired or wrong-audience token. */
  async verifyAccess(token: string, aud: Audience): Promise<string> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: aud,
        algorithms: ['HS256'],
      });
      if (!payload.sub) throw new Error('missing sub');
      return payload.sub;
    } catch {
      throw AppException.unauthorized('Invalid or expired access token');
    }
  }

  async rotate(
    refreshToken: string,
    ip: string | null,
  ): Promise<{ owner: TokenOwner; tokens: TokenPair }> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.crypto.hash(REFRESH_PURPOSE, refreshToken) },
      include: { device: { select: { status: true } } },
    });
    if (!row) throw invalidRefresh();

    const owner: TokenOwner = row.userId
      ? { type: 'user', userId: row.userId }
      : { type: 'device', deviceId: row.deviceId! };

    // Conditional update makes concurrent rotations of the same token race-safe.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: row.id, rotatedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { rotatedAt: new Date() },
    });
    if (count === 0) {
      if (row.rotatedAt) {
        await this.revokeChain(row.chainId);
        await this.audit.log({
          actorType: owner.type,
          actorId: owner.type === 'user' ? owner.userId : owner.deviceId,
          action: 'auth.refresh_token_reuse',
          meta: { chainId: row.chainId },
          ip,
        });
      }
      throw invalidRefresh();
    }
    if (row.device && row.device.status !== 'active') {
      await this.revokeChain(row.chainId);
      throw new AppException(
        'DEVICE_UNLINKED',
        'Device is no longer linked',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return { owner, tokens: await this.issuePair(owner, row.chainId) };
  }

  /** Revokes the chain of the given refresh token, if it exists. */
  async revoke(refreshToken: string): Promise<void> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.crypto.hash(REFRESH_PURPOSE, refreshToken) },
      select: { chainId: true },
    });
    if (row) await this.revokeChain(row.chainId);
  }

  async revokeAllForDevice(deviceId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeChain(chainId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { chainId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
