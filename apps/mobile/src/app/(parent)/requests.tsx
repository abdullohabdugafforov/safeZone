import type { PairingRequest } from '@safekid/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { parentApi } from '@/api/parent';
import { useChildren, useFamily, usePendingRequests } from '@/api/parent-hooks';
import { errorMessage } from '@/i18n';
import { AppText, Card, Chip, Row, Screen, TextField } from '@/ui/components';
import { PairingRequestCard } from '@/ui/pairing-request-card';

const NEW_CHILD = 'new';

/** All pending requests (incl. ones made with the parent's phone number), approved to a chosen child. */
export default function Requests() {
  const { t } = useTranslation();
  const requests = usePendingRequests(5000);

  return (
    <Screen back refreshing={requests.isRefetching} onRefresh={() => void requests.refetch()}>
      <AppText variant="display">{t('requests.title')}</AppText>
      {requests.data?.length === 0 ? (
        <Card tone="cyan">
          <AppText>{t('requests.empty')}</AppText>
        </Card>
      ) : null}
      {requests.data?.map((request) => (
        <RequestItem key={request.id} request={request} />
      ))}
    </Screen>
  );
}

function RequestItem({ request }: { request: PairingRequest }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { family } = useFamily();
  const children = useChildren(family?.id);
  const [target, setTarget] = useState<string>(
    request.childId ?? children.data?.[0]?.id ?? NEW_CHILD,
  );
  const [newName, setNewName] = useState('');
  const targetName =
    target === NEW_CHILD
      ? newName || t('requests.newChild')
      : (children.data?.find((c) => c.id === target)?.name ?? '');

  const decide = useMutation({
    mutationFn: async (approve: boolean) => {
      if (!approve) return parentApi.rejectPairing(request.id);
      return parentApi.approvePairing(
        request.id,
        target === NEW_CHILD ? { newChildName: newName.trim() } : { childId: target },
      );
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const options = [
    ...(children.data ?? []).map((c) => ({ id: c.id, name: c.name })),
    { id: NEW_CHILD, name: t('requests.newChild') },
  ];

  return (
    <PairingRequestCard
      request={request}
      childName={targetName}
      busy={decide.isPending}
      onApprove={() => decide.mutate(true)}
      onReject={() => decide.mutate(false)}
    >
      <AppText variant="caption">{t('requests.linkTo')}</AppText>
      <Row style={styles.wrap}>
        {options.map((option) => (
          <Chip
            key={option.id}
            label={option.name}
            selected={target === option.id}
            onPress={() => setTarget(option.id)}
          />
        ))}
      </Row>
      {target === NEW_CHILD ? (
        <TextField
          label={t('requests.newChildName')}
          value={newName}
          onChangeText={setNewName}
          maxLength={50}
        />
      ) : null}
      {decide.error ? <AppText variant="error">{errorMessage(decide.error)}</AppText> : null}
    </PairingRequestCard>
  );
}

const styles = StyleSheet.create({
  wrap: { flexWrap: 'wrap' },
});
