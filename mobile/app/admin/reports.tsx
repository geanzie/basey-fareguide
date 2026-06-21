import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/services/api';

type Period = '7d' | '30d' | '90d' | '1y';

interface StatusCount { status: string; _count: number }
interface TypeCount { incidentType?: string; type?: string; _count: number }
interface UserTypeCount { userType: string; _count: number }

interface ReportsData {
  totalIncidents: number;
  incidentsByStatus: StatusCount[];
  incidentsByType: TypeCount[];
  totalUsers: number;
  activeUsers: number;
  usersByType: UserTypeCount[];
  evidenceTotals?: { total: number };
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const PERIODS: { label: string; value: Period }[] = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: '1y', value: '1y' },
];

export default function AdminReportsScreen() {
  const router = useRouter();
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('30d');

  const load = useCallback(async () => {
    try {
      const res = await api.get<ReportsData>(`/api/admin/reports?period=${period}`);
      setData(res);
    } catch {} finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return <SafeAreaView style={s.center}><ActivityIndicator color="#16a34a" size="large" /></SafeAreaView>;
  }

  const statCards: { label: string; value: string | number; color: string; icon: IoniconName }[] = data ? [
    { label: 'Total Incidents', value: data.totalIncidents, color: '#dc2626', icon: 'alert-circle' },
    { label: 'Total Users', value: data.totalUsers, color: '#3b82f6', icon: 'people' },
    { label: 'Active Users', value: data.activeUsers, color: '#16a34a', icon: 'person-check' as IoniconName },
    { label: 'Evidence Files', value: data.evidenceTotals?.total ?? '—', color: '#8b5cf6', icon: 'attach' },
  ] : [];

  return (
    <SafeAreaView style={s.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={s.headerRow}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backBtnText}>Back</Text>
          </Pressable>
          <Text style={s.title}>Reports</Text>
        </View>

        <View style={s.periodBar}>
          {PERIODS.map((p) => (
            <Pressable
              key={p.value}
              style={[s.periodBtn, period === p.value && s.periodBtnActive]}
              onPress={() => { setPeriod(p.value); setLoading(true); }}
            >
              <Text style={[s.periodBtnText, period === p.value && s.periodBtnTextActive]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={s.grid}>
          {statCards.map((item) => (
            <View key={item.label} style={s.statCard}>
              <Ionicons name={item.icon} size={24} color={item.color} />
              <Text style={[s.statVal, { color: item.color }]}>{item.value}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {data && data.incidentsByStatus.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Incidents by Status</Text>
            {data.incidentsByStatus.map((row) => (
              <View key={row.status} style={s.row}>
                <Text style={s.rowLabel}>{row.status}</Text>
                <Text style={s.rowVal}>{row._count}</Text>
              </View>
            ))}
          </View>
        )}

        {data && data.incidentsByType.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Incidents by Type</Text>
            {data.incidentsByType.map((row, i) => {
              const key = (row.incidentType ?? row.type ?? '') + i;
              const label = (row.incidentType ?? row.type ?? 'UNKNOWN').replace(/_/g, ' ');
              return (
                <View key={key} style={s.row}>
                  <Text style={s.rowLabel}>{label}</Text>
                  <Text style={s.rowVal}>{row._count}</Text>
                </View>
              );
            })}
          </View>
        )}

        {data && data.usersByType.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Users by Role</Text>
            {data.usersByType.map((row) => (
              <View key={row.userType} style={s.row}>
                <Text style={s.rowLabel}>{row.userType.replace(/_/g, ' ')}</Text>
                <Text style={s.rowVal}>{row._count}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  backBtn: {},
  backBtnText: { color: '#3b82f6', fontSize: 15 },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  periodBar: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  periodBtn: { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center', backgroundColor: '#e2e8f0' },
  periodBtnActive: { backgroundColor: '#0f172a' },
  periodBtnText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  periodBtnTextActive: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10, marginBottom: 16 },
  statCard: { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2 },
  statVal: { fontSize: 28, fontWeight: '900' },
  statLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', textAlign: 'center' },
  section: { backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 16, marginBottom: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowLabel: { fontSize: 13, color: '#374151' },
  rowVal: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
});
