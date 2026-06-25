import { Pressable, Text, ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
export type ButtonSize = 'sm' | 'md';

interface Props {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
}: Props) {
  const isDisabled = disabled || loading;
  const v = VARIANTS[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        s.base,
        size === 'sm' ? s.sm : s.md,
        { backgroundColor: v.bg, borderColor: v.border ?? v.bg },
        v.border ? s.bordered : null,
        pressed && !isDisabled ? s.pressed : null,
        isDisabled ? s.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        <Text style={[size === 'sm' ? s.labelSm : s.labelMd, { color: v.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const VARIANTS: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary },
  success: { bg: colors.primary, fg: colors.onPrimary },
  danger: { bg: colors.dangerSoftBg, fg: colors.danger, border: colors.dangerSoftBorder },
  secondary: { bg: colors.surfaceAlt, fg: colors.textBody, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.info },
};

const s = StyleSheet.create({
  base: { borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  bordered: { borderWidth: 1 },
  sm: { paddingVertical: 8, paddingHorizontal: 12 },
  md: { paddingVertical: 14, paddingHorizontal: 16 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  labelSm: { fontSize: 13, fontWeight: '700' },
  labelMd: { fontSize: 15, fontWeight: '700' },
});
