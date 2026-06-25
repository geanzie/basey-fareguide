import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/ui/theme';
import type { RouteCalculationResponse } from '@/types/fare';

interface Props {
  result: RouteCalculationResponse;
  originLabel: string;
  destinationLabel: string;
}

type IoniconName = keyof typeof Ionicons.glyphMap;

function getProviderLabel(method: 'ors' | 'google_routes' | null): string | null {
  if (method === 'ors') return 'Via OpenRouteService';
  if (method === 'google_routes') return 'Via Google Routes';
  return null;
}

export default function FareResultCard({ result, originLabel, destinationLabel }: Props) {
  const isDiscounted = (result.fareBreakdown.discount ?? 0) > 0;
  const regularFare = result.fareBreakdown.baseFare + result.fareBreakdown.additionalFare;
  const providerLabel = getProviderLabel(result.method);

  return (
    <View style={s.card}>
      {/* Route row */}
      <View style={s.routeRow}>
        <Text style={s.routeText} numberOfLines={1}>{originLabel}</Text>
        <Ionicons name="arrow-forward" size={12} color={colors.textFaint} />
        <Text style={s.routeText} numberOfLines={1}>{destinationLabel}</Text>
      </View>

      {/* Fare hero: label left, amount right */}
      <View style={s.fareBox}>
        <Text style={s.fareLabel}>FARE</Text>
        <Text style={s.fareAmount}>₱{result.fare.toFixed(2)}</Text>
      </View>

      {/* Stats grid */}
      <View style={s.grid}>
        <Stat icon="navigate" label="Dist" value={`${result.distanceKm.toFixed(2)} km`} />
        {result.durationMin != null && (
          <Stat icon="time" label="Time" value={`${Math.round(result.durationMin)} min`} />
        )}
        <Stat icon="cash" label="Regular" value={`₱${regularFare.toFixed(2)}`} />
        {isDiscounted && (
          <Stat icon="pricetag" label="Discount" value={`-₱${result.fareBreakdown.discount.toFixed(2)}`} valueColor={colors.primary} />
        )}
      </View>

      {/* Badges row */}
      {(result.isEstimate || providerLabel) && (
        <View style={s.badgeRow}>
          {result.isEstimate && (
            <View style={s.estimateBadge}>
              <Text style={s.estimateText}>Estimated (straight-line)</Text>
            </View>
          )}
          {providerLabel && (
            <View style={s.providerBadge}>
              <Text style={s.providerText}>{providerLabel}</Text>
            </View>
          )}
        </View>
      )}

      {/* Formula */}
      <View style={s.breakdown}>
        <Text style={s.breakdownText}>
          Base ₱{result.fareBreakdown.baseFare.toFixed(2)} + {result.fareBreakdown.additionalKm.toFixed(2)} km × ₱{result.farePolicy.perKmRate}/km
        </Text>
      </View>
    </View>
  );
}

function Stat({ icon, label, value, valueColor }: { icon: IoniconName; label: string; value: string; valueColor?: string }) {
  return (
    <View style={s.gridItem}>
      <View style={s.gridLabelRow}>
        <Ionicons name={icon} size={11} color={colors.textFaint} />
        <Text style={s.gridLabel}>{label}</Text>
      </View>
      <Text style={[s.gridValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    elevation: 3,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg,
  },
  routeText: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.textBody },
  fareBox: {
    backgroundColor: colors.textStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fareLabel: { color: colors.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  fareAmount: { color: colors.onPrimary, fontSize: 26, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.sm, paddingVertical: 6, gap: 6 },
  gridItem: { flex: 1, minWidth: '22%', backgroundColor: colors.surfaceAlt, borderRadius: radii.sm, padding: 7 },
  gridLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  gridLabel: { fontSize: 9, color: colors.textFaint, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  gridValue: { fontSize: 13, fontWeight: '700', color: colors.textStrong, marginTop: 1 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.sm, gap: 4 },
  estimateBadge: { backgroundColor: '#fff7ed', borderRadius: 6, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  estimateText: { color: colors.warningDark, fontSize: 10 },
  providerBadge: { backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  providerText: { color: colors.info, fontSize: 10 },
  breakdown: { paddingHorizontal: spacing.md, paddingVertical: 6 },
  breakdownText: { color: colors.textFaint, fontSize: 10 },
});
