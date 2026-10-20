import { createChildBodySchema } from '@safekid/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowRight, Smiley } from 'phosphor-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { parentApi, queryKeys } from '@/api/parent';
import { useFamily } from '@/api/parent-hooks';
import { errorMessage } from '@/i18n';
import { AppText, Button, IconBadge, Screen, TextField } from '@/ui/components';

export default function AddChild() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { family } = useFamily();
  const [name, setName] = useState('');
  const valid = createChildBodySchema.safeParse({ name }).success;

  const create = useMutation({
    mutationFn: () => parentApi.createChild(family!.id, { name: name.trim() }),
    onSuccess: async (child) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.children(child.familyId) });
      router.replace({ pathname: '/(parent)/pair/[childId]', params: { childId: child.id } });
    },
  });

  return (
    <Screen back>
      <IconBadge icon={Smiley} size={28} />
      <AppText variant="display">{t('addChild.title')}</AppText>
      <TextField
        label={t('addChild.nameLabel')}
        placeholder={t('addChild.namePlaceholder')}
        value={name}
        onChangeText={setName}
        maxLength={50}
        autoFocus
        error={create.error ? errorMessage(create.error) : null}
      />
      <Button
        title={t('addChild.create')}
        icon={ArrowRight}
        disabled={!valid || !family}
        loading={create.isPending}
        onPress={() => create.mutate()}
      />
    </Screen>
  );
}
