import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { parentApi } from '@/api/parent';
import i18n, { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, type Language } from '@/i18n';
import { useSession } from '@/state/session';
import { AppText, Button, Card, Row, Screen, Section } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export default function Settings() {
  const { t } = useTranslation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { parentTokens, setLanguage, signOut } = useSession();
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
    <Screen>
      <AppText variant="title">{t('settings.title')}</AppText>
      <Section title={t('settings.language')}>
        <Card>
          {SUPPORTED_LANGUAGES.map((language) => (
            <Pressable
              key={language}
              accessibilityRole="radio"
              accessibilityState={{ selected: current === language }}
              onPress={() => void chooseLanguage(language)}
            >
              <Row>
                <AppText style={{ flex: 1, paddingVertical: 8 }}>
                  {LANGUAGE_NAMES[language]}
                </AppText>
                {current === language ? (
                  <AppText style={{ color: theme.primary }}>✓</AppText>
                ) : null}
              </Row>
            </Pressable>
          ))}
        </Card>
      </Section>
      <Button title={t('settings.logout')} variant="danger" onPress={() => void logout()} />
    </Screen>
  );
}
