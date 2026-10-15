import { HttpStatus, Injectable } from '@nestjs/common';
import type { LockState, PolicyDocument } from '@safekid/shared';

import { AuditService } from '../audit/audit.service.js';
import { AppException } from '../common/app-exception.js';
import { FamilyAccessService } from '../families/family-access.service.js';
import type { Policy } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toPolicyEnvelope } from './policy.mapper.js';

const MAX_LOCK_RETRIES = 3;

/**
 * Policies are append-only versions per child; `children.current_policy_version`
 * points at the active one. Writes use optimistic concurrency on that pointer.
 */
@Injectable()
export class PoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FamilyAccessService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async current(userId: string, childId: string): Promise<Policy> {
    const child = await this.access.requireChild(userId, childId);
    return this.currentForChild(child.id, child.currentPolicyVersion);
  }

  async currentForChild(childId: string, version?: number): Promise<Policy> {
    const resolved =
      version ??
      (
        await this.prisma.child.findUniqueOrThrow({
          where: { id: childId },
          select: { currentPolicyVersion: true },
        })
      ).currentPolicyVersion;
    return this.prisma.policy.findUniqueOrThrow({
      where: { childId_version: { childId, version: resolved } },
    });
  }

  async versions(userId: string, childId: string, limit = 20): Promise<Policy[]> {
    await this.access.requireChild(userId, childId);
    return this.prisma.policy.findMany({
      where: { childId },
      orderBy: { version: 'desc' },
      take: limit,
    });
  }

  /** Creates version baseVersion+1, or throws POLICY_VERSION_CONFLICT if baseVersion is stale. */
  async update(
    userId: string,
    childId: string,
    baseVersion: number,
    document: PolicyDocument,
  ): Promise<Policy> {
    const child = await this.access.requireChild(userId, childId);
    const policy = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.child.updateMany({
        where: { id: childId, currentPolicyVersion: baseVersion },
        data: { currentPolicyVersion: baseVersion + 1 },
      });
      if (count === 0) {
        const fresh = await tx.child.findUniqueOrThrow({ where: { id: childId } });
        throw new AppException(
          'POLICY_VERSION_CONFLICT',
          'Policy was changed meanwhile',
          HttpStatus.CONFLICT,
          {
            currentVersion: fresh.currentPolicyVersion,
          },
        );
      }
      return tx.policy.create({
        data: { childId, version: baseVersion + 1, document, createdById: userId },
      });
    });

    await this.audit.log({
      actorType: 'user',
      actorId: userId,
      action: 'policy.updated',
      familyId: child.familyId,
      targetType: 'child',
      targetId: childId,
      meta: { version: policy.version, mode: document.mode, lock: document.lock.state },
    });
    await this.notifications.notifyChildDevices(childId, { type: 'sync' });
    return policy;
  }

  /** Lock/unlock is a policy change so it is durable and enforced offline. */
  async setLock(userId: string, childId: string, lock: LockState): Promise<Policy> {
    for (let attempt = 1; ; attempt++) {
      const current = toPolicyEnvelope(await this.current(userId, childId));
      try {
        return await this.update(userId, childId, current.version, { ...current.document, lock });
      } catch (error) {
        const conflict = error instanceof AppException && error.code === 'POLICY_VERSION_CONFLICT';
        if (!conflict || attempt >= MAX_LOCK_RETRIES) throw error;
      }
    }
  }
}
