import type { Child as ChildDto, Family as FamilyDto, FamilyRole } from '@safekid/shared';

import type { Child, Family } from '../generated/prisma/client.js';

export function toFamilyDto(family: Family, role: FamilyRole): FamilyDto {
  return { id: family.id, name: family.name, role, createdAt: family.createdAt.toISOString() };
}

export function toChildDto(child: Child): ChildDto {
  return {
    id: child.id,
    familyId: child.familyId,
    name: child.name,
    birthYear: child.birthYear,
    currentPolicyVersion: child.currentPolicyVersion,
    createdAt: child.createdAt.toISOString(),
  };
}
