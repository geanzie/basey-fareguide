import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ stats: DashboardStats }>('/api/dashboard/stats');
      setStats(data.stats);
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
        <View style={s.grid}>
          {statItems.map((item) => (
            <View key={item.label} style={s.statCard}>
              <Ionicons name={item.icon} size={28} color={item.color} style={s.icon} />
              <Text style={[s.statVal, { color: item.color }]}>{item.value}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={s.quickLinks}>
          <Text style={s.quickLinksTitle}>Quick Actions</Text>
          {[
            { label: 'Discount Cards', sub: 'Review applications', route: '/admin/discount-cards', icon: 'card-outline' as IoniconName },
            { label: 'Reports', sub: 'Analytics & statistics', route: '/admin/reports', icon: 'bar-chart-outline' as IoniconName },
            { label: 'Routing Settings', sub: 'Configure route provider', route: '/admin/settings', icon: 'git-branch-outline' as IoniconName },
          ].map((link) => (
            <Pressable
              key={link.label}
              style={({ pressed }) => [s.quickLink, pressed && s.quickLinkPressed]}
              onPress={() => router.push(link.route as never)}
            >
              <Ionicons name={link.icon} size={22} color="#16a34a" style={s.quickLinkIcon} />
              <View style={s.quickLinkText}>
                <Text style={s.quickLinkLabel}>{link.label}</Text>
                <Text style={s.quickLinkSub}>{link.sub}</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color="#94a3b8" />
            </Pressable>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10 },
  statCard: { width: '47%', backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2 },
  icon: { marginBottom: 8 },
  statVal: { fontSize: 36, fontWeight: '900' },
  statLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', marginTop: 4, textAlign: 'center' },
  quickLinks: { margin: 12, marginTop: 16, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2 },
  quickLinksTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  quickLink: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  quickLinkPressed: { backgroundColor: '#f8fafc' },
  quickLinkIcon: { marginRight: 12 },
  quickLinkText: { flex: 1 },
  quickLinkLabel: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  quickLinkSub: { fontSize: 12, color: '#64748b', marginTop: 1 },
});
