import {
  normalizePhone,
  parsePairingQrPayload,
  sixDigitCodeSchema,
  type CreatePairingRequestBody,
} from '@safekid/shared';
import { useMutation } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, Keyboard, PaperPlaneTilt, QrCode } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { childApi, currentDeviceInfo, pendingPairing } from '@/api/child';
import { errorMessage } from '@/i18n';
import { useSession } from '@/state/session';
import { AppText, Button, Card, Chip, Hero, Row, Screen, TextField } from '@/ui/components';
import { palette, radius } from '@/ui/theme';

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
  const modes: { id: Mode; label: string }[] = [
    { id: 'scan', label: t('childLink.scan') },
    { id: 'code', label: t('childLink.enterCode') },
    { id: 'phone', label: t('childLink.usePhone') },
  ];

  return (
    <Screen>
      <Hero title={t('childLink.title')} subtitle={t('childLink.subtitle')} />

      <Row style={styles.wrap}>
        {modes.map((m) => (
          <Chip
            key={m.id}
            label={m.label}
            selected={mode === m.id}
            onPress={() => (setInputError(null), setMode(m.id))}
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
        <Card>
          <TextField
            label={t('childLink.codeLabel')}
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
            style={styles.code}
          />
          <Button
            title={t('childLink.send')}
            icon={Keyboard}
            loading={submit.isPending}
            disabled={code.length !== 6}
            onPress={() => sendCode(code)}
          />
        </Card>
      ) : null}

      {mode === 'phone' ? (
        <Card>
          <TextField
            label={t('childLink.phoneLabel')}
            placeholder={t('login.phonePlaceholder')}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <Button
            title={t('childLink.send')}
            icon={PaperPlaneTilt}
            loading={submit.isPending}
            onPress={sendPhone}
          />
        </Card>
      ) : null}

      {error ? (
        <Card tone="danger">
          <AppText variant="error">{error}</AppText>
        </Card>
      ) : null}
      <Button
        title={t('onboarding.changeRole')}
        variant="ghost"
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
      <Card tone="cyan">
        <Row>
          <QrCode size={28} color={palette.deep} />
          <AppText style={styles.flex}>{t('childLink.cameraPermission')}</AppText>
        </Row>
        <Button
          title={t('childLink.allowCamera')}
          icon={Camera}
          onPress={() => void requestPermission()}
        />
      </Card>
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
      <View style={styles.frame} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flexWrap: 'wrap' },
  code: { letterSpacing: 8, fontSize: 24, textAlign: 'center' },
  camera: {
    height: 320,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: palette.ink,
  },
  frame: {
    position: 'absolute',
    top: 50,
    bottom: 50,
    left: 50,
    right: 50,
    borderWidth: 3,
    borderColor: palette.cyan,
    borderRadius: radius.lg,
  },
});
