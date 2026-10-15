import { z } from 'zod';

const secret = z.string().min(32, 'Must be at least 32 characters');

const commaList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    CORS_ORIGINS: commaList,
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),

    JWT_ACCESS_SECRET: secret,
    HASH_PEPPER: secret,
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
    USER_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).default(30),
    DEVICE_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).default(180),

    SMS_PROVIDER: z.enum(['console', 'eskiz']).default('console'),
    ESKIZ_EMAIL: z.string().optional(),
    ESKIZ_PASSWORD: z.string().optional(),
    ESKIZ_SENDER: z.string().optional(),

    PUSH_PROVIDER: z.enum(['console', 'fcm']).default('console'),
    FCM_SERVICE_ACCOUNT_PATH: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.SMS_PROVIDER === 'eskiz' && !(env.ESKIZ_EMAIL && env.ESKIZ_PASSWORD)) {
      ctx.addIssue({ code: 'custom', path: ['ESKIZ_EMAIL'], message: 'Required for eskiz' });
    }
    if (env.PUSH_PROVIDER === 'fcm' && !env.FCM_SERVICE_ACCOUNT_PATH) {
      ctx.addIssue({
        code: 'custom',
        path: ['FCM_SERVICE_ACCOUNT_PATH'],
        message: 'Required for fcm',
      });
    }
    if (env.NODE_ENV === 'production' && env.SMS_PROVIDER === 'console') {
      ctx.addIssue({
        code: 'custom',
        path: ['SMS_PROVIDER'],
        message: 'console SMS is not allowed in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Parses env vars; throws with a readable list of problems (never echoes values). */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}
