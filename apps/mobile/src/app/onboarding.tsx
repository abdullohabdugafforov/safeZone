import { router } from 'expo-router';
import { DeviceMobile, ShieldCheck, type Icon } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useSession, type Role } from '@/state/session';
import { AppText, Card, Hero, IconBadge, Screen } from '@/ui/components';

export default function Onboarding() {
  const { t } = useTranslation();
  const setRole = useSession((s) => s.setRole);

  const choose = async (role: Role) => {
    await setRole(role);
    router.replace('/');
  };

  return (
    <Screen>
      <Hero title={t('onboarding.title')} subtitle={t('onboarding.subtitle')} />
      <RoleCard
        icon={ShieldCheck}
        tone="cyan"
        title={t('onboarding.parentTitle')}
        body={t('onboarding.parentBody')}
        onPress={() => void choose('parent')}
      />
      <RoleCard
        icon={DeviceMobile}
        tone="yellow"
        title={t('onboarding.childTitle')}
        body={t('onboarding.childBody')}
        onPress={() => void choose('child')}
      />
    </Screen>
  );
}

function RoleCard({
  icon,
  tone,
  title,
  body,
  onPress,
}: {
  icon: Icon;
  tone: 'cyan' | 'yellow';
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Card tone={tone} onPress={onPress} style={styles.role}>
      <IconBadge icon={icon} size={24} />
      <View style={styles.text}>
        <AppText variant="title">{title}</AppText>
        <AppText variant="muted">{body}</AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  role: { padding: 20, gap: 14 },
  text: { gap: 4 },
});
