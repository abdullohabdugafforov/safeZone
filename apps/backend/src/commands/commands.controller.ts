import { Controller, Get, Post } from '@nestjs/common';
import { createCommandBodySchema, type Command, type CreateCommandBody } from '@safekid/shared';

import { UserAuth } from '../auth/guards.js';
import { CurrentUser, type AuthUser } from '../auth/principal.js';
import { UuidParam } from '../common/params.js';
import { ZodBody } from '../common/zod.pipe.js';
import { toCommandDto } from './command.mapper.js';
import { CommandsService } from './commands.service.js';

@Controller('devices/:deviceId/commands')
@UserAuth()
export class CommandsController {
  constructor(private readonly commands: CommandsService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @UuidParam('deviceId') deviceId: string,
    @ZodBody(createCommandBodySchema) body: CreateCommandBody,
  ): Promise<Command> {
    return toCommandDto(await this.commands.create(user.id, deviceId, body));
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @UuidParam('deviceId') deviceId: string,
  ): Promise<Command[]> {
    return (await this.commands.list(user.id, deviceId)).map(toCommandDto);
  }
}
