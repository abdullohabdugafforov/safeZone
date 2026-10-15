import {
  createDefaultPolicyDocument,
  lockBodySchema,
  policyDocumentSchema,
  updatePolicyBodySchema,
} from './policy';

const base = createDefaultPolicyDocument('Asia/Tashkent');

describe('policyDocumentSchema', () => {
  it('accepts the default policy', () => {
    expect(policyDocumentSchema.parse(base)).toEqual(base);
  });

  it('fills later-phase fields with defaults', () => {
    const { schedules: _s, appLimits: _l, ...minimal } = base;
    const parsed = policyDocumentSchema.parse(minimal);
    expect(parsed.schedules).toEqual([]);
    expect(parsed.appLimits).toEqual([]);
  });

  it('accepts an allowlist with a timed lock', () => {
    const doc = {
      ...base,
      mode: 'allowlist',
      allowedApps: ['com.duolingo', 'org.khanacademy.android'],
      lock: { state: 'locked', until: '2026-10-15T22:00:00+05:00' },
    };
    expect(policyDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it('rejects duplicate app ids', () => {
    const doc = { ...base, allowedApps: ['com.a', 'com.a'] };
    expect(policyDocumentSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects unknown schema versions', () => {
    expect(policyDocumentSchema.safeParse({ ...base, schemaVersion: 2 }).success).toBe(false);
  });

  it('rejects invalid schedule times', () => {
    const schedule = { id: 's1', days: ['mon'], start: '24:00', end: '07:00', action: 'lock' };
    expect(policyDocumentSchema.safeParse({ ...base, schedules: [schedule] }).success).toBe(false);
  });

  it('accepts schedules crossing midnight', () => {
    const schedule = { id: 's1', days: ['mon'], start: '22:00', end: '07:00', action: 'lock' };
    expect(policyDocumentSchema.safeParse({ ...base, schedules: [schedule] }).success).toBe(true);
  });
});

describe('updatePolicyBodySchema', () => {
  it('requires a base version', () => {
    expect(updatePolicyBodySchema.safeParse({ document: base }).success).toBe(false);
    expect(updatePolicyBodySchema.safeParse({ baseVersion: 1, document: base }).success).toBe(true);
  });
});

describe('lockBodySchema', () => {
  it('rejects lock end in the past', () => {
    expect(lockBodySchema.safeParse({ until: '2000-01-01T00:00:00Z' }).success).toBe(false);
  });

  it('allows indefinite lock', () => {
    expect(lockBodySchema.safeParse({}).success).toBe(true);
  });
});
