import { maskPhone, normalizePhone, phoneSchema, timeZoneSchema } from './common';

describe('normalizePhone', () => {
  it.each([
    ['+998 90 123 45 67', '+998901234567'],
    ['998901234567', '+998901234567'],
    ['90 123-45-67', '+998901234567'],
    ['(90) 123 45 67', '+998901234567'],
    ['+7 912 345 67 89', '+79123456789'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['', 'abc', '123', '+998 00 000'])('rejects %s', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe('phoneSchema', () => {
  it('outputs E.164', () => {
    expect(phoneSchema.parse('90 123 45 67')).toBe('+998901234567');
  });

  it('fails on invalid numbers', () => {
    expect(phoneSchema.safeParse('12').success).toBe(false);
  });
});

describe('maskPhone', () => {
  it('keeps prefix and last two digits', () => {
    expect(maskPhone('+998901234567')).toBe('+99890*****67');
  });
});

describe('timeZoneSchema', () => {
  it('accepts IANA zones', () => {
    expect(timeZoneSchema.safeParse('Asia/Tashkent').success).toBe(true);
  });

  it('rejects unknown zones', () => {
    expect(timeZoneSchema.safeParse('Mars/Olympus').success).toBe(false);
  });
});
