import type { Device, PolicyEnvelope } from '@safekid/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { useDevices, usePolicy } from '@/api/parent-hooks';
import { parentApi, queryKeys } from '@/api/parent';
import { errorMessage } from '@/i18n';
import { clockTime, isOnline, timeAgo } from '@/lib/time';
import { AppText, Button, Card, Loading, Row, Screen, Section } from '@/ui/components';
import { useTheme } from '@/ui/theme';

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
    <Screen>
      <AppText variant="title">{child.data.name}</AppText>

      <Section title={t('child.status')}>
        <Card>
          <AppText style={{ fontWeight: '600', color: lockActive ? theme.danger : theme.success }}>
            {statusText}
          </AppText>
          {lockActive ? (
            <Button
              title={t('child.unlock')}
              loading={setLock.isPending}
              onPress={() => setLock.mutate('unlock')}
            />
          ) : (
            <>
              <Button
                title={t('child.lockNow')}
                variant="danger"
                loading={setLock.isPending}
                onPress={() => setLock.mutate('lock')}
              />
              <Button
                title={t('child.lockFor1h')}
                variant="secondary"
                disabled={setLock.isPending}
                onPress={() => setLock.mutate('lock1h')}
              />
            </>
          )}
          {setLock.error ? <AppText variant="error">{errorMessage(setLock.error)}</AppText> : null}
        </Card>
      </Section>

      <Section title={t('child.allowedApps')}>
        <Card
          onPress={() =>
            router.push({ pathname: '/(parent)/child/[childId]/apps', params: { childId } })
          }
        >
          <AppText>
            {policy.data.document.mode === 'allowlist'
              ? t('child.modeAllowlist', { count: policy.data.document.allowedApps.length })
              : t('child.modeUnrestricted')}
          </AppText>
        </Card>
      </Section>

      <Section title={t('child.devices')}>
        {devices.data?.map((device) => (
          <DeviceCard key={device.id} device={device} policy={policy.data} childId={childId} />
        ))}
        <Button
          title={t('child.linkDevice')}
          variant="secondary"
          onPress={() => router.push({ pathname: '/(parent)/pair/[childId]', params: { childId } })}
        />
      </Section>
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
        <AppText style={{ flex: 1, fontWeight: '600' }}>
          {device.deviceName ?? device.model}
        </AppText>
        <AppText style={{ color: online ? theme.success : theme.textMuted }}>
          {online
            ? t('child.online')
            : device.lastHeartbeatAt
              ? t('child.lastSeen', { time: timeAgo(device.lastHeartbeatAt, t) })
              : t('child.neverSeen')}
        </AppText>
      </Row>
      {missingPermissions ? (
        <AppText style={{ color: theme.danger }}>{t('child.permissionsMissing')}</AppText>
      ) : null}
      {syncing && device.lastHeartbeatAt ? (
        <AppText variant="muted">{t('child.syncing')}</AppText>
      ) : null}
      <Button
        title={t('child.unlink')}
        variant="secondary"
        loading={unlink.isPending}
        onPress={confirmUnlink}
      />
    </Card>
  );
}
