import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useSession, type Role } from '@/state/session';
import { AppText, Card, Screen } from '@/ui/components';

export default function Onboarding() {
  const { t } = useTranslation();
  const setRole = useSession((s) => s.setRole);

  const choose = async (role: Role) => {
    await setRole(role);
    router.replace('/');
  };

  return (
    <Screen>
      <AppText variant="title">{t('onboarding.title')}</AppText>
      <AppText variant="subtitle">{t('onboarding.subtitle')}</AppText>
      <Card onPress={() => void choose('parent')}>
        <AppText style={{ fontWeight: '600' }}>{t('onboarding.parentTitle')}</AppText>
        <AppText variant="muted">{t('onboarding.parentBody')}</AppText>
      </Card>
      <Card onPress={() => void choose('child')}>
        <AppText style={{ fontWeight: '600' }}>{t('onboarding.childTitle')}</AppText>
        <AppText variant="muted">{t('onboarding.childBody')}</AppText>
      </Card>
    </Screen>
  );
}
