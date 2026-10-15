import {
  alertTypeSchema,
  commandStatusSchema,
  commandTypeSchema,
  deviceStatusSchema,
  familyRoleSchema,
  pairingMethodSchema,
  pairingRequestStatusSchema,
  platformSchema,
} from '@safekid/shared';

import {
  AlertType,
  CommandStatus,
  CommandType,
  DeviceStatus,
  FamilyRole,
  PairingMethod,
  PairingRequestStatus,
  Platform,
} from '../generated/prisma/enums.js';

// DB enums must stay identical to the shared API enums.
describe('Prisma enums match shared schemas', () => {
  it.each([
    ['AlertType', AlertType, alertTypeSchema.options],
    ['CommandStatus', CommandStatus, commandStatusSchema.options],
    ['CommandType', CommandType, commandTypeSchema.options],
    ['DeviceStatus', DeviceStatus, deviceStatusSchema.options],
    ['FamilyRole', FamilyRole, familyRoleSchema.options],
    ['PairingMethod', PairingMethod, pairingMethodSchema.options],
    ['PairingRequestStatus', PairingRequestStatus, pairingRequestStatusSchema.options],
    ['Platform', Platform, platformSchema.options],
  ])('%s', (_name, prismaEnum, sharedOptions) => {
    expect(Object.values(prismaEnum).sort()).toEqual([...sharedOptions].sort());
  });
});
