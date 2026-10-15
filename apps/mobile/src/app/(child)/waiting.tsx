import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { ApiError } from '@/api/client';
import { childApi, pendingPairing, type PendingPairing } from '@/api/child';
import { API_URL } from '@/config';
import { errorMessage } from '@/i18n';
import { DeviceControl, isDeviceControlAvailable } from '@modules/device-control';
import { useSession } from '@/state/session';
import { AppText, Button, Screen } from '@/ui/components';

/** Polls the request until the parent decides; on approval claims credentials and hands them to native code. */
export default function ChildWaiting() {
  const { t } = useTranslation();
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
      <AppText variant="title">{t('childWait.title')}</AppText>
      {status.data?.status === 'rejected' ? <AppText>{t('childWait.rejected')}</AppText> : null}
      {status.data?.status === 'expired' ? <AppText>{t('childWait.expired')}</AppText> : null}
      {!closed ? (
        <>
          <AppText variant="muted">
            {status.data?.status === 'approved' ? t('childWait.linking') : t('childWait.body')}
          </AppText>
          <ActivityIndicator size="large" />
        </>
      ) : null}
      {claimError ? <AppText variant="error">{errorMessage(claimError)}</AppText> : null}
      {closed || notFound || claimError ? (
        <Button title={t('childWait.tryAgain')} onPress={() => void restart()} />
      ) : null}
    </Screen>
  );
}
