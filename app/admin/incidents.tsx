import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  ActivityIndicator, Pressable, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchAllIncidents } from '@/services/incidents';
import type { Incident, IncidentStatus } from '@/types/incidents';
import IncidentCard from '@/components/IncidentCard';
import { ListSkeleton } from '@/ui/Skeleton';

const STATUSES: Array<{ label: string; value: IncidentStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Investigating', value: 'INVESTIGATING' },
  { label: 'Ticket Issued', value: 'TICKET_ISSUED' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Dismissed', value: 'DISMISSED' },
];

export default function AdminIncidentsScreen() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filter, setFilter] = useState<IncidentStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (status: IncidentStatus | 'ALL') => {
    try {
      const res = await fetchAllIncidents(status === 'ALL' ? undefined : status);
      setIncidents(res.items);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(filter); }, [filter, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(filter);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <ListSkeleton count={4} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <Text style={s.title}>All Incidents</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
        {STATUSES.map((st) => (
          <Pressable
            key={st.value}
            style={[s.filterChip, filter === st.value && s.filterChipActive]}
            onPress={() => { setFilter(st.value); setLoading(true); }}
          >
            <Text style={[s.filterChipText, filter === st.value && s.filterChipTextActive]}>
              {st.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <FlatList
        style={s.flatList}
        data={incidents}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.list}
        ListEmptyComponent={<Text style={s.empty}>No incidents found.</Text>}
        renderItem={({ item }) => <IncidentCard incident={item} />}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', padding: 16, paddingBottom: 8 },
  filterRow: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  filterChip: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#e2e8f0' },
  filterChipActive: { backgroundColor: '#0f172a' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  filterChipTextActive: { color: '#fff' },
  flatList: { flex: 1 },
  list: { padding: 16, gap: 10 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
});
