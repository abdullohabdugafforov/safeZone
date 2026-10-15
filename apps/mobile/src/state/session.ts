import type { TokenPair, User } from '@safekid/shared';
import { create } from 'zustand';

import type { Language } from '@/i18n/languages';
import { secureStorage } from '@/lib/secure-storage';

export type Role = 'parent' | 'child';

/** Linked child device. Its tokens are owned by the native device-control module, not JS. */
export interface ChildLink {
  deviceId: string;
  childId: string;
  childName: string;
}

interface PersistedSession {
  role: Role | null;
  /** UI language chosen in settings; null = follow the device. */
  language: Language | null;
  parentTokens: TokenPair | null;
  parentUser: Pick<User, 'id' | 'phone' | 'name' | 'locale'> | null;
  childLink: ChildLink | null;
}

interface SessionState extends PersistedSession {
  hydrated: boolean;
  hydrate(): Promise<void>;
  setRole(role: Role | null): Promise<void>;
  setLanguage(language: Language | null): Promise<void>;
  setParentSession(tokens: TokenPair, user: PersistedSession['parentUser']): Promise<void>;
  setParentTokens(tokens: TokenPair): Promise<void>;
  setChildLink(link: ChildLink | null): Promise<void>;
  signOut(): Promise<void>;
}

const STORAGE_KEY = 'safekid.session.v1';
const EMPTY: PersistedSession = {
  role: null,
  language: null,
  parentTokens: null,
  parentUser: null,
  childLink: null,
};

export const useSession = create<SessionState>((set, get) => {
  const persist = async (patch: Partial<PersistedSession>) => {
    set(patch);
    const { role, language, parentTokens, parentUser, childLink } = get();
    await secureStorage.set(STORAGE_KEY, { role, language, parentTokens, parentUser, childLink });
  };

  return {
    ...EMPTY,
    hydrated: false,
    async hydrate() {
      const stored = await secureStorage.get<PersistedSession>(STORAGE_KEY);
      set({ ...EMPTY, ...stored, hydrated: true });
    },
    setRole: (role) => persist({ role }),
    setLanguage: (language) => persist({ language }),
    setParentSession: (parentTokens, parentUser) => persist({ parentTokens, parentUser }),
    setParentTokens: (parentTokens) => persist({ parentTokens }),
    setChildLink: (childLink) => persist({ childLink }),
    signOut: () => persist({ parentTokens: null, parentUser: null }),
  };
});
