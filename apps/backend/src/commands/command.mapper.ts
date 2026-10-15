import { commandPayloadSchema, type Command as CommandDto } from '@safekid/shared';

import type { Command } from '../generated/prisma/client.js';

export function toCommandDto(command: Command): CommandDto {
  const { type, payload } = commandPayloadSchema.parse({
    type: command.type,
    payload: command.payload,
  });
  return {
    type,
    payload,
    id: command.id,
    deviceId: command.deviceId,
    status: command.status,
    error: command.error,
    createdAt: command.createdAt.toISOString(),
    expiresAt: command.expiresAt.toISOString(),
    deliveredAt: command.deliveredAt?.toISOString() ?? null,
    ackedAt: command.ackedAt?.toISOString() ?? null,
  } as CommandDto;
}
