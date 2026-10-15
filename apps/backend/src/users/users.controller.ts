import { Controller, Get, HttpCode, HttpStatus, Patch, Put } from '@nestjs/common';
import {
  pushTokenBodySchema,
  updateMeBodySchema,
  type PushTokenBody,
  type UpdateMeBody,
  type User,
} from '@safekid/shared';

import { UserAuth } from '../auth/guards.js';
import { CurrentUser, type AuthUser } from '../auth/principal.js';
import { AppException } from '../common/app-exception.js';
import { ZodBody } from '../common/zod.pipe.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserDto } from './user.mapper.js';

@Controller('me')
@UserAuth()
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async me(@CurrentUser() auth: AuthUser): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: auth.id } });
    if (!user) throw AppException.unauthorized();
    return toUserDto(user);
  }

  @Patch()
  async update(
    @CurrentUser() auth: AuthUser,
    @ZodBody(updateMeBodySchema) body: UpdateMeBody,
  ): Promise<User> {
    return toUserDto(await this.prisma.user.update({ where: { id: auth.id }, data: body }));
  }

  @Put('push-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async pushToken(
    @CurrentUser() auth: AuthUser,
    @ZodBody(pushTokenBodySchema) body: PushTokenBody,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: auth.id },
      data: { pushToken: body.token, pushPlatform: body.platform },
    });
  }
}
