import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import GradientHeader from '@/ui/GradientHeader';
import { fetchEnforcerStats, fetchEnforcerIncidents } from '@/services/incidents';
import type { EnforcerStats, Incident } from '@/types/incidents';
import QrComplianceScanModal from '@/components/QrComplianceScanModal';
import IncidentCard from '@/components/IncidentCard';
import { StatGridSkeleton, SectionSkeleton } from '@/ui/Skeleton';

interface StatCard {
  label: string;
  value: number;
  color: string;
  bg: string;
}

export default function EnforcerDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<EnforcerStats | null>(null);
  const [recent, setRecent] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [error, setError] = useState('');

  const handleReviewIncidents = (plateNumber: string) => {
    router.push({ pathname: '/enforcer/incidents', params: { plate: plateNumber } });
  };

  const load = useCallback(async () => {
    try {
      const [data, incidents] = await Promise.all([
        fetchEnforcerStats(),
        fetchEnforcerIncidents('unresolved'),
      ]);
      setStats(data);
      setRecent(incidents.items.slice(0, 5));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load stats.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const cards: StatCard[] = stats
    ? [
        { label: 'Total Incidents', value: stats.total, color: '#0f172a', bg: '#f1f5f9' },
        { label: 'For Review', value: stats.pending, color: '#b45309', bg: '#fef3c7' },
        { label: 'Awaiting Payment', value: stats.ticketIssued, color: '#7c3aed', bg: '#ede9fe' },
        { label: 'Resolved', value: stats.resolved, color: '#15803d', bg: '#dcfce7' },
      ]
    : [];

  return (
    <View style={s.container}>
      <GradientHeader title="Enforcement Dashboard" subtitle={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`} />
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        {loading ? (
          <>
            <StatGridSkeleton count={4} />
            <SectionSkeleton count={3} />
          </>
        ) : stats ? (
          <View style={s.grid}>
            {cards.map((card) => (
              <View key={card.label} style={[s.card, { backgroundColor: card.bg }]}>
                <Text style={[s.cardValue, { color: card.color }]}>{card.value}</Text>
                <Text style={[s.cardLabel, { color: card.color }]}>{card.label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error || 'Could not load stats.'}</Text>
            <Pressable style={s.retryBtn} onPress={() => { setLoading(true); void load(); }}>
              <Text style={s.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!loading && (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>Needs Review</Text>
              <Pressable onPress={() => router.push('/enforcer/incidents')} hitSlop={8}>
                <Text style={s.viewAll}>View all</Text>
              </Pressable>
            </View>
            {recent.length === 0 ? (
              <View style={s.infoCard}>
                <Text style={s.infoText}>No incidents awaiting review. Nice work.</Text>
              </View>
            ) : (
              recent.map((incident) => (
                <Pressable key={incident.id} onPress={() => router.push('/enforcer/incidents')}>
                  <IncidentCard incident={incident} />
                </Pressable>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* QR scan FAB */}
      <Pressable style={s.fab} onPress={() => setScanModalVisible(true)}>
        <Ionicons name="camera" size={24} color="#fff" />
      </Pressable>

      <QrComplianceScanModal
        visible={scanModalVisible}
        onClose={() => setScanModalVisible(false)}
        onReviewIncidents={handleReviewIncidents}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  scroll: { padding: 16, gap: 12 },
  header: { paddingBottom: 4 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  sub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  center: { paddingVertical: 32, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '47%',
    borderRadius: 14,
    padding: 16,
    gap: 4,
  },
  cardValue: { fontSize: 28, fontWeight: '800' },
  cardLabel: { fontSize: 12, fontWeight: '600' },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  infoText: { color: '#374151', fontSize: 14, lineHeight: 22 },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  viewAll: { fontSize: 13, fontWeight: '600', color: '#16a34a' },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorText: { color: '#dc2626', fontSize: 14, fontWeight: '500', flex: 1, marginRight: 12 },
  retryBtn: { backgroundColor: '#dc2626', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
