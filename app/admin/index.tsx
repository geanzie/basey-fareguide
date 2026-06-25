import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { StatGridSkeleton } from '@/ui/Skeleton';
import StatTile from '@/ui/StatTile';
import GradientHeader from '@/ui/GradientHeader';
import { colors, radii, spacing, shadow } from '@/ui/theme';

interface DashboardStats {
  totalUsers: number;
  totalIncidents: number;
  pendingIncidents: number;
  resolvedIncidents: number;
  totalVehicles: number;
  totalPermits: number;
}

interface TicketedIncident {
  ticketNumber: string | null;
  paymentStatus?: string | null;
  penaltyAmount?: number | null;
}

type IoniconName = keyof typeof Ionicons.glyphMap;

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tickets, setTickets] = useState<TicketedIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    // Stats drive the tiles (show retry on failure); tickets are best-effort.
    const [statsRes, ticketRes] = await Promise.allSettled([
      api.get<{ stats: DashboardStats }>('/api/dashboard/stats'),
      api.get<{ incidents: TicketedIncident[] }>('/api/incidents?limit=200'),
    ]);
    if (statsRes.status === 'fulfilled') {
      setStats(statsRes.value.stats);
      setError('');
    } else {
      setError(statsRes.reason instanceof Error ? statsRes.reason.message : 'Failed to load dashboard.');
    }
    if (ticketRes.status === 'fulfilled') {
      setTickets((ticketRes.value.incidents ?? []).filter((t) => Boolean(t.ticketNumber)));
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const ticketStats = useMemo(() => {
    const unpaid = tickets.filter((t) => (t.paymentStatus ?? 'UNPAID') === 'UNPAID');
    return {
      unpaid: unpaid.length,
      outstanding: unpaid.reduce((sum, t) => sum + (t.penaltyAmount ?? 0), 0),
    };
  }, [tickets]);

  if (loading) {
    return (
      <View style={s.container}>
        <GradientHeader title="Admin Dashboard" subtitle={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`} />
        <StatGridSkeleton count={6} />
      </View>
    );
  }

  const tiles: { label: string; value: number; tone: string; icon: IoniconName; route?: Href }[] = stats ? [
    { label: 'Total Users', value: stats.totalUsers, tone: colors.info, icon: 'people', route: '/admin/users' },
    { label: 'Pending Incidents', value: stats.pendingIncidents, tone: colors.warning, icon: 'warning', route: '/admin/incidents' },
    { label: 'Total Incidents', value: stats.totalIncidents, tone: colors.danger, icon: 'alert-circle', route: '/admin/incidents' },
    { label: 'Resolved', value: stats.resolvedIncidents, tone: colors.primary, icon: 'checkmark-circle', route: '/admin/incidents' },
    { label: 'Vehicles', value: stats.totalVehicles, tone: colors.purple, icon: 'car' },
    { label: 'Active Permits', value: stats.totalPermits, tone: colors.info, icon: 'document-text' },
  ] : [];

  const hasAttention = (stats?.pendingIncidents ?? 0) > 0 || ticketStats.unpaid > 0;

  return (
    <View style={s.container}>
      <GradientHeader title="Admin Dashboard" subtitle={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`} />
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {error ? (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
            <Pressable style={s.retryBtn} onPress={() => { setLoading(true); void load(); }}>
              <Text style={s.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={s.grid}>
          {tiles.map((t) =>
            t.route ? (
              <Pressable key={t.label} style={s.tileWrap} onPress={() => router.push(t.route as Href)}>
                <StatTile label={t.label} value={t.value} icon={t.icon} tone={t.tone} />
              </Pressable>
            ) : (
              <View key={t.label} style={s.tileWrap}>
                <StatTile label={t.label} value={t.value} icon={t.icon} tone={t.tone} />
              </View>
            ),
          )}
        </View>

        <Text style={s.sectionTitle}>Needs Attention</Text>
        <View style={s.attentionBlock}>
          {stats && stats.pendingIncidents > 0 ? (
            <AttentionRow
              icon="warning"
              tone={colors.warning}
              text={`${stats.pendingIncidents} incident${stats.pendingIncidents === 1 ? '' : 's'} pending review`}
              onPress={() => router.push('/admin/incidents')}
            />
          ) : null}
          {ticketStats.unpaid > 0 ? (
            <AttentionRow
              icon="receipt"
              tone={colors.danger}
              text={`${ticketStats.unpaid} unpaid ticket${ticketStats.unpaid === 1 ? '' : 's'} · ₱${ticketStats.outstanding.toLocaleString('en-PH')} outstanding`}
              onPress={() => router.push('/admin/ticket-payments')}
            />
          ) : null}
          {!hasAttention ? (
            <View style={s.allClear}>
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              <Text style={s.allClearText}>All caught up — nothing needs attention.</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function AttentionRow({
  icon,
  tone,
  text,
  onPress,
}: {
  icon: IoniconName;
  tone: string;
  text: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [s.attentionRow, pressed && s.cardPressed]} onPress={onPress}>
      <View style={[s.attentionIcon, { backgroundColor: tone + '1a' }]}>
        <Ionicons name={icon} size={18} color={tone} />
      </View>
      <Text style={s.attentionText}>{text}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tileWrap: { flexGrow: 1, flexBasis: '47%' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textStrong, marginTop: spacing.lg, marginBottom: spacing.xs },

  errorBox: { backgroundColor: colors.dangerSoftBg, borderRadius: radii.md, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '500', flex: 1, marginRight: spacing.md },
  retryBtn: { backgroundColor: colors.danger, borderRadius: radii.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  retryText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },

  attentionBlock: { gap: spacing.sm },
  attentionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, ...shadow.card },
  cardPressed: { opacity: 0.85 },
  attentionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  attentionText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textBody },
  allClear: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceTint, borderRadius: radii.lg, padding: spacing.lg },
  allClearText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
});
