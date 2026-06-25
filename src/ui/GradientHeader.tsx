import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { gradients, radii, spacing } from './theme';

interface Props {
  title: string;
  subtitle?: string;
  /** Show a back chevron and call this when pressed. */
  onBack?: () => void;
  /** Optional element rendered on the right (e.g. an icon button). */
  right?: React.ReactNode;
  /** Tighter vertical padding for content-heavy screens. */
  compact?: boolean;
  /** Extra content rendered inside the band below the title (e.g. avatar, tabs). */
  children?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Slate→green hero band reused on every screen. Extends the login screen's
 * color story (#0f172a → #16a34a) so the whole app reads as one brand.
 * Page content should scroll beneath it; float the first card up with a
 * negative top margin for depth.
 */
export default function GradientHeader({
  title,
  subtitle,
  onBack,
  right,
  compact,
  children,
  style,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={gradients.brand}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        s.band,
        { paddingTop: insets.top + (compact ? spacing.sm : spacing.md) },
        compact ? s.bandCompact : null,
        style,
      ]}
    >
      <View style={s.topRow}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
        ) : null}
        <View style={s.titleBox}>
          <Text style={s.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={s.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={s.right}>{right}</View> : null}
      </View>
      {children}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  band: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radii.xl + 8,
    borderBottomRightRadius: radii.xl + 8,
  },
  bandCompact: { paddingBottom: spacing.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBox: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 13, color: '#bbf7d0', marginTop: 2 },
  right: { marginLeft: 'auto' },
});
