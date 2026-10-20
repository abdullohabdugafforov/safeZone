import { Redirect, Stack, useSegments } from 'expo-router';

import { useSession } from '@/state/session';
import { useTheme } from '@/ui/theme';

/** Parent area: everything except the login screen requires a session. */
export default function ParentLayout() {
  const theme = useTheme();
  const signedIn = useSession((s) => s.parentTokens !== null);
  const segments = useSegments();
  const onLogin = segments[segments.length - 1] === 'login';

  if (!signedIn && !onLogin) return <Redirect href="/(parent)/login" />;

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}
    />
  );
}
