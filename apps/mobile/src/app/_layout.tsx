import i18n from '@/i18n';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { ApiError } from '@/api/client';
import { useSession } from '@/state/session';
import { Loading } from '@/ui/components';

export default function RootLayout() {
  const hydrated = useSession((s) => s.hydrated);
  const hydrate = useSession((s) => s.hydrate);
  const language = useSession((s) => s.language);
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

  if (!hydrated) return <Loading />;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
