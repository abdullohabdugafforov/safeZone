import type { PairingRequest } from '@safekid/shared';
import { Check, DeviceMobile, Warning, X } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, IconBadge, Row } from './components';
import { useTheme } from './theme';

/** Shows who wants to link and the approve/reject actions. */
export function PairingRequestCard({
  request,
  childName,
  onApprove,
  onReject,
  busy,
  children,
}: {
  request: PairingRequest;
  childName: string;
  onApprove: () => void;
  onReject: () => void;
  busy?: boolean;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Card style={styles.card}>
      <Row>
        <IconBadge icon={DeviceMobile} size={22} />
        <View style={styles.flex}>
          <AppText variant="label">{t('pair.requestTitle')}</AppText>
          <AppText variant="muted">
            {request.method === 'phone' ? t('requests.viaPhone') : t('requests.viaCode')}
          </AppText>
        </View>
      </Row>
      <AppText>
        {t('pair.requestBody', {
          model: request.device.deviceName ?? request.device.model,
          os: request.device.osVersion,
          name: childName,
        })}
      </AppText>
      <Card tone="yellow" style={styles.warning}>
        <Row>
          <Warning
            size={20}
            color={theme.scheme === 'dark' ? theme.text : '#7A4B00'}
            weight="fill"
          />
          <AppText variant="muted" style={[styles.flex, { color: theme.text }]}>
            {t('requests.unknownWarning')}
          </AppText>
        </Row>
      </Card>
      {children}
      <Row>
        <Button
          title={t('common.reject')}
          icon={X}
          variant="secondary"
          disabled={busy}
          onPress={onReject}
          style={styles.flex}
        />
        <Button
          title={t('common.approve')}
          icon={Check}
          loading={busy}
          onPress={onApprove}
          style={styles.flex}
        />
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: 14 },
  warning: { padding: 12 },
});
