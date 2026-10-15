import { Injectable } from '@nestjs/common';

import { AppException } from '../common/app-exception.js';
import type { Child, Device, FamilyMember } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Single place that answers "may this parent touch this resource?".
 * Every lookup is scoped by the caller's family membership; resources of other
 * families yield 404 so their existence is not revealed.
 */
@Injectable()
export class FamilyAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireMembership(userId: string, familyId: string): Promise<FamilyMember> {
    const member = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });
    if (!member) throw AppException.notFound('Family');
    return member;
  }

  async familyIdsOf(userId: string): Promise<string[]> {
    const rows = await this.prisma.familyMember.findMany({
      where: { userId },
      select: { familyId: true },
    });
    return rows.map((row) => row.familyId);
  }

  async requireChild(userId: string, childId: string): Promise<Child> {
    const child = await this.prisma.child.findFirst({
      where: { id: childId, family: { members: { some: { userId } } } },
    });
    if (!child) throw AppException.notFound('Child');
    return child;
  }

  async requireDevice(userId: string, deviceId: string): Promise<Device & { child: Child }> {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, child: { family: { members: { some: { userId } } } } },
      include: { child: true },
    });
    if (!device) throw AppException.notFound('Device');
    return device;
  }
}
