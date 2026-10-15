import { Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import {
  createChildBodySchema,
  updateChildBodySchema,
  type Child,
  type CreateChildBody,
  type Family,
  type FamilyRole,
  type UpdateChildBody,
} from '@safekid/shared';

import { UserAuth } from '../auth/guards.js';
import { CurrentUser, type AuthUser } from '../auth/principal.js';
import { UuidParam as Uuid } from '../common/params.js';
import { ZodBody } from '../common/zod.pipe.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChildrenService } from './children.service.js';
import { FamilyAccessService } from './family-access.service.js';
import { toChildDto, toFamilyDto } from './family.mapper.js';

@Controller()
@UserAuth()
export class FamiliesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FamilyAccessService,
    private readonly children: ChildrenService,
  ) {}

  @Get('families/mine')
  async mine(@CurrentUser() user: AuthUser): Promise<Family[]> {
    const memberships = await this.prisma.familyMember.findMany({
      where: { userId: user.id },
      include: { family: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => toFamilyDto(m.family, m.role as FamilyRole));
  }

  @Get('families/:familyId/children')
  async listChildren(
    @CurrentUser() user: AuthUser,
    @Uuid('familyId') familyId: string,
  ): Promise<Child[]> {
    return (await this.children.list(user.id, familyId)).map(toChildDto);
  }

  @Post('families/:familyId/children')
  async createChild(
    @CurrentUser() user: AuthUser,
    @Uuid('familyId') familyId: string,
    @ZodBody(createChildBodySchema) body: CreateChildBody,
  ): Promise<Child> {
    return toChildDto(await this.children.create(user.id, familyId, body));
  }

  @Get('children/:childId')
  async getChild(@CurrentUser() user: AuthUser, @Uuid('childId') childId: string): Promise<Child> {
    return toChildDto(await this.access.requireChild(user.id, childId));
  }

  @Patch('children/:childId')
  async updateChild(
    @CurrentUser() user: AuthUser,
    @Uuid('childId') childId: string,
    @ZodBody(updateChildBodySchema) body: UpdateChildBody,
  ): Promise<Child> {
    return toChildDto(await this.children.update(user.id, childId, body));
  }

  @Delete('children/:childId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteChild(
    @CurrentUser() user: AuthUser,
    @Uuid('childId') childId: string,
  ): Promise<void> {
    await this.children.remove(user.id, childId);
  }
}
