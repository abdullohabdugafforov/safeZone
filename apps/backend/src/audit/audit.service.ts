import { Injectable, Logger } from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuditEvent {
  actorType: 'user' | 'device' | 'system' | 'anonymous';
  actorId?: string | null;
  action: string;
  familyId?: string | null;
  targetType?: string;
  targetId?: string;
  /** Never put secrets, OTPs, tokens or full phone numbers here. */
  meta?: Prisma.InputJsonObject;
  ip?: string | null;
}

/** Append-only log of security-relevant actions. Failures never break the request. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(event: AuditEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({ data: { ...event, meta: event.meta ?? {} } });
    } catch (error) {
      this.logger.error(`Failed to write audit log ${event.action}`, error as Error);
    }
  }
}
