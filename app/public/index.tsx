import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { SectionSkeleton } from '@/ui/Skeleton';
import GradientHeader from '@/ui/GradientHeader';
import DonutRing from '@/ui/DonutRing';
import { colors, radii, shadow, spacing, statusColor } from '@/ui/theme';
import { fetchActiveAnnouncements } from '@/services/announcements';
import { fetchFareHistory } from '@/services/fare';
import { fetchDashboardStats, fetchDashboardActivity } from '@/services/incidents';
import type { Announcement } from '@/types/common';
import type { FareCalculation } from '@/types/fare';
import type { DashboardStats, DashboardActivityItem } from '@/types/incidents';

type IoniconName = keyof typeof Ionicons.glyphMap;

const CATEGORY_META: Record<string, { color: string; icon: IoniconName }> = {
  EMERGENCY_NOTICE: { color: colors.danger, icon: 'alert-circle' },
  ROAD_CLOSURE: { color: colors.warning, icon: 'close-circle' },
  ROAD_WORK: { color: colors.warning, icon: 'construct' },
  TRAFFIC_ADVISORY: { color: colors.info, icon: 'car' },
  GENERAL_INFORMATION: { color: colors.primary, icon: 'information-circle' },
};
const CATEGORY_FALLBACK = { color: colors.textMuted, icon: 'megaphone' as IoniconName };

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

  const resolutionRate = useMemo(() => {
    if (!stats || stats.totalIncidents <= 0) return 0;
    return stats.resolvedIncidents / stats.totalIncidents;
  }, [stats]);

  return (
    <View style={s.container}>
      <GradientHeader title={`Hello, ${user?.firstName ?? ''} 👋`} subtitle="Basey FareCheck" />
      {loading ? (
        <View style={s.loadingBody}>
          <SectionSkeleton count={2} />
          <SectionSkeleton count={3} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {announcements.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Announcements</Text>
              {announcements.map((ann) => {
                const meta = CATEGORY_META[ann.category] ?? CATEGORY_FALLBACK;
                return (
                  <View key={ann.id} style={s.annCard}>
                    <View style={[s.annIcon, { backgroundColor: meta.color + '1a' }]}>
                      <Ionicons name={meta.icon} size={18} color={meta.color} />
                    </View>
                    <View style={s.annBody}>
                      <Text style={s.annTitle}>{ann.title}</Text>
                      <Text style={s.annContent} numberOfLines={2}>{ann.body}</Text>
                      <Text style={[s.annCat, { color: meta.color }]}>{ann.category.replace(/_/g, ' ')}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {trips.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Recent Trips</Text>
              {trips.map((trip) => (
                <View key={trip.id} style={s.tripCard}>
                  <View style={s.tripRoute}>
                    <Ionicons name="navigate" size={14} color={colors.primary} />
                    <Text style={s.tripRouteText} numberOfLines={1}>
                      {trip.originLabel} → {trip.destinationLabel}
                    </Text>
                  </View>
                  <View style={s.tripFooter}>
                    <Text style={s.tripMeta}>
                      {trip.distanceKm.toFixed(2)} km · {new Date(trip.createdAt).toLocaleDateString('en-PH')}
                    </Text>
                    <Text style={s.tripFare}>₱{Number(trip.fare).toFixed(2)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={s.section}>
            <Text style={s.sectionTitle}>Enforcement Transparency</Text>

            {stats !== null && (
              <View style={s.enforceCard}>
                <DonutRing
                  percent={resolutionRate}
                  size={116}
                  color={colors.primary}
                  centerLabel="Resolved"
                />
                <View style={s.enforceStats}>
                  <MiniStat icon="document-text" tone={colors.info} value={stats.totalIncidents} label="Total Reports" />
                  <MiniStat icon="checkmark-circle" tone={colors.primary} value={stats.resolvedIncidents} label="Resolved" />
                  <MiniStat icon="hourglass" tone={colors.warning} value={stats.pendingIncidents} label="Under Review" />
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
        </ScrollView>
      )}
    </View>
  );
}

function MiniStat({ icon, tone, value, label }: { icon: IoniconName; tone: string; value: number; label: string }) {
  return (
    <View style={s.miniStat}>
      <View style={[s.miniIcon, { backgroundColor: tone + '1a' }]}>
        <Ionicons name={icon} size={15} color={tone} />
      </View>
      <Text style={[s.miniValue, { color: tone }]}>{value}</Text>
      <Text style={s.miniLabel} numberOfLines={1}>{label}</Text>
    </View>
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
  container: { flex: 1, backgroundColor: colors.bg },
  loadingBody: { paddingTop: spacing.lg },
  listContent: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },

  annCard: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radii.md, padding: 14, marginBottom: 8, gap: 12, alignItems: 'center', ...shadow.card },
  annIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  annBody: { flex: 1 },
  annTitle: { fontWeight: '700', color: colors.textStrong, fontSize: 14, marginBottom: 4 },
  annContent: { color: colors.textMuted, fontSize: 13 },
  annCat: { fontSize: 11, fontWeight: '700', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },

  tripCard: { backgroundColor: colors.surface, borderRadius: radii.md, padding: 14, marginBottom: 8, ...shadow.card },
  tripRoute: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  tripRouteText: { flex: 1, fontWeight: '600', color: colors.textStrong, fontSize: 14 },
  tripFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripMeta: { color: colors.textFaint, fontSize: 12 },
  tripFare: { fontWeight: '800', color: colors.primary, fontSize: 16 },

  enforceCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.card },
  enforceStats: { flex: 1, gap: spacing.sm },
  miniStat: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  miniIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  miniValue: { fontSize: 18, fontWeight: '800', minWidth: 36 },
  miniLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600', flexShrink: 1 },

  emptyState: { margin: 32, alignItems: 'center' },
  emptyText: { color: colors.textFaint, fontSize: 14, textAlign: 'center' },

  activityCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: radii.md, padding: 14, marginBottom: 8, gap: 10, ...shadow.card },
  activityBody: { flex: 1 },
  activityType: { fontWeight: '700', color: colors.textStrong, fontSize: 14 },
  activityLocation: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  activityHandler: { color: colors.textFaint, fontSize: 11, marginTop: 3 },
  activityRight: { alignItems: 'flex-end', gap: 4 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  ticketNum: { fontFamily: 'monospace', fontSize: 11, color: colors.textMuted },
});
