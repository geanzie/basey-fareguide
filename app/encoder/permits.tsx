import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/services/api';

interface Permit {
  id: string;
  permitPlateNumber: string;
  driverFullName: string;
  vehicleType: string;
  status: string;
  expiryDate: string;
  issuedDate: string;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#16a34a',
  EXPIRED: '#dc2626',
  SUSPENDED: '#f59e0b',
  REVOKED: '#64748b',
};

export default function PermitsScreen() {
  const [permits, setPermits] = useState<Permit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await api.get<{ permits: Permit[] }>('/api/permits');
      setPermits(data.permits ?? []);
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
    return <SafeAreaView style={s.center}><ActivityIndicator color="#16a34a" size="large" /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.container}>
      <FlatList
        data={permits}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={<Text style={s.title}>Permit Management</Text>}
        ListEmptyComponent={<Text style={s.empty}>No permits found.</Text>}
        renderItem={({ item }) => {
          const color = STATUS_COLORS[item.status] ?? '#64748b';
          return (
            <View style={s.card}>
              <View style={s.row}>
                <Text style={s.plate}>{item.permitPlateNumber}</Text>
                <View style={[s.badge, { backgroundColor: color + '22' }]}>
                  <Text style={[s.badgeText, { color }]}>{item.status}</Text>
                </View>
              </View>
              <Text style={s.driver}>{item.driverFullName}</Text>
              <Text style={s.meta}>
                {item.vehicleType.replace(/_/g, ' ')} · Expires {new Date(item.expiryDate).toLocaleDateString('en-PH')}
              </Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  plate: { fontSize: 16, fontWeight: '800', color: '#0f172a', letterSpacing: 1 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  driver: { fontSize: 14, color: '#374151', fontWeight: '600' },
  meta: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
});
