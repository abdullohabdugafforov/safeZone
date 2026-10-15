import { z } from 'zod';

import { idSchema } from './common';

/**
 * Realtime (Socket.IO) and push (FCM data) messages. Both are hints only:
 * receivers re-fetch state over REST. Payloads therefore carry ids, never data.
 */
export const REALTIME_NAMESPACE = '/realtime';

export const realtimeEventSchema = z.discriminatedUnion('type', [
  // to parents
  z.object({ type: z.literal('pairing.requested'), requestId: idSchema }),
  z.object({ type: z.literal('device.updated'), deviceId: idSchema }),
  z.object({ type: z.literal('alert.created'), alertId: idSchema, deviceId: idSchema }),
  // to devices
  z.object({ type: z.literal('sync') }),
  z.object({ type: z.literal('pairing.approved'), requestId: idSchema }),
]);
export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;
export type RealtimeEventType = RealtimeEvent['type'];

/** FCM data messages only support string values. */
export function toPushData(event: RealtimeEvent): Record<string, string> {
  return Object.fromEntries(Object.entries(event).map(([k, v]) => [k, String(v)]));
}

export function fromPushData(data: Record<string, unknown>): RealtimeEvent | null {
  const parsed = realtimeEventSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
