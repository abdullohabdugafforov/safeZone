import type { PermissionKind } from '@safekid/shared';
import { router } from 'expo-router';
import {
  ArrowRight,
  BatteryCharging,
  Bell,
  ChartBar,
  CheckCircle,
  Eye,
  GearSix,
  Lock,
  ShieldCheck,
  type Icon,
} from 'phosphor-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useDevicePermissions } from '@/lib/use-device-permissions';
import {
  AppText,
  Button,
  Card,
  IconBadge,
  Row,
  Screen,
  Section,
  StatusPill,
} from '@/ui/components';
import { useTheme } from '@/ui/theme';
import { DeviceControl, isDeviceControlAvailable } from '@modules/device-control';

const PERMISSION_ICONS: Record<PermissionKind, Icon> = {
  accessibility: Eye,
  usageAccess: ChartBar,
  deviceAdmin: ShieldCheck,
  notifications: Bell,
  batteryOptimization: BatteryCharging,
  familyControls: Lock,
};

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
        <AppText variant="display">{t('wizard.title')}</AppText>
        <Card tone="yellow">
          <AppText>{t('childHome.notAvailable')}</AppText>
        </Card>
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
      <View style={styles.progress}>
        {steps.map((step, i) => (
          <View
            key={step}
            style={[
              styles.progressStep,
              { backgroundColor: i <= index ? theme.primary : theme.border },
            ]}
          />
        ))}
      </View>
      <AppText variant="caption">
        {t('wizard.progress', { current: index + 1, total: steps.length })}
      </AppText>

      <Row>
        <IconBadge icon={PERMISSION_ICONS[permission]} size={28} filled={granted} />
        <AppText variant="title" style={styles.flex}>
          {t(`disclosure.${permission}.title`)}
        </AppText>
      </Row>
      {index === 0 ? <AppText variant="muted">{t('wizard.intro')}</AppText> : null}

      <Section title={t('wizard.whatTitle')}>
        <Card tone="cyan">
          <AppText style={{ color: theme.text }}>{t(`disclosure.${permission}.what`)}</AppText>
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

      <Row>
        {granted ? <CheckCircle size={20} color={theme.success} weight="fill" /> : null}
        <StatusPill
          tone={granted ? 'success' : state === 'unavailable' ? 'neutral' : 'brand'}
          label={
            state === 'unavailable'
              ? t('wizard.unavailable')
              : granted
                ? t('wizard.granted')
                : t('wizard.notGranted')
          }
        />
      </Row>

      {!granted && state !== 'unavailable' ? (
        <Button
          title={t('wizard.allow')}
          onPress={() => void DeviceControl.requestPermission(permission)}
        />
      ) : null}
      {!granted && (permission === 'accessibility' || permission === 'batteryOptimization') ? (
        <Card tone="yellow">
          <AppText style={{ color: theme.text }}>
            {permission === 'accessibility' ? t('wizard.restrictedHelp') : t('wizard.oemHelp')}
          </AppText>
          <Button
            title={t('wizard.openAppSettings')}
            icon={GearSix}
            variant="secondary"
            onPress={() => void DeviceControl.openAppSettings()}
          />
        </Card>
      ) : null}
      <Button
        title={last ? t('wizard.finish') : t('wizard.next')}
        icon={ArrowRight}
        variant={granted ? 'strong' : 'secondary'}
        onPress={() => (last ? void finish() : setIndex(index + 1))}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  progress: { flexDirection: 'row', gap: 6 },
  progressStep: { flex: 1, height: 6, borderRadius: 3 },
});
