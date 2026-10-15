import type { Env } from '../config/env.js';
import { CryptoService } from './crypto.service.js';

const crypto = new CryptoService({ HASH_PEPPER: 'p'.repeat(32) } as Env);

describe('CryptoService', () => {
  it('verifies hashes and separates purposes', () => {
    const hash = crypto.hash('otp', '123456');
    expect(hash).not.toContain('123456');
    expect(crypto.verify('otp', '123456', hash)).toBe(true);
    expect(crypto.verify('otp', '123457', hash)).toBe(false);
    expect(crypto.verify('pairing', '123456', hash)).toBe(false);
  });

  it('depends on the pepper', () => {
    const other = new CryptoService({ HASH_PEPPER: 'q'.repeat(32) } as Env);
    expect(other.hash('otp', '1')).not.toBe(crypto.hash('otp', '1'));
  });

  it('generates zero-padded numeric codes', () => {
    for (let i = 0; i < 200; i++) expect(crypto.numericCode()).toMatch(/^\d{6}$/);
  });

  it('generates unique prefixed tokens', () => {
    const a = crypto.token('rt_');
    expect(a).toMatch(/^rt_[\w-]{43}$/);
    expect(crypto.token('rt_')).not.toBe(a);
  });
});
