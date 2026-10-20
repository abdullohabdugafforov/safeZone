import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowClockwise, CheckCircle, Hourglass } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { parentApi, queryKeys } from '@/api/parent';
import { useFamily } from '@/api/parent-hooks';
import { errorMessage } from '@/i18n';
import { countdown } from '@/lib/time';
import { useNow } from '@/lib/use-now';
import {
  AppText,
  Button,
  Card,
  IconBadge,
  Loading,
  Row,
  Screen,
  StatusPill,
} from '@/ui/components';
import { PairingRequestCard } from '@/ui/pairing-request-card';
import { palette, radius, useTheme } from '@/ui/theme';

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
      <Screen back>
        <IconBadge icon={CheckCircle} size={32} filled />
        <AppText variant="display">{child.data.name}</AppText>
        <AppText>{t('pair.approved')}</AppText>
        <Button title={t('pair.done')} onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen back>
      <AppText variant="display">{t('pair.title', { name: child.data.name })}</AppText>
      <AppText variant="muted">{t('pair.instructions')}</AppText>

      {code.error ? <AppText variant="error">{errorMessage(code.error)}</AppText> : null}

      {code.data && !expired ? (
        <Card style={[styles.codeCard, { backgroundColor: theme.hero, borderColor: theme.hero }]}>
          <View style={styles.qr}>
            <QRCode
              value={code.data.qrPayload}
              size={196}
              color={palette.ink}
              backgroundColor={palette.white}
            />
          </View>
          <AppText
            variant="mono"
            style={{ color: palette.cyan }}
            accessibilityLabel={code.data.code.split('').join(' ')}
          >
            {code.data.code.slice(0, 3)} {code.data.code.slice(3)}
          </AppText>
          <StatusPill
            tone="brand"
            label={t('pair.expiresIn', { time: countdown(Date.parse(code.data.expiresAt) - now) })}
          />
        </Card>
      ) : null}

      {expired || code.error ? (
        <Card tone="yellow">
          {expired ? <AppText>{t('pair.expired')}</AppText> : null}
          <Button
            title={t('pair.newCode')}
            icon={ArrowClockwise}
            loading={code.isPending}
            onPress={() => issueCode()}
          />
        </Card>
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
        <Row style={styles.waiting}>
          <Hourglass size={20} color={theme.accent} />
          <AppText variant="muted" style={styles.flex}>
            {t('pair.waiting')}
          </AppText>
          <ActivityIndicator color={theme.accent} />
        </Row>
      ) : null}
      {decide.error ? <AppText variant="error">{errorMessage(decide.error)}</AppText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  codeCard: { alignItems: 'center', gap: 16, paddingVertical: 28 },
  qr: { backgroundColor: palette.white, padding: 14, borderRadius: radius.lg },
  waiting: { paddingHorizontal: 4 },
});
