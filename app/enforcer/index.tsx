import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { fetchEnforcerStats } from '@/services/incidents';
import type { EnforcerStats } from '@/types/incidents';

interface StatCard {
  label: string;
  value: number;
  color: string;
  bg: string;
}

export default function EnforcerDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<EnforcerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchEnforcerStats();
      setStats(data);
    } catch {
      // stats fail silently — queue tab still works
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
    <SafeAreaView style={s.container}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={s.header}>
          <Text style={s.title}>Enforcement Dashboard</Text>
          <Text style={s.sub}>{user?.firstName} {user?.lastName}</Text>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color="#16a34a" size="large" />
          </View>
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
          <View style={s.infoCard}>
            <Text style={s.infoText}>Could not load stats. Pull to refresh.</Text>
          </View>
        )}

        <View style={s.infoCard}>
          <Text style={s.infoText}>
            Use the Queue tab to manage incoming incident reports. Verify evidence, issue tickets, or dismiss cases.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
});
