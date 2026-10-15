import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  addDeviceControlListener,
  DeviceControl,
  isDeviceControlAvailable,
} from '@modules/device-control';
import { useDevicePermissions } from '@/lib/use-device-permissions';
import { useSession } from '@/state/session';
import { AppText, Button, Card, Screen } from '@/ui/components';
import { useTheme } from '@/ui/theme';

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
        <AppText variant="title">{t('childHome.title')}</AppText>
        <AppText>{t('childHome.unlinked')}</AppText>
        <Button title={t('common.continue')} onPress={() => void reset()} />
      </Screen>
    );
  }

  const required = DeviceControl.getCapabilities().requiredPermissions;
  const protectedFully =
    isDeviceControlAvailable && required.every((p) => status?.[p] !== 'denied');

  return (
    <Screen>
      <AppText variant="title">{t('childHome.title')}</AppText>
      {childLink ? (
        <AppText variant="muted">{t('childHome.linkedTo', { name: childLink.childName })}</AppText>
      ) : null}
      <Card>
        <AppText
          style={{ fontWeight: '600', color: protectedFully ? theme.success : theme.danger }}
        >
          {!isDeviceControlAvailable
            ? t('childHome.notAvailable')
            : protectedFully
              ? t('childHome.protectionOn')
              : t('childHome.protectionOff')}
        </AppText>
        {isDeviceControlAvailable && !protectedFully ? (
          <Button title={t('childHome.fix')} onPress={() => router.push('/(child)/permissions')} />
        ) : null}
      </Card>
    </Screen>
  );
}
