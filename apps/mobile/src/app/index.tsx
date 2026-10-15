import { Redirect } from 'expo-router';

import { useSession } from '@/state/session';

/** Routes to the right place based on the stored role and session. */
export default function Index() {
  const { role, parentTokens, childLink } = useSession();
  if (!role) return <Redirect href="/onboarding" />;
  if (role === 'parent')
    return <Redirect href={parentTokens ? '/(parent)/home' : '/(parent)/login'} />;
  return <Redirect href={childLink ? '/(child)/home' : '/(child)/link'} />;
}
