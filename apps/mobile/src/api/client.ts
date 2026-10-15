import {
  errorResponseSchema,
  tokenPairSchema,
  type ErrorCode,
  type TokenPair,
} from '@safekid/shared';
import type { z } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR' | 'INVALID_RESPONSE',
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Supplies and renews credentials for one principal (parent user or child device). */
export interface AuthProvider {
  getAccessToken(): Promise<string | null>;
  /** Returns a fresh access token, or null if the session is gone (caller signs out). */
  refresh(): Promise<string | null>;
}

export interface RequestOptions<S extends z.ZodType> {
  body?: unknown;
  schema?: S;
  auth?: AuthProvider;
  signal?: AbortSignal;
}

export function createApiClient(baseUrl: string, fetchImpl: typeof fetch = fetch) {
  async function send(
    method: string,
    path: string,
    body: unknown,
    token: string | null,
    signal?: AbortSignal,
  ) {
    try {
      return await fetchImpl(`${baseUrl}/v1${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch {
      throw new ApiError(0, 'NETWORK_ERROR', 'Network request failed');
    }
  }

  async function request<S extends z.ZodType = z.ZodUnknown>(
    method: string,
    path: string,
    { body, schema, auth, signal }: RequestOptions<S> = {},
  ): Promise<z.output<S>> {
    let res = await send(method, path, body, auth ? await auth.getAccessToken() : null, signal);
    if (res.status === 401 && auth) {
      const fresh = await auth.refresh();
      if (fresh) res = await send(method, path, body, fresh, signal);
    }

    const text = await res.text();
    const json: unknown = text ? safeJson(text) : undefined;

    if (!res.ok) {
      const parsed = errorResponseSchema.safeParse(json);
      if (parsed.success) {
        const { code, message, details } = parsed.data.error;
        throw new ApiError(res.status, code, message, details);
      }
      throw new ApiError(res.status, 'INVALID_RESPONSE', `HTTP ${res.status}`);
    }
    if (!schema) return json as z.output<S>;
    const parsed = schema.safeParse(json);
    if (!parsed.success)
      throw new ApiError(res.status, 'INVALID_RESPONSE', 'Unexpected response from server');
    return parsed.data;
  }

  return {
    get: <S extends z.ZodType>(path: string, options?: RequestOptions<S>) =>
      request('GET', path, options),
    post: <S extends z.ZodType>(path: string, options?: RequestOptions<S>) =>
      request('POST', path, options),
    put: <S extends z.ZodType>(path: string, options?: RequestOptions<S>) =>
      request('PUT', path, options),
    patch: <S extends z.ZodType>(path: string, options?: RequestOptions<S>) =>
      request('PATCH', path, options),
    delete: <S extends z.ZodType>(path: string, options?: RequestOptions<S>) =>
      request('DELETE', path, options),
    /** Exchanges a refresh token; used by auth providers. */
    refreshTokens: (refreshToken: string): Promise<TokenPair> =>
      request('POST', '/auth/refresh', { body: { refreshToken }, schema: tokenPairSchema }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Wraps a refresh function so concurrent 401s trigger a single refresh call:
 * rotating the same refresh token twice would be treated as theft by the server.
 */
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  return () => {
    inFlight ??= fn().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}
