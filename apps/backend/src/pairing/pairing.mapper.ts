import { deviceInfoSchema, type PairingRequest as PairingRequestDto } from '@safekid/shared';

import type { PairingRequest } from '../generated/prisma/client.js';

export function toPairingRequestDto(
  request: PairingRequest & { familyId: string },
): PairingRequestDto {
  return {
    id: request.id,
    familyId: request.familyId,
    method: request.method,
    childId: request.childId,
    device: deviceInfoSchema.parse(request.deviceInfo),
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    expiresAt: request.expiresAt.toISOString(),
  };
}
