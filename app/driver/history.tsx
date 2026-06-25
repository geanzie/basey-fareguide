import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { ListSkeleton } from '@/ui/Skeleton';
import GradientHeader from '@/ui/GradientHeader';
import { api } from '@/services/api';

interface TripSession {
  id: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  riderCount: number;
}

export default function DriverHistoryScreen() {
  const [sessions, setSessions] = useState<TripSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await api.get<{ items: TripSession[] }>('/api/driver/session/history');
      setSessions(data.items);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={s.container}>
        <GradientHeader title="Trip History" />
        <ListSkeleton count={5} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <GradientHeader title="Trip History" />
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.list}
        ListEmptyComponent={<Text style={s.empty}>No trips completed yet.</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.plate}>{item.riderCount} riders</Text>
              <Text style={s.riders}>{item.status}</Text>
            </View>
            <Text style={s.meta}>
              {new Date(item.openedAt).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
              {item.closedAt
                ? ` — ${new Date(item.closedAt).toLocaleTimeString('en-PH', { timeStyle: 'short' })}`
                : ' (open)'}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  plate: { fontWeight: '800', color: '#0f172a', fontSize: 15, letterSpacing: 1 },
  riders: { color: '#16a34a', fontWeight: '700' },
  meta: { color: '#94a3b8', fontSize: 12 },
});
