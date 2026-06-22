import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

interface DashboardStats {
  totalUsers: number;
  totalIncidents: number;
  pendingIncidents: number;
  resolvedIncidents: number;
  totalVehicles: number;
  totalPermits: number;
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ stats: DashboardStats }>('/api/dashboard/stats');
      setStats(data.stats);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
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

  if (loading) {
    return <SafeAreaView style={s.center}><ActivityIndicator color="#16a34a" size="large" /></SafeAreaView>;
  }

  const statItems: { label: string; value: number; color: string; icon: IoniconName }[] = stats ? [
    { label: 'Total Users', value: stats.totalUsers, color: '#3b82f6', icon: 'people' },
    { label: 'Pending Incidents', value: stats.pendingIncidents, color: '#f59e0b', icon: 'warning' },
    { label: 'Total Incidents', value: stats.totalIncidents, color: '#dc2626', icon: 'alert-circle' },
    { label: 'Resolved', value: stats.resolvedIncidents, color: '#16a34a', icon: 'checkmark-circle' },
    { label: 'Vehicles', value: stats.totalVehicles, color: '#8b5cf6', icon: 'car' },
    { label: 'Active Permits', value: stats.totalPermits, color: '#06b6d4', icon: 'document-text' },
  ] : [];

  return (
    <SafeAreaView style={s.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={s.header}>
          <Text style={s.title}>Admin Dashboard</Text>
          <Text style={s.sub}>{user?.firstName} {user?.lastName}</Text>
        </View>
        {error ? (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
            <Pressable style={s.retryBtn} onPress={() => { setLoading(true); void load(); }}>
              <Text style={s.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={s.grid}>
          {statItems.map((item) => (
            <View key={item.label} style={s.statCard}>
              <Ionicons name={item.icon} size={28} color={item.color} style={s.icon} />
              <Text style={[s.statVal, { color: item.color }]}>{item.value}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 24, paddingBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  sub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  errorBox: { marginHorizontal: 12, marginBottom: 12, backgroundColor: '#fef2f2', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorText: { color: '#dc2626', fontSize: 13, fontWeight: '500', flex: 1, marginRight: 12 },
  retryBtn: { backgroundColor: '#dc2626', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10 },
  statCard: { width: '47%', backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2 },
  icon: { marginBottom: 8 },
  statVal: { fontSize: 36, fontWeight: '900' },
  statLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', marginTop: 4, textAlign: 'center' },
});
