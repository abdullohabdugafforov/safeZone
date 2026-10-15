import { Injectable } from '@nestjs/common';
import {
  createDefaultPolicyDocument,
  DEFAULT_TIMEZONE,
  type CreateChildBody,
  type UpdateChildBody,
} from '@safekid/shared';

import { AuditService } from '../audit/audit.service.js';
import type { Child, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FamilyAccessService } from './family-access.service.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class ChildrenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FamilyAccessService,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string, familyId: string): Promise<Child[]> {
    await this.access.requireMembership(userId, familyId);
    return this.prisma.child.findMany({ where: { familyId }, orderBy: { createdAt: 'asc' } });
  }

  async create(userId: string, familyId: string, body: CreateChildBody): Promise<Child> {
    await this.access.requireMembership(userId, familyId);
    const child = await this.prisma.$transaction((tx) => this.createInTx(tx, familyId, body));
    await this.audit.log({
      actorType: 'user',
      actorId: userId,
      action: 'child.created',
      familyId,
      targetType: 'child',
      targetId: child.id,
    });
    return child;
  }

  /** Creates a child together with its initial (unrestricted) policy version 1. */
  async createInTx(tx: Tx, familyId: string, body: CreateChildBody): Promise<Child> {
    const child = await tx.child.create({
      data: {
        familyId,
        name: body.name,
        birthYear: body.birthYear ?? null,
        currentPolicyVersion: 1,
      },
    });
    await tx.policy.create({
      data: {
        childId: child.id,
        version: 1,
        document: createDefaultPolicyDocument(DEFAULT_TIMEZONE),
      },
    });
    return child;
  }

  async update(userId: string, childId: string, body: UpdateChildBody): Promise<Child> {
    await this.access.requireChild(userId, childId);
    return this.prisma.child.update({ where: { id: childId }, data: body });
  }

  /** Deletes the child; cascades to devices, which revokes their tokens. */
  async remove(userId: string, childId: string): Promise<void> {
    const child = await this.access.requireChild(userId, childId);
    await this.prisma.child.delete({ where: { id: childId } });
    await this.audit.log({
      actorType: 'user',
      actorId: userId,
      action: 'child.deleted',
      familyId: child.familyId,
      targetType: 'child',
      targetId: childId,
    });
  }
}
