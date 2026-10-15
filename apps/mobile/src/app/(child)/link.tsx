import {
  normalizePhone,
  parsePairingQrPayload,
  sixDigitCodeSchema,
  type CreatePairingRequestBody,
} from '@safekid/shared';
import { useMutation } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { childApi, currentDeviceInfo, pendingPairing } from '@/api/child';
import { errorMessage } from '@/i18n';
import { useSession } from '@/state/session';
import { AppText, Button, Row, Screen, TextField } from '@/ui/components';

type Mode = 'scan' | 'code' | 'phone';

export default function ChildLink() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ code?: string }>();
  const setRole = useSession((s) => s.setRole);
  const [mode, setMode] = useState<Mode>(params.code ? 'code' : 'scan');
  const [code, setCode] = useState(params.code ?? '');
  const [phone, setPhone] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  // Resume a request made before the app was closed.
  useEffect(() => {
    void pendingPairing.get().then((pending) => {
      if (pending && Date.parse(pending.expiresAt) > Date.now()) router.replace('/(child)/waiting');
    });
  }, []);

  const submit = useMutation({
    mutationFn: async (body: CreatePairingRequestBody) => {
      const res = await childApi.createPairingRequest(body);
      await pendingPairing.set(res);
    },
    onSuccess: () => router.replace('/(child)/waiting'),
  });

  const sendCode = (value: string) => {
    if (!sixDigitCodeSchema.safeParse(value).success)
      return setInputError(t('errors.VALIDATION_FAILED'));
    setInputError(null);
    submit.mutate({ method: 'code', code: value, device: currentDeviceInfo() });
  };

  const sendPhone = () => {
    const parentPhone = normalizePhone(phone);
    if (!parentPhone) return setInputError(t('login.invalidPhone'));
    setInputError(null);
    submit.mutate({ method: 'phone', parentPhone, device: currentDeviceInfo() });
  };

  const error = inputError ?? (submit.error ? errorMessage(submit.error) : null);

  return (
    <Screen>
      <AppText variant="title">{t('childLink.title')}</AppText>
      <AppText variant="muted">{t('childLink.subtitle')}</AppText>

      <Row>
        {(['scan', 'code', 'phone'] as const).map((m) => (
          <Button
            key={m}
            style={{ flex: 1 }}
            variant={mode === m ? 'primary' : 'secondary'}
            title={
              m === 'scan'
                ? t('childLink.scan')
                : m === 'code'
                  ? t('childLink.enterCode')
                  : t('childLink.usePhone')
            }
            onPress={() => (setInputError(null), setMode(m))}
          />
        ))}
      </Row>

      {mode === 'scan' ? (
        <QrScanner
          onCode={(scanned) => sendCode(scanned)}
          onInvalid={() => setInputError(t('childLink.invalidQr'))}
          disabled={submit.isPending}
        />
      ) : null}

      {mode === 'code' ? (
        <>
          <TextField
            label={t('childLink.codeLabel')}
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
          />
          <Button
            title={t('childLink.send')}
            loading={submit.isPending}
            disabled={code.length !== 6}
            onPress={() => sendCode(code)}
          />
        </>
      ) : null}

      {mode === 'phone' ? (
        <>
          <TextField
            label={t('childLink.phoneLabel')}
            placeholder={t('login.phonePlaceholder')}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <Button title={t('childLink.send')} loading={submit.isPending} onPress={sendPhone} />
        </>
      ) : null}

      {error ? <AppText variant="error">{error}</AppText> : null}
      <Button
        title={t('onboarding.changeRole')}
        variant="secondary"
        onPress={() => void setRole(null).then(() => router.replace('/'))}
      />
    </Screen>
  );
}

function QrScanner({
  onCode,
  onInvalid,
  disabled,
}: {
  onCode: (code: string) => void;
  onInvalid: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <View style={styles.permission}>
        <AppText variant="muted">{t('childLink.cameraPermission')}</AppText>
        <Button title={t('childLink.allowCamera')} onPress={() => void requestPermission()} />
      </View>
    );
  }
  return (
    <View style={styles.camera}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={
          disabled
            ? undefined
            : ({ data }) => {
                if (handled.current) return;
                const code = parsePairingQrPayload(data);
                if (!code) return onInvalid();
                handled.current = true;
                onCode(code);
              }
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  camera: { height: 300, borderRadius: 16, overflow: 'hidden' },
  permission: { gap: 12 },
});
