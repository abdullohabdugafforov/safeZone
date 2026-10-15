import {
  approvePairingBodySchema,
  buildPairingQrPayload,
  createPairingRequestBodySchema,
  parsePairingQrPayload,
} from './pairing';

const device = { platform: 'android', model: 'Pixel 8', osVersion: '15', appVersion: '0.1.0' };

describe('pairing QR payload', () => {
  it('round-trips the code', () => {
    expect(parsePairingQrPayload(buildPairingQrPayload('482913'))).toBe('482913');
  });

  it.each([
    'https://evil.example/pair?code=482913',
    'safekid://pair?code=12',
    'safekid://pair?code=48291a',
  ])('rejects %s', (payload) => {
    expect(parsePairingQrPayload(payload)).toBeNull();
  });
});

describe('createPairingRequestBodySchema', () => {
  it('accepts the code method', () => {
    expect(
      createPairingRequestBodySchema.safeParse({ method: 'code', code: '482913', device }).success,
    ).toBe(true);
  });

  it('normalizes the parent phone', () => {
    const parsed = createPairingRequestBodySchema.parse({
      method: 'phone',
      parentPhone: '90 123 45 67',
      device,
    });
    expect(parsed).toMatchObject({ parentPhone: '+998901234567' });
  });

  it('rejects mixed or missing fields', () => {
    expect(createPairingRequestBodySchema.safeParse({ method: 'code', device }).success).toBe(
      false,
    );
    expect(
      createPairingRequestBodySchema.safeParse({ method: 'phone', code: '482913', device }).success,
    ).toBe(false);
  });
});

describe('approvePairingBodySchema', () => {
  it('accepts either an existing child or a new name, not both', () => {
    expect(
      approvePairingBodySchema.safeParse({ childId: '7f9c1b1e-3c1a-4d8e-9a55-3a0c2f0c8b11' })
        .success,
    ).toBe(true);
    expect(approvePairingBodySchema.safeParse({ newChildName: 'Ali' }).success).toBe(true);
    expect(
      approvePairingBodySchema.safeParse({
        childId: '7f9c1b1e-3c1a-4d8e-9a55-3a0c2f0c8b11',
        newChildName: 'Ali',
      }).success,
    ).toBe(false);
  });
});
