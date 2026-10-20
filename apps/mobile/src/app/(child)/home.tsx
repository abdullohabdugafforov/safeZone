import { router } from 'expo-router';
import { ShieldCheck, ShieldWarning, Smiley, Wrench } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useDevicePermissions } from '@/lib/use-device-permissions';
import { useSession } from '@/state/session';
import { AppText, Button, Card, Hero, IconBadge, Row, Screen } from '@/ui/components';
import { palette, useTheme } from '@/ui/theme';
import {
  addDeviceControlListener,
  DeviceControl,
  isDeviceControlAvailable,
} from '@modules/device-control';

/** Child-facing status. Deliberately has no way to leave child mode: only the parent can unlink. */
export default function ChildHome() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { childLink, setChildLink, setRole } = useSession();
  const { status } = useDevicePermissions();
  const [unlinked, setUnlinked] = useState(false);

  useEffect(() => {
    const sub = addDeviceControlListener('onUnlinked', () => setUnlinked(true));
    return () => sub?.remove();
  }, []);

  if (unlinked) {
    const reset = async () => {
      await DeviceControl.clearDeviceCredentials();
      await setChildLink(null);
      await setRole(null);
      router.replace('/');
    };
    return (
      <Screen>
        <Hero title={t('childHome.title')} subtitle={t('childHome.unlinked')} />
        <Button title={t('common.continue')} onPress={() => void reset()} />
      </Screen>
    );
  }

  const required = DeviceControl.getCapabilities().requiredPermissions;
  const protectedFully =
    isDeviceControlAvailable && required.every((p) => status?.[p] !== 'denied');

  return (
    <Screen>
      <Hero title={childLink?.childName ?? t('childHome.title')}>
        {childLink ? (
          <AppText style={{ color: palette.cyan100 }}>
            {t('childHome.linkedTo', { name: childLink.childName })}
          </AppText>
        ) : null}
      </Hero>
      <Card tone={protectedFully ? 'success' : isDeviceControlAvailable ? 'danger' : 'yellow'}>
        <Row>
          <View style={styles.icon}>
            {protectedFully ? (
              <ShieldCheck size={32} color={theme.success} weight="fill" />
            ) : (
              <ShieldWarning
                size={32}
                color={isDeviceControlAvailable ? theme.danger : theme.text}
                weight="fill"
              />
            )}
          </View>
          <AppText variant="label" style={styles.flex}>
            {!isDeviceControlAvailable
              ? t('childHome.notAvailable')
              : protectedFully
                ? t('childHome.protectionOn')
                : t('childHome.protectionOff')}
          </AppText>
        </Row>
        {isDeviceControlAvailable && !protectedFully ? (
          <Button
            title={t('childHome.fix')}
            icon={Wrench}
            onPress={() => router.push('/(child)/permissions')}
          />
        ) : null}
      </Card>
      <Row>
        <IconBadge icon={Smiley} size={20} />
        <AppText variant="muted" style={styles.flex}>
          {t('childLink.subtitle')}
        </AppText>
      </Row>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  icon: { width: 40, alignItems: 'center' },
});
