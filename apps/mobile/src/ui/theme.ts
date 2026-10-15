import { useColorScheme } from 'react-native';

const light = {
  background: '#F6F7FB',
  surface: '#FFFFFF',
  text: '#121826',
  textMuted: '#5B6475',
  primary: '#2F6FEB',
  primaryText: '#FFFFFF',
  border: '#E1E5EE',
  danger: '#D93B3B',
  success: '#1F9D55',
};

const dark: typeof light = {
  background: '#0E1117',
  surface: '#171B24',
  text: '#F1F3F8',
  textMuted: '#9AA3B5',
  primary: '#5B8DEF',
  primaryText: '#FFFFFF',
  border: '#2A3040',
  danger: '#F06A6A',
  success: '#3CC27A',
};

export type Theme = typeof light;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { md: 12, lg: 16 };

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
