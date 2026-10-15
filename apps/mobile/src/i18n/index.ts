import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { ApiError } from '@/api/client';

import en from './locales/en';
import ru from './locales/ru';
import uz from './locales/uz';

import { SUPPORTED_LANGUAGES, type Language } from './languages';

export { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, type Language } from './languages';

/** Device language if supported, otherwise Uzbek. */
export function detectLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return SUPPORTED_LANGUAGES.find((lang) => lang === code) ?? 'uz';
}

void i18n.use(initReactI18next).init({
  resources: { uz: { translation: uz }, ru: { translation: ru }, en: { translation: en } },
  lng: detectLanguage(),
  fallbackLng: 'uz',
  interpolation: { escapeValue: false },
});

/** Localized message for any error thrown by the API client. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const key = `errors.${error.code}`;
    if (i18n.exists(key)) return i18n.t(key);
  }
  return i18n.t('errors.generic');
}

export default i18n;
