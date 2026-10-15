import { Redirect, Stack, useSegments } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useSession } from '@/state/session';

/** Parent area: everything except the login screen requires a session. */
export default function ParentLayout() {
  const { t } = useTranslation();
  const signedIn = useSession((s) => s.parentTokens !== null);
  const segments = useSegments();
  const onLogin = segments[segments.length - 1] === 'login';

  if (!signedIn && !onLogin) return <Redirect href="/(parent)/login" />;

  return (
    <Stack
      screenOptions={{
        headerBackTitle: t('common.back'),
        headerTitle: '',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="home" options={{ headerShown: false }} />
    </Stack>
  );
}
