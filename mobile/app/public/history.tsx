import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchFareHistory } from '@/services/fare';
import { fetchMyIncidents } from '@/services/incidents';
import type { FareCalculation } from '@/types/fare';
import type { Incident } from '@/types/incidents';
import IncidentCard from '@/components/IncidentCard';

type Tab = 'trips' | 'reports';

export default function HistoryScreen() {
  const [tab, setTab] = useState<Tab>('trips');
  const [trips, setTrips] = useState<FareCalculation[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [tripRes, incRes] = await Promise.all([
        fetchFareHistory(),
        fetchMyIncidents(),
      ]);
      setTrips(tripRes.items);
      setIncidents(incRes.items);
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
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color="#16a34a" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.tabBar}>
        {(['trips', 'reports'] as Tab[]).map((t) => (
          <Pressable key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabBtnText, tab === t && s.tabBtnTextActive]}>
              {t === 'trips' ? 'Trips' : 'Reports'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'trips' ? (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={s.list}
          ListEmptyComponent={<Text style={s.empty}>No trips yet.</Text>}
          renderItem={({ item }) => (
            <View style={s.tripCard}>
              <View style={s.tripRow}>
                <Text style={s.tripRoute} numberOfLines={1}>
                  {item.originLabel} → {item.destinationLabel}
                </Text>
                <Text style={s.tripFare}>₱{Number(item.fare).toFixed(2)}</Text>
              </View>
              <Text style={s.tripMeta}>
                {item.distanceKm.toFixed(2)} km · {item.discountType !== 'NONE' ? item.discountType.replace('_', ' ') + ' · ' : ''}
                {new Date(item.createdAt).toLocaleDateString('en-PH')}
              </Text>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={incidents}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={s.list}
          ListEmptyComponent={<Text style={s.empty}>No reports filed.</Text>}
          renderItem={({ item }) => <IncidentCard incident={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#16a34a' },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  tabBtnTextActive: { color: '#16a34a' },
  list: { padding: 16, gap: 10 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  tripCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  tripRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  tripRoute: { flex: 1, fontWeight: '600', color: '#0f172a', fontSize: 14 },
  tripFare: { fontWeight: '800', color: '#16a34a', fontSize: 15 },
  tripMeta: { color: '#94a3b8', fontSize: 12 },
});
