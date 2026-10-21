import { CheckCircle, ListChecks } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, IconBadge, Row, Screen } from '@/ui/components';
import { useTheme } from '@/ui/theme';

/** Practical steps on the child's phone that close common bypasses SafeKid can't block alone. */
export default function ProtectionTips() {
  const { t } = useTranslation();
  const theme = useTheme();
  const items = t('protectionTips.items', { returnObjects: true }) as string[];

  return (
    <Screen back>
      <IconBadge icon={ListChecks} size={28} />
      <AppText variant="display">{t('protectionTips.title')}</AppText>
      {items.map((item, index) => (
        <Card key={index}>
          <Row style={styles.top}>
            <CheckCircle size={22} color={theme.accent} weight="fill" />
            <View style={styles.flex}>
              <AppText>{item}</AppText>
            </View>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { alignItems: 'flex-start' },
});
