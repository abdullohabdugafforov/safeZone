import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowClockwise, Hourglass, XCircle } from 'phosphor-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { childApi, pendingPairing, type PendingPairing } from '@/api/child';
import { API_URL } from '@/config';
import { errorMessage } from '@/i18n';
import { DeviceControl, isDeviceControlAvailable } from '@modules/device-control';
import { useSession } from '@/state/session';
import { AppText, Button, Card, IconBadge, Screen } from '@/ui/components';
import { useTheme } from '@/ui/theme';

/** Polls the request until the parent decides; on approval claims credentials and hands them to native code. */
export default function ChildWaiting() {
  const { t } = useTranslation();
  const theme = useTheme();
  const setChildLink = useSession((s) => s.setChildLink);
  const [pending, setPending] = useState<PendingPairing | null>(null);
  const [claimError, setClaimError] = useState<unknown>(null);
  const claiming = useRef(false);

  useEffect(() => {
    void pendingPairing
      .get()
      .then((value) => (value ? setPending(value) : router.replace('/(child)/link')));
  }, []);

  const status = useQuery({
    queryKey: ['pairingStatus', pending?.requestId],
    queryFn: () => childApi.pairingStatus(pending!.requestId, pending!.claimSecret),
    enabled: !!pending,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 3000 : false),
  });

  useEffect(() => {
    if (status.data?.status !== 'approved' || !pending || claiming.current) return;
    claiming.current = true;
    void (async () => {
      try {
        const claim = await childApi.claim(pending.requestId, pending.claimSecret);
        if (isDeviceControlAvailable) {
          await DeviceControl.setDeviceCredentials({
            apiUrl: API_URL,
            deviceId: claim.deviceId,
            accessToken: claim.tokens.accessToken,
            refreshToken: claim.tokens.refreshToken,
          });
          await DeviceControl.applyPolicy({
            version: claim.policy.version,
            document: claim.policy.document,
          });
        }
        await setChildLink({
          deviceId: claim.deviceId,
          childId: claim.childId,
          childName: claim.childName,
        });
        await pendingPairing.clear();
        router.replace('/(child)/permissions');
      } catch (error) {
        claiming.current = false;
        setClaimError(error);
      }
    })();
  }, [status.data?.status, pending, setChildLink]);

  const restart = async () => {
    await pendingPairing.clear();
    router.replace('/(child)/link');
  };

  const closed = status.data?.status === 'rejected' || status.data?.status === 'expired';
  const notFound = status.error instanceof ApiError && status.error.status === 404;

  return (
    <Screen>
      <View style={styles.center}>
        {closed ? (
          <IconBadge icon={XCircle} size={36} />
        ) : (
          <View style={[styles.pulse, { backgroundColor: theme.iconContainer }]}>
            <Hourglass size={40} color={theme.icon} />
          </View>
        )}
        <AppText variant="display" style={styles.centerText}>
          {t('childWait.title')}
        </AppText>
        {status.data?.status === 'rejected' ? (
          <AppText style={styles.centerText}>{t('childWait.rejected')}</AppText>
        ) : null}
        {status.data?.status === 'expired' ? (
          <AppText style={styles.centerText}>{t('childWait.expired')}</AppText>
        ) : null}
        {!closed ? (
          <>
            <AppText variant="muted" style={styles.centerText}>
              {status.data?.status === 'approved' ? t('childWait.linking') : t('childWait.body')}
            </AppText>
            <ActivityIndicator size="large" color={theme.accent} />
          </>
        ) : null}
      </View>
      {claimError ? (
        <Card tone="danger">
          <AppText variant="error">{errorMessage(claimError)}</AppText>
        </Card>
      ) : null}
      {closed || notFound || claimError ? (
        <Button
          title={t('childWait.tryAgain')}
          icon={ArrowClockwise}
          onPress={() => void restart()}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 48 },
  centerText: { textAlign: 'center' },
  pulse: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
