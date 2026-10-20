import { router } from 'expo-router';
import { CaretLeft, CaretRight, type Icon } from 'phosphor-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fonts, palette, radius, spacing, useTheme, type Theme } from './theme';
import { Wave } from './wave';

// --- Layout -------------------------------------------------------------------

export function Screen({
  children,
  scroll = true,
  back,
  title,
  right,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  scroll?: boolean;
  /** Show a back button in the top bar. */
  back?: boolean;
  /** Title in the top bar (use AppText variant="display" for big page titles). */
  title?: string;
  right?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const theme = useTheme();
  const content = <View style={styles.content}>{children}</View>;
  return (
    <SafeAreaView
      style={[styles.flex, { backgroundColor: theme.background }]}
      edges={['top', 'left', 'right']}
    >
      {back || title || right ? <TopBar back={back} title={title} right={right} /> : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.grow}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={theme.accent}
              />
            ) : undefined
          }
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

function TopBar({ back, title, right }: { back?: boolean; title?: string; right?: ReactNode }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.topBar}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => router.back()}
          hitSlop={12}
          style={[styles.iconButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <CaretLeft size={20} color={theme.text} />
        </Pressable>
      ) : null}
      <AppText variant="label" style={styles.flex} numberOfLines={1}>
        {title ?? ''}
      </AppText>
      {right}
    </View>
  );
}

/** Dark ink panel with the orange→cyan wave, for page heads. */
export function Hero({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.hero, { backgroundColor: theme.hero }]}>
      <Wave style={styles.heroWave} />
      <AppText variant="display" style={{ color: theme.heroText }}>
        {title}
      </AppText>
      {subtitle ? <AppText style={{ color: palette.cyan100 }}>{subtitle}</AppText> : null}
      {children}
    </View>
  );
}

// --- Text -----------------------------------------------------------------------

type Variant =
  'display' | 'title' | 'subtitle' | 'body' | 'label' | 'muted' | 'caption' | 'error' | 'mono';

const variantStyle: Record<Variant, { fontFamily: string; fontSize: number; lineHeight: number }> =
  {
    display: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36 },
    title: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28 },
    subtitle: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 24 },
    body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
    label: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
    muted: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
    caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
    error: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
    mono: { fontFamily: fonts.mono, fontSize: 40, lineHeight: 48 },
  };

function variantColor(variant: Variant, theme: Theme): string {
  if (variant === 'muted' || variant === 'subtitle' || variant === 'caption')
    return theme.textMuted;
  if (variant === 'error') return theme.danger;
  return theme.text;
}

export function AppText({ variant = 'body', style, ...props }: TextProps & { variant?: Variant }) {
  const theme = useTheme();
  return (
    <Text
      {...props}
      style={[variantStyle[variant], { color: variantColor(variant, theme) }, style]}
    />
  );
}

// --- Controls -------------------------------------------------------------------

type ButtonVariant = 'primary' | 'strong' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  loading,
  variant = 'primary',
  icon: IconComponent,
  disabled,
  style,
  ...props
}: Omit<PressableProps, 'style'> & {
  title: string;
  loading?: boolean;
  variant?: ButtonVariant;
  icon?: Icon;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const { background, color, border } = buttonColors(variant, theme);
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          borderColor: border,
          opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {IconComponent ? <IconComponent size={20} color={color} weight="bold" /> : null}
          <Text style={[styles.buttonText, { color }]} numberOfLines={1}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function buttonColors(variant: ButtonVariant, theme: Theme) {
  switch (variant) {
    case 'primary':
      return { background: theme.primary, color: theme.primaryText, border: theme.primary };
    case 'strong':
      return { background: theme.strong, color: theme.strongText, border: theme.strong };
    case 'danger':
      return { background: theme.danger, color: palette.white, border: theme.danger };
    case 'ghost':
      return { background: 'transparent', color: theme.accent, border: 'transparent' };
    default:
      return { background: theme.surface, color: theme.text, border: theme.border };
  }
}

export function TextField({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label: string; error?: string | null }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <AppText variant="caption" style={{ color: theme.text }}>
        {label}
      </AppText>
      <TextInput
        placeholderTextColor={theme.textMuted}
        {...props}
        onFocus={(e) => (setFocused(true), props.onFocus?.(e))}
        onBlur={(e) => (setFocused(false), props.onBlur?.(e))}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.surface,
            borderColor: error ? theme.danger : focused ? theme.primary : theme.border,
          },
          style,
        ]}
      />
      {error ? <AppText variant="error">{error}</AppText> : null}
    </View>
  );
}

/** Pill toggle used for segmented choices. */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.primary : theme.surface,
          borderColor: selected ? theme.primary : theme.border,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? theme.primaryText : theme.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// --- Containers -----------------------------------------------------------------

type CardTone = 'default' | 'cyan' | 'yellow' | 'lime' | 'danger' | 'success';

export function Card({
  children,
  onPress,
  tone = 'default',
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  tone?: CardTone;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const toneStyle = cardTone(tone, theme);
  const base = [styles.card, toneStyle, style];
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [base, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  ) : (
    <View style={base}>{children}</View>
  );
}

function cardTone(tone: CardTone, theme: Theme): ViewStyle {
  const dark = theme.scheme === 'dark';
  switch (tone) {
    case 'cyan':
      return {
        backgroundColor: dark ? theme.surfaceMuted : palette.pastelCyan,
        borderColor: 'transparent',
      };
    case 'yellow':
      return {
        backgroundColor: dark ? theme.warningSoft : palette.pastelYellow,
        borderColor: 'transparent',
      };
    case 'lime':
      return {
        backgroundColor: dark ? theme.surfaceMuted : palette.pastelLime,
        borderColor: 'transparent',
      };
    case 'danger':
      return { backgroundColor: theme.dangerSoft, borderColor: 'transparent' };
    case 'success':
      return { backgroundColor: theme.successSoft, borderColor: 'transparent' };
    default:
      return { backgroundColor: theme.surface, borderColor: theme.border };
  }
}

/** Phosphor icon in the round icon container (container = 2× icon size). */
export function IconBadge({
  icon: IconComponent,
  size = 24,
  filled,
}: {
  icon: Icon;
  size?: number;
  filled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: size * 2,
        height: size * 2,
        borderRadius: size,
        backgroundColor: theme.iconContainer,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <IconComponent size={size} color={theme.icon} weight={filled ? 'fill' : 'regular'} />
    </View>
  );
}

/** Tappable row: icon, title, subtitle, trailing content and a chevron. */
export function ListItem({
  icon,
  title,
  subtitle,
  right,
  onPress,
  tone,
}: {
  icon?: Icon;
  title: string;
  subtitle?: string | null;
  right?: ReactNode;
  onPress?: () => void;
  tone?: CardTone;
}) {
  const theme = useTheme();
  return (
    <Card onPress={onPress} tone={tone}>
      <View style={styles.row}>
        {icon ? <IconBadge icon={icon} size={20} /> : null}
        <View style={styles.flex}>
          <AppText variant="label" numberOfLines={1}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="muted" numberOfLines={2}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {right}
        {onPress ? <CaretRight size={18} color={theme.textMuted} /> : null}
      </View>
    </Card>
  );
}

type PillTone = 'success' | 'danger' | 'neutral' | 'brand';

export function StatusPill({ label, tone }: { label: string; tone: PillTone }) {
  const theme = useTheme();
  const colors: Record<PillTone, { bg: string; fg: string }> = {
    success: { bg: theme.successSoft, fg: theme.success },
    danger: { bg: theme.dangerSoft, fg: theme.danger },
    neutral: {
      bg: theme.scheme === 'dark' ? theme.surfaceMuted : palette.neutral100,
      fg: theme.textMuted,
    },
    brand: {
      bg: theme.scheme === 'dark' ? theme.surfaceMuted : palette.cyan50,
      fg: theme.scheme === 'dark' ? theme.accent : palette.deep,
    },
  };
  return (
    <View style={[styles.pill, { backgroundColor: colors[tone].bg }]}>
      <Text style={[styles.pillText, { color: colors[tone].fg }]}>{label}</Text>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="caption" style={styles.sectionTitle}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={theme.accent} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  content: { flex: 1, padding: spacing.xl, gap: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    minHeight: 48,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { borderRadius: radius.xl, padding: spacing.xxl, gap: spacing.sm, overflow: 'hidden' },
  heroWave: { position: 'absolute', right: -40, bottom: -10, opacity: 0.9 },
  button: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16 },
  field: { gap: spacing.xs },
  input: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    fontSize: 18,
    fontFamily: fonts.medium,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chipText: { fontFamily: fonts.medium, fontSize: 14 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  pressed: { opacity: 0.85 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  section: { gap: spacing.sm },
  sectionTitle: { textTransform: 'uppercase', letterSpacing: 0.6 },
  pill: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.full },
  pillText: { fontFamily: fonts.semibold, fontSize: 12 },
});
