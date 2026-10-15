import { Controller, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import {
  lockBodySchema,
  updatePolicyBodySchema,
  type LockBody,
  type PolicyEnvelope,
} from '@safekid/shared';
import type { z } from 'zod';

import { UserAuth } from '../auth/guards.js';
import { CurrentUser, type AuthUser } from '../auth/principal.js';
import { UuidParam } from '../common/params.js';
import { ZodBody } from '../common/zod.pipe.js';
import { PoliciesService } from './policies.service.js';
import { toPolicyEnvelope } from './policy.mapper.js';

@Controller('children/:childId')
@UserAuth()
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Get('policy')
  async current(
    @CurrentUser() user: AuthUser,
    @UuidParam('childId') childId: string,
  ): Promise<PolicyEnvelope> {
    return toPolicyEnvelope(await this.policies.current(user.id, childId));
  }

  @Put('policy')
  async update(
    @CurrentUser() user: AuthUser,
    @UuidParam('childId') childId: string,
    @ZodBody(updatePolicyBodySchema) body: z.output<typeof updatePolicyBodySchema>,
  ): Promise<PolicyEnvelope> {
    return toPolicyEnvelope(
      await this.policies.update(user.id, childId, body.baseVersion, body.document),
    );
  }

  @Get('policy/versions')
  async versions(
    @CurrentUser() user: AuthUser,
    @UuidParam('childId') childId: string,
  ): Promise<PolicyEnvelope[]> {
    return (await this.policies.versions(user.id, childId)).map(toPolicyEnvelope);
  }

  @Post('lock')
  @HttpCode(HttpStatus.OK)
  async lock(
    @CurrentUser() user: AuthUser,
    @UuidParam('childId') childId: string,
    @ZodBody(lockBodySchema) body: LockBody,
  ): Promise<PolicyEnvelope> {
    const lock = body.until
      ? { state: 'locked' as const, until: body.until }
      : { state: 'locked' as const };
    return toPolicyEnvelope(await this.policies.setLock(user.id, childId, lock));
  }

  @Post('unlock')
  @HttpCode(HttpStatus.OK)
  async unlock(
    @CurrentUser() user: AuthUser,
    @UuidParam('childId') childId: string,
  ): Promise<PolicyEnvelope> {
    return toPolicyEnvelope(await this.policies.setLock(user.id, childId, { state: 'unlocked' }));
  }
}
