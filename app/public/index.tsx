import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { SectionSkeleton } from '@/ui/Skeleton';
import { colors, shadow, statusColor } from '@/ui/theme';
import { fetchActiveAnnouncements } from '@/services/announcements';
import { fetchFareHistory } from '@/services/fare';
import { fetchDashboardStats, fetchDashboardActivity } from '@/services/incidents';
import type { Announcement } from '@/types/common';
import type { FareCalculation } from '@/types/fare';
import type { DashboardStats, DashboardActivityItem } from '@/types/incidents';

const CATEGORY_COLORS: Record<string, string> = {
  EMERGENCY_NOTICE: '#dc2626',
  ROAD_CLOSURE: '#f59e0b',
  ROAD_WORK: '#f59e0b',
  TRAFFIC_ADVISORY: '#3b82f6',
  GENERAL_INFORMATION: '#16a34a',
};

export default function PublicDashboard() {
  const { user } = useAuthStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [trips, setTrips] = useState<FareCalculation[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<DashboardActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [annRes, tripRes, statsRes, activityRes] = await Promise.all([
        fetchActiveAnnouncements(),
        fetchFareHistory(1, 5),
        fetchDashboardStats(),
        fetchDashboardActivity(3),
      ]);
      setAnnouncements(annRes.items);
      setTrips(tripRes.items);
      setStats(statsRes);
      setActivity(activityRes);
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

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <SectionSkeleton count={2} />
        <SectionSkeleton count={3} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <FlatList
        data={[]}
        keyExtractor={() => ''}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            <View style={s.header}>
              <Text style={s.greeting}>Hello, {user?.firstName} 👋</Text>
              <Text style={s.sub}>Basey FareCheck</Text>
            </View>

            {announcements.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Announcements</Text>
                {announcements.map((ann) => (
                  <View key={ann.id} style={s.annCard}>
                    <View style={[s.annDot, { backgroundColor: CATEGORY_COLORS[ann.category] ?? '#64748b' }]} />
                    <View style={s.annBody}>
                      <Text style={s.annTitle}>{ann.title}</Text>
                      <Text style={s.annContent} numberOfLines={2}>{ann.body}</Text>
                      <Text style={s.annCat}>{ann.category.replace(/_/g, ' ')}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {trips.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Recent Trips</Text>
                {trips.map((trip) => (
                  <View key={trip.id} style={s.tripCard}>
                    <View style={s.tripRow}>
                      <Text style={s.tripRoute} numberOfLines={1}>
                        {trip.originLabel} → {trip.destinationLabel}
                      </Text>
                      <Text style={s.tripFare}>₱{Number(trip.fare).toFixed(2)}</Text>
                    </View>
                    <Text style={s.tripMeta}>
                      {trip.distanceKm.toFixed(2)} km · {new Date(trip.createdAt).toLocaleDateString('en-PH')}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={s.section}>
              <Text style={s.sectionTitle}>Enforcement Transparency</Text>

              {stats !== null && (
                <View style={s.statsStrip}>
                  <View style={s.statCell}>
                    <Text style={[s.statNum, { color: colors.textStrong }]}>{stats.totalIncidents}</Text>
                    <Text style={s.statLabel}>Total Reports</Text>
                  </View>
                  <View style={[s.statCell, s.statCellBorder]}>
                    <Text style={[s.statNum, { color: colors.primary }]}>{stats.resolvedIncidents}</Text>
                    <Text style={s.statLabel}>Resolved</Text>
                  </View>
                  <View style={[s.statCell, s.statCellBorder]}>
                    <Text style={[s.statNum, { color: colors.warning }]}>{stats.pendingIncidents}</Text>
                    <Text style={s.statLabel}>Under Review</Text>
                  </View>
                </View>
              )}

              {activity.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}

              {activity.length === 0 && (
                <Text style={s.emptyText}>No enforcement actions recorded yet.</Text>
              )}
            </View>

            {announcements.length === 0 && trips.length === 0 && (
              <View style={s.emptyState}>
                <Text style={s.emptyText}>No activity yet. Try the Fare Calculator!</Text>
              </View>
            )}
          </View>
        }
        renderItem={() => null}
      />
    </SafeAreaView>
  );
}

function ActivityRow({ item }: { item: DashboardActivityItem }) {
  const badgeColor = statusColor(item.status);
  return (
    <View style={s.activityCard}>
      <View style={s.activityBody}>
        <Text style={s.activityType}>{item.typeLabel}</Text>
        <Text style={s.activityLocation}>{item.location}</Text>
        {item.handledBy ? (
          <Text style={s.activityHandler}>Handled by {item.handledBy}</Text>
        ) : null}
      </View>
      <View style={s.activityRight}>
        <View style={[s.badge, { backgroundColor: badgeColor + '22' }]}>
          <Text style={[s.badgeText, { color: badgeColor }]}>{item.statusLabel}</Text>
        </View>
        {item.ticketNumber ? (
          <Text style={s.ticketNum}>#{item.ticketNumber}</Text>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 24, paddingBottom: 8 },
  greeting: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  sub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  annCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  annDot: { width: 4, borderRadius: 2, alignSelf: 'stretch' },
  annBody: { flex: 1 },
  annTitle: { fontWeight: '700', color: '#0f172a', fontSize: 14, marginBottom: 4 },
  annContent: { color: '#64748b', fontSize: 13 },
  annCat: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
  tripCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  tripRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  tripRoute: { flex: 1, fontWeight: '600', color: '#0f172a', fontSize: 14 },
  tripFare: { fontWeight: '800', color: '#16a34a', fontSize: 15 },
  tripMeta: { color: '#94a3b8', fontSize: 12 },
  emptyState: { margin: 32, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
  statsStrip: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, ...shadow.card },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statCellBorder: { borderLeftWidth: 1, borderLeftColor: colors.border },
  statNum: { fontSize: 22, fontWeight: '800' as const },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  activityCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, gap: 10, ...shadow.card },
  activityBody: { flex: 1 },
  activityType: { fontWeight: '700' as const, color: colors.textStrong, fontSize: 14 },
  activityLocation: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  activityHandler: { color: colors.textFaint, fontSize: 11, marginTop: 3 },
  activityRight: { alignItems: 'flex-end' as const, gap: 4 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' as const },
  ticketNum: { fontFamily: 'monospace', fontSize: 11, color: colors.textMuted },
});
