import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/services/api';
import { fetchPermits } from '@/services/permits';
import type { Permit } from '@/types/permits';
import GradientHeader from '@/ui/GradientHeader';
import StatTile from '@/ui/StatTile';
import { StatGridSkeleton } from '@/ui/Skeleton';
import { colors, radii, spacing, shadow } from '@/ui/theme';

interface Vehicle {
  isActive: boolean;
  permit?: { permitPlateNumber: string } | null;
}

interface TicketedIncident {
  ticketNumber: string | null;
  paymentStatus?: string | null;
  penaltyAmount?: number | null;
}

const EXPIRY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

type IoniconName = keyof typeof Ionicons.glyphMap;

export default function EncoderDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [permits, setPermits] = useState<Permit[]>([]);
  const [tickets, setTickets] = useState<TicketedIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // Each source fails independently — show whatever loaded (matches the other tabs).
    const [v, p, i] = await Promise.allSettled([
      api.get<{ vehicles: Vehicle[] }>('/api/vehicles'),
      fetchPermits(),
      api.get<{ incidents: TicketedIncident[] }>('/api/incidents?limit=200'),
    ]);
    if (v.status === 'fulfilled') setVehicles(v.value.vehicles ?? []);
    if (p.status === 'fulfilled') setPermits(p.value);
    if (i.status === 'fulfilled') {
      setTickets((i.value.incidents ?? []).filter((t) => Boolean(t.ticketNumber)));
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const stats = useMemo(() => {
    const now = Date.now();
    const activePermits = permits.filter((p) => p.status.toUpperCase() === 'ACTIVE');
    const expiringSoon = activePermits.filter((p) => {
      const exp = new Date(p.expiryDate).getTime();
      return exp - now <= EXPIRY_WINDOW_MS && exp >= now;
    }).length;
    const unpaid = tickets.filter((t) => (t.paymentStatus ?? 'UNPAID') === 'UNPAID');
    const outstanding = unpaid.reduce((sum, t) => sum + (t.penaltyAmount ?? 0), 0);
    return {
      vehicles: vehicles.length,
      activeVehicles: vehicles.filter((v) => v.isActive).length,
      activePermits: activePermits.length,
      expiringSoon,
      unpaid: unpaid.length,
      outstanding,
    };
  }, [vehicles, permits, tickets]);

  if (loading) {
    return (
      <View style={s.container}>
        <GradientHeader title="Encoder Dashboard" subtitle={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`} />
        <StatGridSkeleton count={6} />
      </View>
    );
  }

  const hasAttention = stats.expiringSoon > 0 || stats.unpaid > 0;

  const tiles: { label: string; value: string | number; tone: string; icon: IoniconName; route: Href }[] = [
    { label: 'Vehicles', value: stats.vehicles, tone: colors.purple, icon: 'car', route: '/encoder/vehicles' },
    { label: 'Active Vehicles', value: stats.activeVehicles, tone: colors.primary, icon: 'checkmark-circle', route: '/encoder/vehicles' },
    { label: 'Active Permits', value: stats.activePermits, tone: colors.info, icon: 'document-text', route: '/encoder/permits' },
    { label: 'Expiring ≤30d', value: stats.expiringSoon, tone: colors.warning, icon: 'time', route: '/encoder/permits' },
    { label: 'Unpaid Tickets', value: stats.unpaid, tone: colors.danger, icon: 'receipt', route: '/encoder/ticket-payments' },
    { label: 'Outstanding', value: `₱${stats.outstanding.toLocaleString('en-PH')}`, tone: colors.danger, icon: 'cash', route: '/encoder/ticket-payments' },
  ];

  return (
    <View style={s.container}>
      <GradientHeader title="Encoder Dashboard" subtitle={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`} />
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={s.grid}>
          {tiles.map((t) => (
            <Pressable key={t.label} style={s.tileWrap} onPress={() => router.push(t.route)}>
              <StatTile label={t.label} value={t.value} icon={t.icon} tone={t.tone} />
            </Pressable>
          ))}
        </View>

        <Text style={s.sectionTitle}>Needs Attention</Text>
        <View style={s.attentionBlock}>
          {stats.expiringSoon > 0 ? (
            <AttentionRow
              icon="time"
              tone={colors.warning}
              text={`${stats.expiringSoon} permit${stats.expiringSoon === 1 ? '' : 's'} expiring soon`}
              onPress={() => router.push('/encoder/permits')}
            />
          ) : null}
          {stats.unpaid > 0 ? (
            <AttentionRow
              icon="receipt"
              tone={colors.danger}
              text={`${stats.unpaid} unpaid ticket${stats.unpaid === 1 ? '' : 's'} · ₱${stats.outstanding.toLocaleString('en-PH')} outstanding`}
              onPress={() => router.push('/encoder/ticket-payments')}
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
  icon: keyof typeof Ionicons.glyphMap;
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
  attentionBlock: { gap: spacing.sm },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  attentionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  attentionText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textBody },
  allClear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceTint,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  allClearText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  cardPressed: { opacity: 0.85 },
});
