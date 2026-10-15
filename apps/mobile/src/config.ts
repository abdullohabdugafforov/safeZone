import Constants from 'expo-constants';

/** Backend base URL: EXPO_PUBLIC_API_URL, or the dev machine on port 3000 in development. */
export function resolveApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (__DEV__ && host) return `http://${host}:3000`;
  throw new Error('EXPO_PUBLIC_API_URL is not set');
}

export const API_URL = resolveApiUrl();
