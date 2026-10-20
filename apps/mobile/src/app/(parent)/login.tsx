import { maskPhone, normalizePhone } from '@safekid/shared';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowRight, ChatCircleDots, Phone } from 'phosphor-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { parentApi } from '@/api/parent';
import { errorMessage } from '@/i18n';
import { useNow } from '@/lib/use-now';
import { useSession } from '@/state/session';
import { AppText, Button, IconBadge, Screen, TextField } from '@/ui/components';

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

  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {phone === null ? (
        <Screen back={false}>
          <IconBadge icon={Phone} size={28} />
          <AppText variant="display">{t('login.title')}</AppText>
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
          <Button
            title={t('login.sendCode')}
            icon={ArrowRight}
            loading={requestCode.isPending}
            onPress={submitPhone}
          />
          <Button
            title={t('onboarding.changeRole')}
            variant="ghost"
            onPress={() => void setRole(null).then(() => router.replace('/'))}
          />
        </Screen>
      ) : (
        <Screen>
          <IconBadge icon={ChatCircleDots} size={28} />
          <AppText variant="display">{t('login.codeTitle')}</AppText>
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
            style={styles.code}
          />
          <Button
            title={t('login.verify')}
            disabled={code.length !== 6}
            loading={verify.isPending}
            onPress={() => verify.mutate()}
          />
          <Button
            title={
              secondsLeft > 0 ? t('login.resendIn', { seconds: secondsLeft }) : t('login.resend')
            }
            variant="secondary"
            disabled={secondsLeft > 0}
            loading={requestCode.isPending}
            onPress={() => requestCode.mutate(phone)}
          />
          <Button title={t('login.changePhone')} variant="ghost" onPress={() => setPhone(null)} />
        </Screen>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  code: { letterSpacing: 8, fontSize: 24, textAlign: 'center' },
});
