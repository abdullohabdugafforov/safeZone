import { API_URL } from '@/config';
import { useSession } from '@/state/session';

import { ApiError, createApiClient, singleFlight, type AuthProvider } from './client';

export { ApiError } from './client';

export const api = createApiClient(API_URL);

/** Parent credentials live in the JS session (SecureStore). */
export const parentAuth: AuthProvider = {
  async getAccessToken() {
    return useSession.getState().parentTokens?.accessToken ?? null;
  },
  refresh: singleFlight(async () => {
    const { parentTokens, setParentTokens, signOut } = useSession.getState();
    if (!parentTokens) return null;
    try {
      const tokens = await api.refreshTokens(parentTokens.refreshToken);
      await setParentTokens(tokens);
      return tokens.accessToken;
    } catch (error) {
      // Only a definitive rejection ends the session; network errors keep it.
      if (error instanceof ApiError && error.status === 401) await signOut();
      return null;
    }
  }),
};
