import type { InstalledApp, PolicyEnvelope } from '@safekid/shared';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from 'react-native';

import { ApiError } from '@/api/client';
import { useDevices, usePolicy } from '@/api/parent-hooks';
import { parentApi, queryKeys } from '@/api/parent';
import { errorMessage } from '@/i18n';
import { AppText, Button, Card, Loading, Row, Screen, Section } from '@/ui/components';

export default function AllowedApps() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const policy = usePolicy(childId);
  const devices = useDevices(childId);
  const appQueries = useQueries({
    queries: (devices.data ?? []).map((d) => ({
      queryKey: queryKeys.deviceApps(d.id),
      queryFn: () => parentApi.deviceApps(d.id),
    })),
  });

  // Union of apps across the child's devices, sorted by label.
  const apps = useMemo(() => {
    const byId = new Map<string, InstalledApp>();
    for (const q of appQueries) for (const app of q.data ?? []) byId.set(app.appId, app);
    return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [appQueries]);

  const [allowlist, setAllowlist] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const resetFrom = (envelope: PolicyEnvelope) => {
    setAllowlist(envelope.document.mode === 'allowlist');
    setSelected(new Set(envelope.document.allowedApps));
  };
  const version = policy.data?.version;
  useEffect(() => {
    if (policy.data) resetFrom(policy.data);
    // Reset local edits only when a different policy version arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const save = useMutation({
    mutationFn: () =>
      parentApi.updatePolicy(childId, policy.data!.version, {
        ...policy.data!.document,
        mode: allowlist ? 'allowlist' : 'unrestricted',
        allowedApps: [...selected].sort(),
      }),
    onSuccess: (envelope) => {
      queryClient.setQueryData(queryKeys.policy(childId), envelope);
      setNotice(t('apps.saved'));
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.code === 'POLICY_VERSION_CONFLICT') {
        await policy.refetch();
        setNotice(t('apps.conflict'));
      }
    },
  });

  if (!policy.data) return <Loading />;

  const toggle = (appId: string) => {
    setNotice(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });
  };

  const userApps = apps.filter((a) => !a.isSystem);
  const systemApps = apps.filter((a) => a.isSystem);

  return (
    <Screen>
      <AppText variant="title">{t('apps.title')}</AppText>
      <Card>
        <Row>
          <AppText style={{ flex: 1, fontWeight: '600' }}>{t('apps.allowlistMode')}</AppText>
          <Switch
            value={allowlist}
            onValueChange={(value) => (setNotice(null), setAllowlist(value))}
          />
        </Row>
        <AppText variant="muted">{t('apps.allowlistHint')}</AppText>
      </Card>

      {apps.length === 0 ? <AppText variant="muted">{t('apps.empty')}</AppText> : null}
      {allowlist && userApps.length > 0 ? (
        <Section title={t('apps.userApps')}>
          {userApps.map((app) => (
            <AppToggle
              key={app.appId}
              app={app}
              checked={selected.has(app.appId)}
              onToggle={toggle}
            />
          ))}
        </Section>
      ) : null}
      {allowlist && systemApps.length > 0 ? (
        <Section title={t('apps.systemApps')}>
          {systemApps.map((app) => (
            <AppToggle
              key={app.appId}
              app={app}
              checked={selected.has(app.appId)}
              onToggle={toggle}
            />
          ))}
        </Section>
      ) : null}

      {notice ? <AppText variant="muted">{notice}</AppText> : null}
      {save.error &&
      !(save.error instanceof ApiError && save.error.code === 'POLICY_VERSION_CONFLICT') ? (
        <AppText variant="error">{errorMessage(save.error)}</AppText>
      ) : null}
      <Button title={t('common.save')} loading={save.isPending} onPress={() => save.mutate()} />
    </Screen>
  );
}

function AppToggle({
  app,
  checked,
  onToggle,
}: {
  app: InstalledApp;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <Row>
      <AppText style={{ flex: 1 }} numberOfLines={1}>
        {app.label}
      </AppText>
      <Switch
        value={checked}
        onValueChange={() => onToggle(app.appId)}
        accessibilityLabel={app.label}
      />
    </Row>
  );
}
