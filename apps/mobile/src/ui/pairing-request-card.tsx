import type { PairingRequest } from '@safekid/shared';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Card, Row } from './components';

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
  return (
    <Card>
      <AppText style={{ fontWeight: '600' }}>{t('pair.requestTitle')}</AppText>
      <AppText>
        {t('pair.requestBody', {
          model: request.device.deviceName ?? request.device.model,
          os: request.device.osVersion,
          name: childName,
        })}
      </AppText>
      <AppText variant="muted">
        {request.method === 'phone' ? t('requests.viaPhone') : t('requests.viaCode')}
      </AppText>
      <AppText variant="muted">{t('requests.unknownWarning')}</AppText>
      {children}
      <Row>
        <Button
          title={t('common.reject')}
          variant="secondary"
          disabled={busy}
          onPress={onReject}
          style={{ flex: 1 }}
        />
        <Button
          title={t('common.approve')}
          loading={busy}
          onPress={onApprove}
          style={{ flex: 1 }}
        />
      </Row>
    </Card>
  );
}
