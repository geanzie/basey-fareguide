import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, shadow } from './theme';

interface Props {
  label: string;
  value: string | number;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Accent color for icon + value. Defaults to primary green. */
  tone?: string;
}

/** Compact metric tile. Designed for a 2-col grid (width ~47%). */
export default function StatTile({ label, value, icon, tone = colors.primary }: Props) {
  return (
    <View style={s.tile}>
      {icon ? (
        <View style={[s.iconChip, { backgroundColor: tone + '1a' }]}>
          <Ionicons name={icon} size={18} color={tone} />
        </View>
      ) : null}
      <Text style={[s.value, { color: tone }]}>{value}</Text>
      <Text style={s.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadow.card,
  },
  iconChip: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  value: { fontSize: 22, fontWeight: '800' },
  label: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
});
