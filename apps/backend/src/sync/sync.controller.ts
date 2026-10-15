import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  commandAckBodySchema,
  policyAckBodySchema,
  type CommandAckBody,
  type DeviceStateResponse,
  type PolicyAckBody,
} from '@safekid/shared';

import { DeviceAuth } from '../auth/guards.js';
import { CurrentDevice, type AuthDevice } from '../auth/principal.js';
import { AppException } from '../common/app-exception.js';
import { UuidParam } from '../common/params.js';
import { ZodBody } from '../common/zod.pipe.js';
import { toCommandDto } from '../commands/command.mapper.js';
import { CommandsService } from '../commands/commands.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PoliciesService } from '../policies/policies.service.js';
import { toPolicyEnvelope } from '../policies/policy.mapper.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Device pulls state after any hint (push, socket, heartbeat) and acks what it applied. */
@Controller('device')
@DeviceAuth()
export class SyncController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: PoliciesService,
    private readonly commands: CommandsService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get('state')
  async state(@CurrentDevice() device: AuthDevice): Promise<DeviceStateResponse> {
    const [policy, commands] = await Promise.all([
      this.policies.currentForChild(device.childId),
      this.commands.takeOpen(device.id),
    ]);
    return { policy: toPolicyEnvelope(policy), pendingCommands: commands.map(toCommandDto) };
  }

  @Post('policy/ack')
  @HttpCode(HttpStatus.NO_CONTENT)
  async ackPolicy(
    @CurrentDevice() device: AuthDevice,
    @ZodBody(policyAckBodySchema) body: PolicyAckBody,
  ): Promise<void> {
    const child = await this.prisma.child.findUniqueOrThrow({ where: { id: device.childId } });
    if (body.version > child.currentPolicyVersion) {
      throw new AppException('VALIDATION_FAILED', 'Unknown policy version', HttpStatus.BAD_REQUEST);
    }
    await this.prisma.device.update({
      where: { id: device.id },
      data: { appliedPolicyVersion: body.version },
    });
    await this.notifications.notifyFamily(device.familyId, {
      type: 'device.updated',
      deviceId: device.id,
    });
  }

  @Post('commands/:commandId/ack')
  @HttpCode(HttpStatus.NO_CONTENT)
  ackCommand(
    @CurrentDevice() device: AuthDevice,
    @UuidParam('commandId') commandId: string,
    @ZodBody(commandAckBodySchema) body: CommandAckBody,
  ): Promise<void> {
    return this.commands.ack(device, commandId, body);
  }
}
