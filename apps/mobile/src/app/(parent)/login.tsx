import { maskPhone, normalizePhone } from '@safekid/shared';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { parentApi } from '@/api/parent';
import { errorMessage } from '@/i18n';
import { useNow } from '@/lib/use-now';
import { useSession } from '@/state/session';
import { AppText, Button, Screen, TextField } from '@/ui/components';

export default function ParentLogin() {
  const { t } = useTranslation();
  const setParentSession = useSession((s) => s.setParentSession);
  const setRole = useSession((s) => s.setRole);
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const now = useNow(phone !== null);

  const requestCode = useMutation({
    mutationFn: (target: string) => parentApi.requestOtp(target),
    onSuccess: (res, target) => {
      setPhone(target);
      setCode('');
      setResendAt(Date.now() + res.resendAfterSeconds * 1000);
    },
  });

  const verify = useMutation({
    mutationFn: () => parentApi.verifyOtp(phone!, code),
    onSuccess: async ({ tokens, user }) => {
      await setParentSession(tokens, {
        id: user.id,
        phone: user.phone,
        name: user.name,
        locale: user.locale,
      });
      router.replace('/(parent)/home');
    },
  });

  const submitPhone = () => {
    const normalized = normalizePhone(phoneInput);
    setPhoneError(normalized ? null : t('login.invalidPhone'));
    if (normalized) requestCode.mutate(normalized);
  };

  if (phone === null) {
    return (
      <Screen>
        <AppText variant="title">{t('login.title')}</AppText>
        <TextField
          label={t('login.phoneLabel')}
          placeholder={t('login.phonePlaceholder')}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          value={phoneInput}
          onChangeText={setPhoneInput}
          error={phoneError ?? (requestCode.error ? errorMessage(requestCode.error) : null)}
          onSubmitEditing={submitPhone}
        />
        <Button title={t('login.sendCode')} loading={requestCode.isPending} onPress={submitPhone} />
        <Button
          title={t('onboarding.changeRole')}
          variant="secondary"
          onPress={() => void setRole(null).then(() => router.replace('/'))}
        />
      </Screen>
    );
  }

  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));
  return (
    <Screen>
      <AppText variant="title">{t('login.codeTitle')}</AppText>
      <AppText variant="muted">{t('login.codeSent', { phone: maskPhone(phone) })}</AppText>
      <TextField
        label={t('login.codeLabel')}
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={6}
        autoFocus
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
        error={verify.error ? errorMessage(verify.error) : null}
      />
      <Button
        title={t('login.verify')}
        disabled={code.length !== 6}
        loading={verify.isPending}
        onPress={() => verify.mutate()}
      />
      <Button
        title={secondsLeft > 0 ? t('login.resendIn', { seconds: secondsLeft }) : t('login.resend')}
        variant="secondary"
        disabled={secondsLeft > 0}
        loading={requestCode.isPending}
        onPress={() => requestCode.mutate(phone)}
      />
      <Button title={t('login.changePhone')} variant="secondary" onPress={() => setPhone(null)} />
    </Screen>
  );
}
