import { parsePairingQrPayload } from '@safekid/shared';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { useSession } from '@/state/session';

/** Deep link `safekid://pair?code=123456` (from the parent's QR) opens the child linking screen. */
export default function PairDeepLink() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { role, childLink, parentTokens } = useSession();
  const valid = code ? parsePairingQrPayload(`safekid://pair?code=${code}`) : null;

  // Never let a link switch an already configured phone into child mode.
  if (!valid || childLink || (role === 'parent' && parentTokens)) return <Redirect href="/" />;
  return <Redirect href={{ pathname: '/(child)/link', params: { code: valid } }} />;
}
