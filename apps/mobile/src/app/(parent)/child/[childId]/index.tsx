import type { Device, PolicyEnvelope } from '@safekid/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AppWindow,
  DeviceMobile,
  Lock,
  LockOpen,
  Plus,
  ShieldWarning,
  Timer,
  Trash,
  WarningCircle,
} from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { parentApi, queryKeys } from '@/api/parent';
import { useDevices, usePolicy, useUnreadAlerts } from '@/api/parent-hooks';
import { errorMessage } from '@/i18n';
import { alertText } from '@/lib/alerts';
import { clockTime, isOnline, timeAgo } from '@/lib/time';
import {
  AppText,
  Button,
  Card,
  IconBadge,
  ListItem,
  Loading,
  Row,
  Screen,
  Section,
  StatusPill,
} from '@/ui/components';
import { palette, useTheme } from '@/ui/theme';

const REQUIRED_PERMISSIONS = ['accessibility', 'deviceAdmin'] as const;

export default function ChildDetail() {
  const { t } = useTranslation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const child = useQuery({
    queryKey: queryKeys.child(childId),
    queryFn: () => parentApi.child(childId),
  });
  const policy = usePolicy(childId);
  const devices = useDevices(childId);
  const unread = useUnreadAlerts();
  const childAlerts = unread.data?.filter((a) => a.childId === childId) ?? [];

  const setLock = useMutation({
    mutationFn: (action: 'lock' | 'lock1h' | 'unlock') =>
      action === 'unlock'
        ? parentApi.unlock(childId)
        : parentApi.lock(
            childId,
            action === 'lock1h' ? new Date(Date.now() + 3600_000).toISOString() : undefined,
          ),
    onSuccess: (envelope) => queryClient.setQueryData(queryKeys.policy(childId), envelope),
  });

  const remove = useMutation({
    mutationFn: () => parentApi.deleteChild(childId),
    onSuccess: async () => {
      // Child, its devices and policy are gone: refresh lists and leave the screen.
      await queryClient.invalidateQueries({ queryKey: ['children'] });
      queryClient.removeQueries({ queryKey: queryKeys.child(childId) });
      router.back();
    },
  });

  const confirmDelete = () =>
    Alert.alert(
      t('child.deleteChild'),
      t('child.deleteChildConfirm', { name: child.data?.name ?? '' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('child.deleteChild'), style: 'destructive', onPress: () => remove.mutate() },
      ],
    );

  if (!child.data || !policy.data) return <Loading />;

  const lock = policy.data.document.lock;
  const lockActive =
    lock.state === 'locked' && (!lock.until || Date.parse(lock.until) > Date.now());
  const statusText = !lockActive
    ? t('child.unlocked')
    : lock.state === 'locked' && lock.until
      ? t('child.lockedUntil', { time: clockTime(lock.until) })
      : t('child.lockedIndefinitely');

  return (
    <Screen
      back
      refreshing={devices.isRefetching}
      onRefresh={() => (void policy.refetch(), void devices.refetch())}
    >
      <AppText variant="display">{child.data.name}</AppText>

      {childAlerts.length > 0 ? (
        <ListItem
          icon={ShieldWarning}
          tone="danger"
          title={t('alerts.newCount', { count: childAlerts.length })}
          subtitle={alertText(childAlerts[0]!, child.data.name, t)}
          onPress={() => router.push('/(parent)/alerts')}
        />
      ) : null}

      <Card style={[styles.status, { backgroundColor: lockActive ? theme.hero : theme.surface }]}>
        <Row>
          <View
            style={[
              styles.statusIcon,
              { backgroundColor: lockActive ? palette.inkSurface : theme.iconContainer },
            ]}
          >
            {lockActive ? (
              <Lock size={26} color={palette.cyan} weight="fill" />
            ) : (
              <LockOpen size={26} color={theme.icon} />
            )}
          </View>
          <View style={styles.flex}>
            <AppText variant="caption" style={lockActive ? { color: palette.cyan100 } : undefined}>
              {t('child.status')}
            </AppText>
            <AppText variant="title" style={lockActive ? { color: palette.white } : undefined}>
              {statusText}
            </AppText>
          </View>
        </Row>
        {lockActive ? (
          <Button
            title={t('child.unlock')}
            icon={LockOpen}
            loading={setLock.isPending}
            onPress={() => setLock.mutate('unlock')}
          />
        ) : (
          <>
            <Button
              title={t('child.lockNow')}
              icon={Lock}
              variant="strong"
              loading={setLock.isPending}
              onPress={() => setLock.mutate('lock')}
            />
            <Button
              title={t('child.lockFor1h')}
              icon={Timer}
              variant="secondary"
              disabled={setLock.isPending}
              onPress={() => setLock.mutate('lock1h')}
            />
          </>
        )}
        {setLock.error ? <AppText variant="error">{errorMessage(setLock.error)}</AppText> : null}
      </Card>

      <ListItem
        icon={AppWindow}
        tone="cyan"
        title={t('child.allowedApps')}
        subtitle={
          policy.data.document.mode !== 'allowlist'
            ? t('child.modeUnrestricted')
            : policy.data.document.allowedApps.length === 0
              ? t('child.modeAllowlistNone')
              : t('child.modeAllowlist', { count: policy.data.document.allowedApps.length })
        }
        onPress={() =>
          router.push({ pathname: '/(parent)/child/[childId]/apps', params: { childId } })
        }
      />

      <Section title={t('child.devices')}>
        {devices.data?.map((device) => (
          <DeviceCard key={device.id} device={device} policy={policy.data} childId={childId} />
        ))}
        <Button
          title={t('child.linkDevice')}
          icon={Plus}
          variant="secondary"
          onPress={() => router.push({ pathname: '/(parent)/pair/[childId]', params: { childId } })}
        />
      </Section>

      <Button
        title={t('child.deleteChild')}
        icon={Trash}
        variant="ghost"
        loading={remove.isPending}
        onPress={confirmDelete}
        style={{ marginTop: 8 }}
      />
      {remove.error ? <AppText variant="error">{errorMessage(remove.error)}</AppText> : null}
    </Screen>
  );
}

function DeviceCard({
  device,
  policy,
  childId,
}: {
  device: Device;
  policy: PolicyEnvelope;
  childId: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const online = isOnline(device.lastHeartbeatAt);
  // Silent for over 10 minutes: the phone is off/offline or protection was removed.
  const stale =
    !!device.lastHeartbeatAt && Date.now() - Date.parse(device.lastHeartbeatAt) > 10 * 60_000;
  const missingPermissions = REQUIRED_PERMISSIONS.some(
    (p) => device.permissionStatus[p] !== 'granted',
  );
  const syncing = device.appliedPolicyVersion !== policy.version;

  const unlink = useMutation({
    mutationFn: () => parentApi.unlinkDevice(device.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.devices(childId) }),
  });

  const confirmUnlink = () =>
    Alert.alert(t('child.unlink'), t('child.unlinkConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('child.unlink'), style: 'destructive', onPress: () => unlink.mutate() },
    ]);

  return (
    <Card>
      <Row>
        <IconBadge icon={DeviceMobile} size={20} />
        <View style={styles.flex}>
          <AppText variant="label" numberOfLines={1}>
            {device.deviceName ?? device.model}
          </AppText>
          <AppText variant="muted" style={stale ? { color: theme.danger } : undefined}>
            {online
              ? t('child.online')
              : device.lastHeartbeatAt
                ? t('child.lastSeen', { time: timeAgo(device.lastHeartbeatAt, t) })
                : t('child.neverSeen')}
          </AppText>
        </View>
        <StatusPill
          tone={online ? 'success' : 'neutral'}
          label={online ? t('child.online') : '—'}
        />
      </Row>
      {missingPermissions ? (
        <Row>
          <WarningCircle size={18} color={theme.danger} weight="fill" />
          <AppText variant="error" style={styles.flex}>
            {t('child.permissionsMissing')}
          </AppText>
        </Row>
      ) : null}
      {syncing && device.lastHeartbeatAt ? (
        <AppText variant="muted">{t('child.syncing')}</AppText>
      ) : null}
      <Button
        title={t('child.unlink')}
        icon={Trash}
        variant="ghost"
        loading={unlink.isPending}
        onPress={confirmUnlink}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  status: { gap: 12, padding: 20 },
  statusIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
