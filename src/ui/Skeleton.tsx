import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, type StyleProp, type ViewStyle, type DimensionValue } from 'react-native';
import { colors, radii } from './theme';

export function SkeletonBox({
  width,
  height = 16,
  borderRadius = radii.sm,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [opacity]);
  const widthStyle = width != null ? { width } : { alignSelf: 'stretch' as const };
  return <Animated.View style={[s.box, { height, borderRadius, opacity }, widthStyle, style]} />;
}

export function CardSkeleton({ variant = 'simple' }: { variant?: 'simple' | 'complex' }) {
  if (variant === 'complex') {
    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <SkeletonBox width="55%" height={14} />
          <SkeletonBox width={68} height={22} borderRadius={radii.pill} />
        </View>
        <SkeletonBox width="75%" height={12} style={s.mt6} />
        <SkeletonBox width="60%" height={12} style={s.mt4} />
        <View style={s.btnRow}>
          <SkeletonBox width={74} height={30} borderRadius={radii.md} />
          <SkeletonBox width={74} height={30} borderRadius={radii.md} />
          <SkeletonBox width={82} height={30} borderRadius={radii.md} />
        </View>
      </View>
    );
  }
  return (
    <View style={s.card}>
      <SkeletonBox width="60%" height={14} />
      <SkeletonBox width="45%" height={12} style={s.mt6} />
      <SkeletonBox width="35%" height={11} style={s.mt4} />
    </View>
  );
}

export function ListSkeleton({ count = 4, variant }: { count?: number; variant?: 'simple' | 'complex' }) {
  return (
    <View style={s.list}>
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} variant={variant} />
      ))}
    </View>
  );
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={s.grid}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={s.statCard}>
          <SkeletonBox width={28} height={28} borderRadius={14} />
          <SkeletonBox width="60%" height={26} style={s.mt8} />
          <SkeletonBox width="80%" height={11} style={s.mt4} />
        </View>
      ))}
    </View>
  );
}

export function SectionSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={s.section}>
      <SkeletonBox width="40%" height={13} style={s.mb10} />
      <ListSkeleton count={count} />
    </View>
  );
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <View style={s.formContainer}>
      <SkeletonBox width={80} height={80} borderRadius={40} style={s.avatar} />
      <SkeletonBox width="50%" height={18} style={s.mt16} />
      <SkeletonBox width="35%" height={13} style={s.mt6} />
      <View style={s.fieldList}>
        {Array.from({ length: fields }, (_, i) => (
          <View key={i} style={s.fieldRow}>
            <SkeletonBox width="30%" height={12} style={s.mb6} />
            <SkeletonBox height={46} borderRadius={radii.md} />
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: colors.border },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    elevation: 1,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  list: { padding: 16, gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10, marginBottom: 12 },
  statCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    elevation: 2,
  },
  section: { paddingHorizontal: 0, marginBottom: 8 },
  formContainer: { padding: 24, alignItems: 'center' },
  fieldList: { width: '100%', marginTop: 24, gap: 16 },
  fieldRow: { gap: 6 },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
  mt16: { marginTop: 16 },
  mb6: { marginBottom: 6 },
  mb10: { marginBottom: 10 },
  avatar: { alignSelf: 'center' as const },
});
