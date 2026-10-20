import i18n from '@/i18n';

import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
  Onest_400Regular,
  Onest_500Medium,
  Onest_600SemiBold,
  Onest_700Bold,
} from '@expo-google-fonts/onest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { ApiError } from '@/api/client';
import { useSession } from '@/state/session';
import { Loading } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export default function RootLayout() {
  const hydrated = useSession((s) => s.hydrated);
  const hydrate = useSession((s) => s.hydrate);
  const language = useSession((s) => s.language);
  const theme = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    Onest_400Regular,
    Onest_500Medium,
    Onest_600SemiBold,
    Onest_700Bold,
    IBMPlexMono_500Medium,
  });
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Don't hammer the API on auth/validation errors; retry transient ones.
            retry: (count, error) =>
              count < 2 &&
              (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
          },
        },
      }),
  );

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (language) void i18n.changeLanguage(language);
  }, [language]);

  // Fall back to system fonts if loading fails rather than blocking the app.
  if (!hydrated || (!fontsLoaded && !fontError)) return <Loading />;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}
      />
    </QueryClientProvider>
  );
}
