import { HttpStatus, Injectable } from '@nestjs/common';
import {
  buildPairingQrPayload,
  PAIRING_CODE_TTL_SECONDS,
  PAIRING_REQUEST_TTL_SECONDS,
  type ApprovePairingBody,
  type ApprovePairingResponse,
  type CreatePairingRequestResponse,
  type DeviceInfo,
  type PairingClaimResponse,
  type PairingCodeResponse,
  type PairingRequestStatus,
} from '@safekid/shared';

import { AuditService } from '../audit/audit.service.js';
import { TokenService } from '../auth/token.service.js';
import { AppException } from '../common/app-exception.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { ChildrenService } from '../families/children.service.js';
import { FamilyAccessService } from '../families/family-access.service.js';
import type { PairingRequest } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { toPolicyEnvelope } from '../policies/policy.mapper.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RateLimitService } from '../rate-limit/rate-limit.service.js';

const CODE_PURPOSE = 'pairing-code';
const CLAIM_PURPOSE = 'pairing-claim';
const HOUR = 60 * 60;

export const PAIRING_LIMITS = {
  requestsPerIpPerHour: 10,
  requestsPerTargetPhonePerHour: 5,
  pendingPerFamily: 10,
} as const;

export type NewPairingRequest =
  | { method: 'code'; code: string; device: DeviceInfo }
  | { method: 'phone'; parentPhone: string; device: DeviceInfo };

const closed = () =>
  new AppException(
    'PAIRING_REQUEST_CLOSED',
    'Pairing request is no longer pending',
    HttpStatus.CONFLICT,
  );

/**
 * Pairing: parent issues a code -> child device submits a request -> a parent
 * approves -> device claims credentials. A device never gets credentials
 * without an explicit parent approval.
 */
@Injectable()
export class PairingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly access: FamilyAccessService,
    private readonly children: ChildrenService,
    private readonly tokens: TokenService,
    private readonly rateLimit: RateLimitService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  // --- parent: codes --------------------------------------------------------

  async createCode(
    userId: string,
    familyId: string,
    childId?: string,
  ): Promise<PairingCodeResponse> {
    await this.access.requireMembership(userId, familyId);
    if (childId) {
      const child = await this.access.requireChild(userId, childId);
      if (child.familyId !== familyId) throw AppException.notFound('Child');
    }

    const now = new Date();
    // One active code per family keeps the guessable surface minimal.
    await this.prisma.pairingCode.updateMany({
      where: { familyId, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });

    const code = await this.uniqueActiveCode();
    const row = await this.prisma.pairingCode.create({
      data: {
        familyId,
        childId: childId ?? null,
        codeHash: this.crypto.hash(CODE_PURPOSE, code),
        createdById: userId,
        expiresAt: new Date(now.getTime() + PAIRING_CODE_TTL_SECONDS * 1000),
      },
    });
    return {
      id: row.id,
      code,
      qrPayload: buildPairingQrPayload(code),
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  async revokeCode(userId: string, codeId: string): Promise<void> {
    const familyIds = await this.access.familyIdsOf(userId);
    const { count } = await this.prisma.pairingCode.updateMany({
      where: { id: codeId, familyId: { in: familyIds }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw AppException.notFound('Pairing code');
  }

  private async uniqueActiveCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = this.crypto.numericCode(6);
      const clash = await this.prisma.pairingCode.findFirst({
        where: {
          codeHash: this.crypto.hash(CODE_PURPOSE, code),
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      if (!clash) return code;
    }
    throw new AppException(
      'INTERNAL_ERROR',
      'Could not allocate a pairing code',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  // --- child device: requests ----------------------------------------------

  async createRequest(
    body: NewPairingRequest,
    ip: string | null,
  ): Promise<CreatePairingRequestResponse> {
    if (ip) {
      await this.rateLimit.consume({
        key: `pair:req:ip:${ip}`,
        limit: PAIRING_LIMITS.requestsPerIpPerHour,
        windowSeconds: HOUR,
      });
    }

    let familyId: string | null;
    let pairingCodeId: string | null = null;
    let childId: string | null = null;

    if (body.method === 'code') {
      const code = await this.prisma.pairingCode.findFirst({
        where: {
          codeHash: this.crypto.hash(CODE_PURPOSE, body.code),
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (!code) {
        throw new AppException(
          'PAIRING_CODE_INVALID',
          'Code is invalid or expired',
          HttpStatus.BAD_REQUEST,
        );
      }
      ({ familyId, childId } = code);
      pairingCodeId = code.id;
    } else {
      await this.rateLimit.consume({
        key: `pair:req:phone:${body.parentPhone}`,
        limit: PAIRING_LIMITS.requestsPerTargetPhonePerHour,
        windowSeconds: HOUR,
      });
      // Unknown phones still get a (dead) request so responses don't reveal who is registered.
      const membership = await this.prisma.familyMember.findFirst({
        where: { user: { phone: body.parentPhone } },
        orderBy: { createdAt: 'asc' },
      });
      familyId = membership?.familyId ?? null;
    }

    if (familyId) {
      const pending = await this.prisma.pairingRequest.count({
        where: { familyId, status: 'pending', expiresAt: { gt: new Date() } },
      });
      if (pending >= PAIRING_LIMITS.pendingPerFamily)
        throw AppException.rateLimited(PAIRING_REQUEST_TTL_SECONDS);
    }

    const claimSecret = this.crypto.token();
    const request = await this.prisma.pairingRequest.create({
      data: {
        familyId,
        pairingCodeId,
        childId,
        method: body.method,
        claimSecretHash: this.crypto.hash(CLAIM_PURPOSE, claimSecret),
        deviceInfo: body.device,
        requesterIp: ip,
        expiresAt: new Date(Date.now() + PAIRING_REQUEST_TTL_SECONDS * 1000),
      },
    });

    if (familyId) {
      await this.notifications.notifyFamily(familyId, {
        type: 'pairing.requested',
        requestId: request.id,
      });
      await this.audit.log({
        actorType: 'anonymous',
        action: 'pairing.requested',
        familyId,
        targetType: 'pairing_request',
        targetId: request.id,
        meta: { method: body.method },
        ip,
      });
    }
    return { requestId: request.id, claimSecret, expiresAt: request.expiresAt.toISOString() };
  }

  async status(requestId: string, claimSecret: string): Promise<PairingRequestStatus> {
    return this.effectiveStatus(await this.requireOwnRequest(requestId, claimSecret));
  }

  /** Exchanges an approved request for device credentials. Works exactly once. */
  async claim(
    requestId: string,
    claimSecret: string,
    ip: string | null,
  ): Promise<PairingClaimResponse> {
    const request = await this.requireOwnRequest(requestId, claimSecret);
    const status = this.effectiveStatus(request);
    if (status === 'pending') {
      throw new AppException(
        'PAIRING_NOT_APPROVED',
        'Waiting for parent approval',
        HttpStatus.FORBIDDEN,
      );
    }
    if (status !== 'approved' || !request.deviceId) throw closed();

    const { count } = await this.prisma.pairingRequest.updateMany({
      where: { id: request.id, status: 'approved', claimedAt: null },
      data: { claimedAt: new Date() },
    });
    if (count === 0) throw closed();

    const device = await this.prisma.device.findUniqueOrThrow({
      where: { id: request.deviceId },
      include: { child: true },
    });
    if (device.status !== 'active') throw closed();
    const policy = await this.prisma.policy.findUniqueOrThrow({
      where: {
        childId_version: { childId: device.childId, version: device.child.currentPolicyVersion },
      },
    });

    const tokens = await this.tokens.issuePair({ type: 'device', deviceId: device.id });
    await this.audit.log({
      actorType: 'device',
      actorId: device.id,
      action: 'pairing.claimed',
      familyId: device.child.familyId,
      targetType: 'device',
      targetId: device.id,
      ip,
    });
    return {
      deviceId: device.id,
      childId: device.childId,
      childName: device.child.name,
      tokens,
      policy: toPolicyEnvelope(policy),
    };
  }

  /** Wrong id or wrong secret both look like "not found". */
  private async requireOwnRequest(requestId: string, claimSecret: string): Promise<PairingRequest> {
    const request = await this.prisma.pairingRequest.findUnique({ where: { id: requestId } });
    if (!request || !this.crypto.verify(CLAIM_PURPOSE, claimSecret, request.claimSecretHash)) {
      throw AppException.notFound('Pairing request');
    }
    return request;
  }

  private effectiveStatus(request: PairingRequest): PairingRequestStatus {
    if (request.status === 'pending' && request.expiresAt <= new Date()) return 'expired';
    return request.status;
  }

  // --- parent: review -------------------------------------------------------

  async listPending(userId: string): Promise<(PairingRequest & { familyId: string })[]> {
    const familyIds = await this.access.familyIdsOf(userId);
    const rows = await this.prisma.pairingRequest.findMany({
      where: { familyId: { in: familyIds }, status: 'pending', expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return rows as (PairingRequest & { familyId: string })[];
  }

  async approve(
    userId: string,
    requestId: string,
    body: ApprovePairingBody,
  ): Promise<ApprovePairingResponse> {
    const request = await this.requireFamilyRequest(userId, requestId);
    const familyId = request.familyId;
    const device = deviceFromRequest(request);

    const result = await this.prisma.$transaction(async (tx) => {
      const childId =
        'childId' in body
          ? (await this.access.requireChild(userId, body.childId)).id
          : (await this.children.createInTx(tx, familyId, { name: body.newChildName })).id;

      const child = await tx.child.findUniqueOrThrow({ where: { id: childId } });
      if (child.familyId !== familyId) throw AppException.notFound('Child');

      // Conditional transition guarantees a request is decided only once.
      const { count } = await tx.pairingRequest.updateMany({
        where: { id: request.id, status: 'pending', expiresAt: { gt: new Date() } },
        data: { status: 'approved', decidedById: userId, decidedAt: new Date(), childId },
      });
      if (count === 0) throw closed();

      const created = await tx.device.create({ data: { childId, ...device } });
      await tx.pairingRequest.update({ where: { id: request.id }, data: { deviceId: created.id } });
      if (request.pairingCodeId) {
        await tx.pairingCode.update({
          where: { id: request.pairingCodeId },
          data: { revokedAt: new Date() },
        });
      }
      return { deviceId: created.id, childId };
    });

    await this.audit.log({
      actorType: 'user',
      actorId: userId,
      action: 'pairing.approved',
      familyId,
      targetType: 'device',
      targetId: result.deviceId,
      meta: { requestId: request.id, childId: result.childId },
    });
    return result;
  }

  async reject(userId: string, requestId: string): Promise<void> {
    const request = await this.requireFamilyRequest(userId, requestId);
    const { count } = await this.prisma.pairingRequest.updateMany({
      where: { id: request.id, status: 'pending' },
      data: { status: 'rejected', decidedById: userId, decidedAt: new Date() },
    });
    if (count === 0) throw closed();
    await this.audit.log({
      actorType: 'user',
      actorId: userId,
      action: 'pairing.rejected',
      familyId: request.familyId,
      targetType: 'pairing_request',
      targetId: request.id,
    });
  }

  private async requireFamilyRequest(
    userId: string,
    requestId: string,
  ): Promise<PairingRequest & { familyId: string }> {
    const familyIds = await this.access.familyIdsOf(userId);
    const request = await this.prisma.pairingRequest.findFirst({
      where: { id: requestId, familyId: { in: familyIds } },
    });
    if (!request || !request.familyId) throw AppException.notFound('Pairing request');
    if (this.effectiveStatus(request) !== 'pending') throw closed();
    return request as PairingRequest & { familyId: string };
  }
}

function deviceFromRequest(request: PairingRequest) {
  const info = request.deviceInfo as DeviceInfo;
  return {
    platform: info.platform,
    model: info.model,
    osVersion: info.osVersion,
    appVersion: info.appVersion,
    deviceName: info.deviceName ?? null,
  };
}
