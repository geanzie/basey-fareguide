import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Share,
} from 'react-native';
import GradientHeader from '@/ui/GradientHeader';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/services/api';
import { StatGridSkeleton, ListSkeleton } from '@/ui/Skeleton';

type Period = '7d' | '30d' | '90d' | '1y';

interface CountRow { label: string; count: number }

/** Raw shape returned by GET /api/admin/reports. */
interface ReportsApiResponse {
  data: {
    incidents: { total: number; byStatus: Record<string, number>; byType: Record<string, number> };
    users: { total: number; active: number; byType: Record<string, number> };
    storage: { totalFiles: number };
  };
}

/** Normalized shape this screen renders. */
interface ReportsData {
  totalIncidents: number;
  incidentsByStatus: CountRow[];
  incidentsByType: CountRow[];
  totalUsers: number;
  activeUsers: number;
  usersByType: CountRow[];
  evidenceFiles: number;
}

const toRows = (obj: Record<string, number>): CountRow[] =>
  Object.entries(obj).map(([label, count]) => ({ label, count }));

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
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<Period>('30d');

  const load = useCallback(async () => {
    try {
      const res = await api.get<ReportsApiResponse>(`/api/admin/reports?period=${period}`);
      const d = res.data;
      setData({
        totalIncidents: d.incidents.total,
        incidentsByStatus: toRows(d.incidents.byStatus),
        incidentsByType: toRows(d.incidents.byType),
        totalUsers: d.users.total,
        activeUsers: d.users.active,
        usersByType: toRows(d.users.byType),
        evidenceFiles: d.storage.totalFiles,
      });
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const exportCsv = async () => {
    if (!data) return;
    const lines: string[] = [`Basey FareCheck Report - ${period}`, ''];
    lines.push('Incidents by Status', 'Status,Count');
    data.incidentsByStatus.forEach((r) => lines.push(`${r.label},${r.count}`));
    lines.push('', 'Incidents by Type', 'Type,Count');
    data.incidentsByType.forEach((r) => lines.push(`${r.label.replace(/_/g, ' ')},${r.count}`));
    lines.push('', 'Users by Role', 'Role,Count');
    data.usersByType.forEach((r) => lines.push(`${r.label.replace(/_/g, ' ')},${r.count}`));
    await Share.share({ message: lines.join('\n'), title: `Basey FareCheck Report ${period}` });
  };

  if (loading) {
    return (
      <View style={s.container}>
        <GradientHeader title="Reports" onBack={() => router.back()} />
        <StatGridSkeleton count={4} />
        <ListSkeleton count={3} />
      </View>
    );
  }

  const statCards: { label: string; value: string | number; color: string; icon: IoniconName }[] = data ? [
    { label: 'Total Incidents', value: data.totalIncidents, color: '#dc2626', icon: 'alert-circle' },
    { label: 'Total Users', value: data.totalUsers, color: '#3b82f6', icon: 'people' },
    { label: 'Active Users', value: data.activeUsers, color: '#16a34a', icon: 'people-circle' },
    { label: 'Evidence Files', value: data.evidenceFiles, color: '#8b5cf6', icon: 'attach' },
  ] : [];

  return (
    <View style={s.container}>
      <GradientHeader
        title="Reports"
        onBack={() => router.back()}
        right={
          <Pressable style={[s.exportBtn, !data && s.exportBtnDisabled]} onPress={exportCsv} disabled={!data}>
            <Text style={s.exportBtnText}>Export CSV</Text>
          </Pressable>
        }
      />
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
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

        {error ? (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
            <Pressable style={s.retryBtn} onPress={() => { setLoading(true); void load(); }}>
              <Text style={s.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {data && data.incidentsByStatus.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Incidents by Status</Text>
            {data.incidentsByStatus.map((row) => (
              <View key={row.label} style={s.row}>
                <Text style={s.rowLabel}>{row.label}</Text>
                <Text style={s.rowVal}>{row.count}</Text>
              </View>
            ))}
          </View>
        )}

        {data && data.incidentsByType.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Incidents by Type</Text>
            {data.incidentsByType.map((row) => (
              <View key={row.label} style={s.row}>
                <Text style={s.rowLabel}>{row.label.replace(/_/g, ' ')}</Text>
                <Text style={s.rowVal}>{row.count}</Text>
              </View>
            ))}
          </View>
        )}

        {data && data.usersByType.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Users by Role</Text>
            {data.usersByType.map((row) => (
              <View key={row.label} style={s.row}>
                <Text style={s.rowLabel}>{row.label.replace(/_/g, ' ')}</Text>
                <Text style={s.rowVal}>{row.count}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorBox: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fef2f2', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorText: { color: '#dc2626', fontSize: 13, fontWeight: '500', flex: 1, marginRight: 12 },
  retryBtn: { backgroundColor: '#dc2626', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  headerRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  backBtn: {},
  backBtnText: { color: '#3b82f6', fontSize: 15 },
  exportBtn: { marginLeft: 'auto' as never, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  exportBtnDisabled: { opacity: 0.4 },
  exportBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
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
