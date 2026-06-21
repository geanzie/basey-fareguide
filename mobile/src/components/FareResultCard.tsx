import { View, Text, StyleSheet } from 'react-native';
import type { RouteCalculationResponse } from '@/types/fare';

interface Props {
  result: RouteCalculationResponse;
  originLabel: string;
  destinationLabel: string;
}

export default function FareResultCard({ result, originLabel, destinationLabel }: Props) {
  const isDiscounted = (result.fareBreakdown.discount ?? 0) > 0;
  const regularFare = result.fareBreakdown.baseFare + result.fareBreakdown.additionalFare;

  return (
    <View style={s.card}>
      <View style={s.routeRow}>
        <Text style={s.routeText} numberOfLines={1}>{originLabel}</Text>
        <Text style={s.arrow}>→</Text>
        <Text style={s.routeText} numberOfLines={1}>{destinationLabel}</Text>
      </View>

      <View style={s.fareBox}>
        <Text style={s.fareLabel}>FARE</Text>
        <Text style={s.fareAmount}>₱{result.fare.toFixed(2)}</Text>
      </View>

      <View style={s.grid}>
        <View style={s.gridItem}>
          <Text style={s.gridLabel}>Distance</Text>
          <Text style={s.gridValue}>{result.distanceKm.toFixed(2)} km</Text>
        </View>
        {result.durationMin != null && (
          <View style={s.gridItem}>
            <Text style={s.gridLabel}>Duration</Text>
            <Text style={s.gridValue}>{Math.round(result.durationMin)} min</Text>
          </View>
        )}
        <View style={s.gridItem}>
          <Text style={s.gridLabel}>Regular</Text>
          <Text style={s.gridValue}>₱{regularFare.toFixed(2)}</Text>
        </View>
        {isDiscounted && (
          <View style={s.gridItem}>
            <Text style={s.gridLabel}>Discount</Text>
            <Text style={[s.gridValue, s.discount]}>-₱{result.fareBreakdown.discount.toFixed(2)}</Text>
          </View>
        )}
      </View>

      {result.isEstimate && (
        <View style={s.estimateBadge}>
          <Text style={s.estimateText}>Straight-line estimate — no road route found</Text>
        </View>
      )}

      <View style={s.breakdown}>
        <Text style={s.breakdownText}>
          Base ₱{result.fareBreakdown.baseFare.toFixed(2)} + {result.fareBreakdown.additionalKm.toFixed(2)} km × ₱{result.farePolicy.perKmRate}/km
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    elevation: 4,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  routeText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
  arrow: { color: '#94a3b8', fontSize: 14 },
  fareBox: { backgroundColor: '#0f172a', padding: 20, alignItems: 'center' },
  fareLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  fareAmount: { color: '#fff', fontSize: 40, fontWeight: '900', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  gridItem: { width: '47%', backgroundColor: '#f8fafc', borderRadius: 10, padding: 12 },
  gridLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  gridValue: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  discount: { color: '#16a34a' },
  estimateBadge: { marginHorizontal: 12, marginBottom: 8, backgroundColor: '#fff7ed', borderRadius: 8, padding: 10 },
  estimateText: { color: '#b45309', fontSize: 12 },
  breakdown: { padding: 12, paddingTop: 0 },
  breakdownText: { color: '#94a3b8', fontSize: 11 },
});
