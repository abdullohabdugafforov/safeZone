import type { Child } from '@safekid/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useChildren, useFamily, usePendingRequests, usePolicy } from '@/api/parent-hooks';
import { parentApi, queryKeys } from '@/api/parent';
import { errorMessage } from '@/i18n';
import { AppText, Button, Card, Loading, Row } from '@/ui/components';
import { spacing, useTheme } from '@/ui/theme';

export default function ParentHome() {
  const { t } = useTranslation();
  const theme = useTheme();
  const {
    family,
    isLoading: familyLoading,
    error: familyError,
    refetch: refetchFamily,
  } = useFamily();
  const children = useChildren(family?.id);
  const requests = usePendingRequests();

  if (familyLoading) return <Loading />;

  const refresh = () => {
    void refetchFamily();
    void children.refetch();
    void requests.refetch();
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={children.isRefetching} onRefresh={refresh} />}
      >
        <Row>
          <AppText variant="title" style={styles.flex}>
            {t('parentHome.title')}
          </AppText>
          <AppText
            variant="muted"
            onPress={() => router.push('/(parent)/settings')}
            accessibilityRole="button"
          >
            {t('parentHome.settings')}
          </AppText>
        </Row>

        {familyError || children.error ? (
          <Card>
            <AppText variant="error">{errorMessage(familyError ?? children.error)}</AppText>
            <Button title={t('common.retry')} variant="secondary" onPress={refresh} />
          </Card>
        ) : null}

        {requests.data && requests.data.length > 0 ? (
          <Card onPress={() => router.push('/(parent)/requests')}>
            <AppText style={{ color: theme.primary, fontWeight: '600' }}>
              {t('parentHome.pendingRequests', { count: requests.data.length })}
            </AppText>
          </Card>
        ) : null}

        {children.data?.length === 0 ? (
          <AppText variant="muted">{t('parentHome.empty')}</AppText>
        ) : null}
        {children.data?.map((child) => (
          <ChildCard key={child.id} child={child} />
        ))}

        <Button
          title={t('parentHome.addChild')}
          onPress={() => router.push('/(parent)/add-child')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function ChildCard({ child }: { child: Child }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const devices = useQuery({
    queryKey: queryKeys.devices(child.id),
    queryFn: () => parentApi.devices(child.id),
  });
  const policy = usePolicy(child.id);
  const locked = policy.data?.document.lock.state === 'locked';
  const count = devices.data?.length ?? 0;

  return (
    <Card
      onPress={() =>
        router.push({ pathname: '/(parent)/child/[childId]', params: { childId: child.id } })
      }
    >
      <Row>
        <AppText style={[styles.flex, styles.name]}>{child.name}</AppText>
        {locked ? (
          <AppText style={{ color: theme.danger }}>{t('parentHome.locked')}</AppText>
        ) : null}
      </Row>
      <View>
        <AppText variant="muted">
          {count > 0 ? t('parentHome.devices', { count }) : t('parentHome.noDevices')}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  name: { fontSize: 18, fontWeight: '600' },
});
