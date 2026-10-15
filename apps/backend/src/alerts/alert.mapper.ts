import type { Alert as AlertDto } from '@safekid/shared';

import type { Alert } from '../generated/prisma/client.js';

export function toAlertDto(alert: Alert): AlertDto {
  return {
    id: alert.id,
    deviceId: alert.deviceId,
    childId: alert.childId,
    type: alert.type,
    details: (alert.details ?? {}) as Record<string, unknown>,
    createdAt: alert.createdAt.toISOString(),
    readAt: alert.readAt?.toISOString() ?? null,
  };
}
