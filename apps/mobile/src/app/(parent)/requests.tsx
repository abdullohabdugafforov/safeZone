import type { PairingRequest } from '@safekid/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { useChildren, useFamily, usePendingRequests } from '@/api/parent-hooks';
import { parentApi } from '@/api/parent';
import { errorMessage } from '@/i18n';
import { AppText, Row, Screen, TextField } from '@/ui/components';
import { PairingRequestCard } from '@/ui/pairing-request-card';
import { useTheme } from '@/ui/theme';

const NEW_CHILD = 'new';

/** All pending requests (incl. ones made with the parent's phone number), approved to a chosen child. */
export default function Requests() {
  const { t } = useTranslation();
  const requests = usePendingRequests(5000);

  return (
    <Screen>
      <AppText variant="title">{t('requests.title')}</AppText>
      {requests.data?.length === 0 ? (
        <AppText variant="muted">{t('requests.empty')}</AppText>
      ) : null}
      {requests.data?.map((request) => (
        <RequestItem key={request.id} request={request} />
      ))}
    </Screen>
  );
}

function RequestItem({ request }: { request: PairingRequest }) {
  const { t } = useTranslation();
  const theme = useTheme();
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

  return (
    <PairingRequestCard
      request={request}
      childName={targetName}
      busy={decide.isPending}
      onApprove={() => decide.mutate(true)}
      onReject={() => decide.mutate(false)}
    >
      <AppText variant="muted">{t('requests.linkTo')}</AppText>
      <Row>
        {[
          ...(children.data ?? []).map((c) => ({ id: c.id, name: c.name })),
          { id: NEW_CHILD, name: t('requests.newChild') },
        ].map((option) => (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: target === option.id }}
            onPress={() => setTarget(option.id)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: target === option.id ? theme.primary : theme.border,
            }}
          >
            <AppText style={{ color: target === option.id ? theme.primary : theme.text }}>
              {option.name}
            </AppText>
          </Pressable>
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
