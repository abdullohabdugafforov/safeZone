import { Stack } from 'expo-router';

import { useTheme } from '@/ui/theme';

export default function ChildLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}
    />
  );
}
