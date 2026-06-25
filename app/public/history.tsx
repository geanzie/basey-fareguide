import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ListSkeleton } from '@/ui/Skeleton';
import GradientHeader from '@/ui/GradientHeader';
import EmptyState from '@/ui/EmptyState';
import { colors, radii, spacing, shadow } from '@/ui/theme';
import { fetchFareHistory } from '@/services/fare';
import { fetchMyIncidents } from '@/services/incidents';
import type { FareCalculation } from '@/types/fare';
import type { Incident } from '@/types/incidents';
import IncidentCard from '@/components/IncidentCard';

type Tab = 'trips' | 'reports';

export default function HistoryScreen() {
  const [tab, setTab] = useState<Tab>('trips');
  const [trips, setTrips] = useState<FareCalculation[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const [tripRes, incRes] = await Promise.all([
        fetchFareHistory(),
        fetchMyIncidents(),
      ]);
      setTrips(tripRes.items);
      setIncidents(incRes.items);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={s.container}>
      <GradientHeader title="History" subtitle="Your trips and reports">
        <View style={s.segment}>
          {(['trips', 'reports'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              style={[s.segBtn, tab === t && s.segBtnActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[s.segText, tab === t && s.segTextActive]}>
                {t === 'trips' ? `Trips${trips.length ? ` (${trips.length})` : ''}` : `Reports${incidents.length ? ` (${incidents.length})` : ''}`}
              </Text>
            </Pressable>
          ))}
        </View>
      </GradientHeader>

      {loading ? (
        <View style={s.list}>
          <ListSkeleton count={5} />
        </View>
      ) : tab === 'trips' ? (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <EmptyState
              icon="navigate-outline"
              title="No trips yet"
              message="Calculate a fare and it will show up here."
              actionLabel="Open Calculator"
              onAction={() => router.push('/public/calculator')}
            />
          }
          renderItem={({ item }) => <TripCard item={item} />}
        />
      ) : (
        <FlatList
          data={incidents}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <EmptyState
              icon="warning-outline"
              title="No reports filed"
              message="Spotted an overcharge or violation? Report it to help enforce fair fares."
              actionLabel="File a Report"
              onAction={() => router.push('/public/report')}
            />
          }
          renderItem={({ item }) => <IncidentCard incident={item} />}
        />
      )}
    </View>
  );
}

function TripCard({ item }: { item: FareCalculation }) {
  const discount = item.discountType && item.discountType !== 'NONE'
    ? item.discountType.replace(/_/g, ' ')
    : null;
  return (
    <View style={s.tripCard}>
      <View style={s.tripIcon}>
        <Ionicons name="navigate" size={18} color={colors.primary} />
      </View>
      <View style={s.tripBody}>
        <Text style={s.tripRoute} numberOfLines={1}>
          {item.originLabel} <Text style={s.arrow}>→</Text> {item.destinationLabel}
        </Text>
        <View style={s.metaRow}>
          <View style={s.metaChip}>
            <Ionicons name="speedometer-outline" size={12} color={colors.textMuted} />
            <Text style={s.metaText}>{item.distanceKm.toFixed(1)} km</Text>
          </View>
          {discount ? (
            <View style={[s.metaChip, s.metaChipTint]}>
              <Ionicons name="pricetag-outline" size={12} color={colors.primary} />
              <Text style={[s.metaText, { color: colors.primary }]}>{discount}</Text>
            </View>
          ) : null}
          <Text style={s.dateText}>{new Date(item.createdAt).toLocaleDateString('en-PH')}</Text>
        </View>
      </View>
      <View style={s.farePill}>
        <Text style={s.fareText}>₱{Number(item.fare).toFixed(2)}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  segment: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radii.md,
    padding: 4,
    gap: 4,
  },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: radii.sm, alignItems: 'center' },
  segBtnActive: { backgroundColor: '#fff' },
  segText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  segTextActive: { color: colors.primaryDark },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  tripIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripBody: { flex: 1, gap: spacing.xs },
  tripRoute: { fontWeight: '700', color: colors.textStrong, fontSize: 14 },
  arrow: { color: colors.textFaint },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaChipTint: {},
  metaText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  dateText: { fontSize: 12, color: colors.textFaint },
  farePill: {
    backgroundColor: colors.surfaceTint,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  fareText: { fontWeight: '800', color: colors.primaryDark, fontSize: 14 },
});
