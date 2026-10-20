import type { Child } from '@safekid/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Bell, GearSix, Plus, Smiley } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { parentApi, queryKeys } from '@/api/parent';
import { useChildren, useFamily, usePendingRequests, usePolicy } from '@/api/parent-hooks';
import { errorMessage } from '@/i18n';
import {
  AppText,
  Button,
  Card,
  Hero,
  ListItem,
  Loading,
  Row,
  Screen,
  StatusPill,
} from '@/ui/components';
import { palette } from '@/ui/theme';

export default function ParentHome() {
  const { t } = useTranslation();
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
    <Screen refreshing={children.isRefetching} onRefresh={refresh}>
      <Hero title={t('parentHome.title')}>
        <Row style={styles.heroActions}>
          <SettingsButton />
        </Row>
      </Hero>

      {familyError || children.error ? (
        <Card tone="danger">
          <AppText variant="error">{errorMessage(familyError ?? children.error)}</AppText>
          <Button title={t('common.retry')} variant="secondary" onPress={refresh} />
        </Card>
      ) : null}

      {requests.data && requests.data.length > 0 ? (
        <ListItem
          icon={Bell}
          tone="yellow"
          title={t('parentHome.pendingRequests', { count: requests.data.length })}
          onPress={() => router.push('/(parent)/requests')}
        />
      ) : null}

      <>
        {children.data?.length === 0 ? (
          <Card tone="cyan">
            <AppText>{t('parentHome.empty')}</AppText>
          </Card>
        ) : null}
        {children.data?.map((child) => (
          <ChildCard key={child.id} child={child} />
        ))}
      </>

      <Button
        title={t('parentHome.addChild')}
        icon={Plus}
        onPress={() => router.push('/(parent)/add-child')}
      />
    </Screen>
  );
}

function SettingsButton() {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('parentHome.settings')}
      onPress={() => router.push('/(parent)/settings')}
      hitSlop={12}
      style={styles.settings}
    >
      <GearSix size={22} color={palette.cyan} />
    </Pressable>
  );
}

function ChildCard({ child }: { child: Child }) {
  const { t } = useTranslation();
  const devices = useQuery({
    queryKey: queryKeys.devices(child.id),
    queryFn: () => parentApi.devices(child.id),
  });
  const policy = usePolicy(child.id);
  const lock = policy.data?.document.lock;
  const locked = lock?.state === 'locked' && (!lock.until || Date.parse(lock.until) > Date.now());
  const count = devices.data?.length ?? 0;

  return (
    <ListItem
      icon={Smiley}
      title={child.name}
      subtitle={count > 0 ? t('parentHome.devices', { count }) : t('parentHome.noDevices')}
      right={locked ? <StatusPill tone="danger" label={t('parentHome.locked')} /> : null}
      onPress={() =>
        router.push({ pathname: '/(parent)/child/[childId]', params: { childId: child.id } })
      }
    />
  );
}

const styles = StyleSheet.create({
  heroActions: { position: 'absolute', top: 16, right: 16 },
  settings: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.inkSurface,
  },
});
