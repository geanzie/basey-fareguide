import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from './Button';
import { colors, spacing, radii } from './theme';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Centered empty/zero-data state with an icon chip and optional CTA. */
export default function EmptyState({ icon, title, message, actionLabel, onAction }: Props) {
  return (
    <View style={s.wrap}>
      <View style={s.chip}>
        <Ionicons name={icon} size={32} color={colors.primary} />
      </View>
      <Text style={s.title}>{title}</Text>
      {message ? <Text style={s.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} size="sm" style={s.action} />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: 56 },
  chip: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.textStrong, textAlign: 'center' },
  message: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 19,
  },
  action: { marginTop: spacing.lg, paddingHorizontal: spacing.xl, borderRadius: radii.md },
});
