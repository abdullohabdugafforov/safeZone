import { z } from 'zod';

import { commandSchema } from './commands';
import { policyEnvelopeSchema } from './policy';

/** GET /v1/device/state — everything a device needs to converge with the server. */
export const deviceStateResponseSchema = z.object({
  policy: policyEnvelopeSchema,
  pendingCommands: z.array(commandSchema),
});
export type DeviceStateResponse = z.infer<typeof deviceStateResponseSchema>;
