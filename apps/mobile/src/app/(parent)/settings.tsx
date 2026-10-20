import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CheckCircle, CircleIcon, SignOut, Translate } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { parentApi } from '@/api/parent';
import i18n, { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, type Language } from '@/i18n';
import { useSession } from '@/state/session';
import { AppText, Button, Card, IconBadge, Row, Screen, Section } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export default function Settings() {
  const { t } = useTranslation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { parentTokens, parentUser, setLanguage, signOut } = useSession();
  const current = i18n.language as Language;

  const chooseLanguage = async (language: Language) => {
    await setLanguage(language);
    await i18n.changeLanguage(language);
    // Server-side locale is used for SMS/push texts; best effort.
    parentApi.updateMe({ locale: language }).catch(() => undefined);
  };

  const logout = async () => {
    if (parentTokens) await parentApi.logout(parentTokens.refreshToken).catch(() => undefined);
    await signOut();
    queryClient.clear();
    router.replace('/');
  };

  return (
    <Screen back>
      <AppText variant="display">{t('settings.title')}</AppText>
      {parentUser ? <AppText variant="muted">{parentUser.phone}</AppText> : null}

      <Section title={t('settings.language')}>
        <Card style={styles.list}>
          <Row style={styles.header}>
            <IconBadge icon={Translate} size={18} />
          </Row>
          {SUPPORTED_LANGUAGES.map((language) => {
            const selected = current === language;
            return (
              <Pressable
                key={language}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => void chooseLanguage(language)}
                style={[styles.option, { borderTopColor: theme.border }]}
              >
                <AppText variant={selected ? 'label' : 'body'} style={styles.flex}>
                  {LANGUAGE_NAMES[language]}
                </AppText>
                {selected ? (
                  <CheckCircle size={22} color={theme.accent} weight="fill" />
                ) : (
                  <CircleIcon size={22} color={theme.border} />
                )}
              </Pressable>
            );
          })}
        </Card>
      </Section>

      <Button
        title={t('settings.logout')}
        icon={SignOut}
        variant="secondary"
        onPress={() => void logout()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: 0, paddingVertical: 8 },
  header: { paddingBottom: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
