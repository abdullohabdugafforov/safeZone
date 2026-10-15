export const SUPPORTED_LANGUAGES = ['uz', 'ru', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<Language, string> = {
  uz: 'O‘zbekcha',
  ru: 'Русский',
  en: 'English',
};
