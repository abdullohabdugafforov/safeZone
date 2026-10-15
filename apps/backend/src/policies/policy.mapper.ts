import { policyDocumentSchema, type PolicyEnvelope } from '@safekid/shared';

import type { Policy } from '../generated/prisma/client.js';

export function toPolicyEnvelope(policy: Policy): PolicyEnvelope {
  return {
    childId: policy.childId,
    version: policy.version,
    // Stored documents were validated on write; parsing again guards against drift.
    document: policyDocumentSchema.parse(policy.document),
    createdAt: policy.createdAt.toISOString(),
  };
}
