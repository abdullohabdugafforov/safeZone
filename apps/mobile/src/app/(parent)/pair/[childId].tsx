import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { useFamily } from '@/api/parent-hooks';
import { parentApi, queryKeys } from '@/api/parent';
import { errorMessage } from '@/i18n';
import { countdown } from '@/lib/time';
import { useNow } from '@/lib/use-now';
import { AppText, Button, Card, Loading, Screen } from '@/ui/components';
import { PairingRequestCard } from '@/ui/pairing-request-card';
import { useTheme } from '@/ui/theme';

/** Parent shows a code + QR; the child's phone submits a request which the parent approves here. */
export default function PairChild() {
  const { t } = useTranslation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const { family } = useFamily();
  const child = useQuery({
    queryKey: queryKeys.child(childId),
    queryFn: () => parentApi.child(childId),
  });
  const [approved, setApproved] = useState(false);

  const code = useMutation({ mutationFn: () => parentApi.createPairingCode(family!.id, childId) });
  const { mutate: issueCode } = code;
  useEffect(() => {
    if (family) issueCode();
  }, [family, issueCode]);

  const now = useNow(!!code.data && !approved);
  const expired = code.data ? Date.parse(code.data.expiresAt) <= now : false;

  const requests = useQuery({
    queryKey: queryKeys.pairingRequests,
    queryFn: parentApi.pendingPairingRequests,
    refetchInterval: approved ? false : 3000,
  });
  const request = requests.data?.find((r) => r.childId === childId);

  const decide = useMutation({
    mutationFn: async (approve: boolean) => {
      if (!request) return;
      if (approve) await parentApi.approvePairing(request.id, { childId });
      else await parentApi.rejectPairing(request.id);
      return approve;
    },
    onSuccess: async (wasApproved) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.pairingRequests });
      if (wasApproved) {
        setApproved(true);
        await queryClient.invalidateQueries({ queryKey: queryKeys.devices(childId) });
      } else {
        issueCode();
      }
    },
  });

  if (!child.data || (!code.data && !code.error)) return <Loading />;

  if (approved) {
    return (
      <Screen>
        <AppText variant="title">{child.data.name}</AppText>
        <AppText>{t('pair.approved')}</AppText>
        <Button title={t('pair.done')} onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText variant="title">{t('pair.title', { name: child.data.name })}</AppText>
      <AppText variant="muted">{t('pair.instructions')}</AppText>

      {code.error ? <AppText variant="error">{errorMessage(code.error)}</AppText> : null}

      {code.data && !expired ? (
        <Card>
          <View style={styles.qr}>
            <View style={styles.qrBackground}>
              <QRCode value={code.data.qrPayload} size={200} />
            </View>
            <AppText
              style={[styles.code, { color: theme.text }]}
              accessibilityLabel={code.data.code.split('').join(' ')}
            >
              {code.data.code.slice(0, 3)} {code.data.code.slice(3)}
            </AppText>
            <AppText variant="muted">
              {t('pair.expiresIn', { time: countdown(Date.parse(code.data.expiresAt) - now) })}
            </AppText>
          </View>
        </Card>
      ) : null}

      {expired ? <AppText variant="muted">{t('pair.expired')}</AppText> : null}
      {expired || code.error ? (
        <Button title={t('pair.newCode')} loading={code.isPending} onPress={() => issueCode()} />
      ) : null}

      {request ? (
        <PairingRequestCard
          request={request}
          childName={child.data.name}
          busy={decide.isPending}
          onApprove={() => decide.mutate(true)}
          onReject={() => decide.mutate(false)}
        />
      ) : !expired ? (
        <AppText variant="muted">{t('pair.waiting')}</AppText>
      ) : null}
      {decide.error ? <AppText variant="error">{errorMessage(decide.error)}</AppText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  qr: { alignItems: 'center', gap: 12 },
  qrBackground: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12 },
  code: { fontSize: 40, fontWeight: '700', letterSpacing: 6, fontVariant: ['tabular-nums'] },
});
