import type { Alert } from '@safekid/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { parentApi, queryKeys } from '@/api/parent';
import { useChildren, useFamily } from '@/api/parent-hooks';
import { alertIcon, alertText } from '@/lib/alerts';
import { timeAgo } from '@/lib/time';
import { AppText, Card, IconBadge, Loading, Row, Screen, StatusPill } from '@/ui/components';

export default function Alerts() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { family } = useFamily();
  const children = useChildren(family?.id);
  const alerts = useQuery({ queryKey: queryKeys.alerts, queryFn: () => parentApi.alerts(false) });

  // Opening the list counts as reading the new alerts.
  const unreadIds = alerts.data?.filter((a) => !a.readAt).map((a) => a.id) ?? [];
  const unreadKey = unreadIds.join(',');
  useEffect(() => {
    if (!unreadKey) return;
    void Promise.allSettled(unreadKey.split(',').map((id) => parentApi.markAlertRead(id))).then(
      () => queryClient.invalidateQueries({ queryKey: queryKeys.unreadAlerts }),
    );
  }, [unreadKey, queryClient]);

  if (!alerts.data) return <Loading />;

  const childName = (alert: Alert) =>
    children.data?.find((c) => c.id === alert.childId)?.name ?? '—';

  return (
    <Screen back refreshing={alerts.isRefetching} onRefresh={() => void alerts.refetch()}>
      <AppText variant="display">{t('alerts.title')}</AppText>
      {alerts.data.length === 0 ? (
        <Card tone="success">
          <AppText>{t('alerts.empty')}</AppText>
        </Card>
      ) : null}
      {alerts.data.map((alert) => (
        <Card key={alert.id} tone={alert.readAt ? 'default' : 'danger'}>
          <Row style={styles.top}>
            <IconBadge icon={alertIcon(alert)} size={18} />
            <View style={styles.flex}>
              <AppText variant="label">{alertText(alert, childName(alert), t)}</AppText>
              <AppText variant="muted">{timeAgo(alert.createdAt, t)}</AppText>
            </View>
            {!alert.readAt ? <StatusPill tone="danger" label="•" /> : null}
          </Row>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  top: { alignItems: 'flex-start' },
});
