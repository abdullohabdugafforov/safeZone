import { useColorScheme } from 'react-native';

/**
 * Design tokens adapted from the "junior" brand palette of the design system
 * (brand colors, contrast pairs, radii, spacing, type). Logos and brand names
 * are intentionally not used.
 *
 * Contrast pairs allowed by the system:
 * - white / page bg → ink text
 * - cyan / cyanDeep bg → deep text
 * - deep bg → white text
 * - ink bg → cyan (or white) text
 */
export const palette = {
  cyan: '#00E0EF',
  cyanDeep: '#00CDDA',
  deep: '#004450',
  ink: '#002227',
  inkSurface: '#003539',
  teal: '#0A8992',
  iconContainer: '#D5F2F4',
  orange: '#FFB93F',
  waveOrange: '#F6A30C',
  lime: '#BCFF00',
  pastelCyan: '#A8F0FF',
  pastelYellow: '#FFDB9D',
  pastelLime: '#EBFFB2',
  white: '#FFFFFF',
  page: '#F8F8F8',
  grayText: '#555A65',
  neutral200: '#E1E1E1',
  neutral100: '#F0F0F0',
  cyan25: '#F4FEFF',
  cyan50: '#E4FCFF',
  cyan100: '#BEF9FF',
  error: '#D92D20',
  errorSoft: '#FEE4E2',
  success: '#079455',
  successSoft: '#DCFAE6',
};

const light = {
  scheme: 'light' as 'light' | 'dark',
  background: palette.page,
  surface: palette.white,
  surfaceMuted: palette.cyan25,
  text: palette.ink,
  textMuted: palette.grayText,
  border: palette.neutral200,
  /** Primary action: cyan-deep fill with deep text. */
  primary: palette.cyanDeep,
  primaryText: palette.deep,
  /** Strong action: deep fill with white text. */
  strong: palette.deep,
  strongText: palette.white,
  accent: palette.teal,
  icon: palette.teal,
  iconContainer: palette.iconContainer,
  /** Hero panels: ink with cyan highlights. */
  hero: palette.ink,
  heroText: palette.white,
  heroAccent: palette.cyan,
  danger: palette.error,
  dangerSoft: palette.errorSoft,
  success: palette.success,
  successSoft: palette.successSoft,
  warningSoft: palette.pastelYellow,
};

const dark: typeof light = {
  scheme: 'dark',
  background: palette.ink,
  surface: palette.inkSurface,
  surfaceMuted: '#00414A',
  text: palette.white,
  textMuted: '#A3C4C8',
  border: '#0B4A52',
  primary: palette.cyanDeep,
  primaryText: palette.deep,
  strong: palette.cyan,
  strongText: palette.ink,
  accent: palette.cyan,
  icon: palette.cyan,
  iconContainer: palette.inkSurface,
  hero: '#00323B',
  heroText: palette.white,
  heroAccent: palette.cyan,
  danger: '#F97066',
  dangerSoft: '#3D1A1A',
  success: '#47CD89',
  successSoft: '#0B3B2A',
  warningSoft: '#4A3A12',
};

export type Theme = typeof light;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 };

export const fonts = {
  regular: 'Onest_400Regular',
  medium: 'Onest_500Medium',
  semibold: 'Onest_600SemiBold',
  bold: 'Onest_700Bold',
  mono: 'IBMPlexMono_500Medium',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
