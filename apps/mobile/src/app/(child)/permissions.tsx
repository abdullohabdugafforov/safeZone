import type { PermissionKind } from '@safekid/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DeviceControl, isDeviceControlAvailable } from '@modules/device-control';
import { useDevicePermissions } from '@/lib/use-device-permissions';
import { AppText, Button, Card, Screen, Section } from '@/ui/components';
import { useTheme } from '@/ui/theme';

/**
 * Step-by-step permission setup. Each step shows a prominent disclosure (what is
 * accessed, why, what happens with the data) BEFORE the system prompt, as
 * required by Google Play policy. The user starts each system flow explicitly.
 */
export default function PermissionsWizard() {
  const { t } = useTranslation();
  const theme = useTheme();
  const steps = useMemo(() => DeviceControl.getCapabilities().requiredPermissions, []);
  const { status } = useDevicePermissions();
  const [index, setIndex] = useState(0);

  const finish = async () => {
    if (isDeviceControlAvailable) await DeviceControl.startEnforcement();
    router.replace('/(child)/home');
  };

  if (!isDeviceControlAvailable || steps.length === 0) {
    return (
      <Screen>
        <AppText variant="title">{t('wizard.title')}</AppText>
        <AppText variant="muted">{t('childHome.notAvailable')}</AppText>
        <Button title={t('wizard.finish')} onPress={() => router.replace('/(child)/home')} />
      </Screen>
    );
  }

  const permission = steps[Math.min(index, steps.length - 1)] as PermissionKind;
  const state = status?.[permission];
  const granted = state === 'granted';
  const last = index >= steps.length - 1;

  return (
    <Screen>
      <AppText variant="muted">
        {t('wizard.progress', { current: index + 1, total: steps.length })}
      </AppText>
      <AppText variant="title">{t(`disclosure.${permission}.title`)}</AppText>
      {index === 0 ? <AppText variant="muted">{t('wizard.intro')}</AppText> : null}

      <Section title={t('wizard.whatTitle')}>
        <Card>
          <AppText>{t(`disclosure.${permission}.what`)}</AppText>
        </Card>
      </Section>
      <Section title={t('wizard.dataTitle')}>
        <Card>
          <AppText>{t(`disclosure.${permission}.data`)}</AppText>
          {permission === 'accessibility' ? (
            <AppText variant="muted">{t('disclosure.appsList')}</AppText>
          ) : null}
        </Card>
      </Section>

      <AppText style={{ color: granted ? theme.success : theme.textMuted, fontWeight: '600' }}>
        {state === 'unavailable'
          ? t('wizard.unavailable')
          : granted
            ? t('wizard.granted')
            : t('wizard.notGranted')}
      </AppText>

      {!granted && state !== 'unavailable' ? (
        <Button
          title={t('wizard.allow')}
          onPress={() => void DeviceControl.requestPermission(permission)}
        />
      ) : null}
      <Button
        title={last ? t('wizard.finish') : t('wizard.next')}
        variant={granted ? 'primary' : 'secondary'}
        onPress={() => (last ? void finish() : setIndex(index + 1))}
      />
    </Screen>
  );
}
