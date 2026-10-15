import { loadEnv } from './env.js';

const valid = {
  DATABASE_URL: 'postgresql://u:p@localhost:5433/db',
  REDIS_URL: 'redis://localhost:6380',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  HASH_PEPPER: 'b'.repeat(32),
};

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv(valid);
    expect(env.PORT).toBe(3000);
    expect(env.SMS_PROVIDER).toBe('console');
    expect(env.CORS_ORIGINS).toEqual([]);
  });

  it('rejects short secrets without echoing them', () => {
    expect(() => loadEnv({ ...valid, JWT_ACCESS_SECRET: 'short-secret' })).toThrow(
      /JWT_ACCESS_SECRET: Must be at least 32 characters/,
    );
    expect(() => loadEnv({ ...valid, JWT_ACCESS_SECRET: 'short-secret' })).not.toThrow(
      /short-secret/,
    );
  });

  it('requires eskiz credentials when eskiz is selected', () => {
    expect(() => loadEnv({ ...valid, SMS_PROVIDER: 'eskiz' })).toThrow(/ESKIZ_EMAIL/);
  });

  it('forbids console SMS in production', () => {
    expect(() => loadEnv({ ...valid, NODE_ENV: 'production' })).toThrow(/SMS_PROVIDER/);
  });

  it('splits CORS origins', () => {
    expect(loadEnv({ ...valid, CORS_ORIGINS: 'http://a, http://b' }).CORS_ORIGINS).toEqual([
      'http://a',
      'http://b',
    ]);
  });
});
