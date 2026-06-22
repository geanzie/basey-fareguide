import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { StatGridSkeleton, SectionSkeleton } from '@/ui/Skeleton';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

interface DriverSession {
  driver: { id: string; firstName: string; lastName: string };
  vehicle: { id: string; plateNumber: string; vehicleType: string; make: string; model: string } | null;
  session: {
    id: string | null;
    status: string | null;
    activeRiderCount: number;
    pendingCount: number;
    boardedCount: number;
    canStartSession: boolean;
    canCloseSession: boolean;
  };
  sections: Array<{
    key: string;
    riders: Array<{
      id: string;
      origin: string;
      destination: string;
      fareSnapshot: number;
      status: string;
      availableActions: string[];
    }>;
  }>;
}

export default function DriverTripScreen() {
  const { user } = useAuthStore();
  const [data, setData] = useState<DriverSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<DriverSession>('/api/driver/session/active');
      setData(res);
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

  const startSession = async () => {
    setActing('start');
    try {
      await api.post('/api/driver/session/start', {});
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not start session.');
    } finally {
      setActing(null);
    }
  };

  const closeSession = async () => {
    if (!data?.session.id) return;
    Alert.alert('Close Trip', 'End this trip session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close',
        style: 'destructive',
        onPress: async () => {
          setActing('close');
          try {
            await api.post(`/api/driver/session/${data.session.id}/close`, {});
            await load();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Could not close session.');
          } finally {
            setActing(null);
          }
        },
      },
    ]);
  };

  const riderAction = async (sessionId: string, riderId: string, action: string) => {
    setActing(riderId);
    try {
      await api.post(`/api/driver/session/${sessionId}/riders/${riderId}/action`, { action });
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <StatGridSkeleton count={3} />
        <SectionSkeleton count={3} />
      </SafeAreaView>
    );
  }

  const session = data?.session;
  const vehicle = data?.vehicle;

  return (
    <SafeAreaView style={s.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={s.header}>
          <Text style={s.title}>Trip Session</Text>
          <Text style={s.sub}>{user?.firstName} {user?.lastName}</Text>
        </View>

        {vehicle ? (
          <View style={s.vehicleCard}>
            <Text style={s.plate}>{vehicle.plateNumber}</Text>
            <Text style={s.vehicleInfo}>
              {vehicle.vehicleType.replace(/_/g, ' ')} · {vehicle.make} {vehicle.model}
            </Text>
          </View>
        ) : (
          <View style={s.noVehicleCard}>
            <Text style={s.noVehicleText}>No vehicle assigned. Contact administrator.</Text>
          </View>
        )}

        {vehicle && session && (
          <View style={s.sessionCard}>
            <View style={s.statsRow}>
              {[
                { label: 'Pending', value: session.pendingCount },
                { label: 'Boarded', value: session.boardedCount },
                { label: 'Active', value: session.activeRiderCount },
              ].map((stat) => (
                <View key={stat.label} style={s.stat}>
                  <Text style={s.statVal}>{stat.value}</Text>
                  <Text style={s.statLbl}>{stat.label}</Text>
                </View>
              ))}
            </View>
            {session.canStartSession && (
              <Pressable
                style={[s.actionBtn, s.actionBtnGreen]}
                onPress={startSession}
                disabled={acting === 'start'}
              >
                {acting === 'start' ? <ActivityIndicator color="#fff" /> : <Text style={s.actionBtnText}>Start Trip</Text>}
              </Pressable>
            )}
            {session.canCloseSession && (
              <Pressable
                style={[s.actionBtn, s.actionBtnRed]}
                onPress={closeSession}
                disabled={acting === 'close'}
              >
                {acting === 'close' ? <ActivityIndicator color="#fff" /> : <Text style={s.actionBtnText}>Close Trip</Text>}
              </Pressable>
            )}
          </View>
        )}

        {data?.sections.map((section) =>
          section.riders.length === 0 ? null : (
            <View key={section.key} style={s.section}>
              <Text style={s.sectionTitle}>{section.key.toUpperCase()}</Text>
              {section.riders.map((rider) => (
                <View key={rider.id} style={s.riderCard}>
                  <Text style={s.riderRoute}>{rider.origin} → {rider.destination}</Text>
                  <Text style={s.riderFare}>₱{Number(rider.fareSnapshot).toFixed(2)}</Text>
                  {rider.availableActions.length > 0 && session?.id && (
                    <View style={s.riderBtnRow}>
                      {rider.availableActions.map((action) => (
                        <Pressable
                          key={action}
                          style={[s.riderBtn, action === 'ACCEPT' ? s.riderBtnGreen : s.riderBtnGray]}
                          onPress={() => riderAction(session.id!, rider.id, action)}
                          disabled={acting === rider.id}
                        >
                          {acting === rider.id ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <Text style={s.riderBtnText}>{action.replace(/_/g, ' ')}</Text>
                          )}
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          ),
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 24, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  sub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  vehicleCard: { margin: 16, backgroundColor: '#0f172a', borderRadius: 16, padding: 20 },
  plate: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  vehicleInfo: { color: '#94a3b8', marginTop: 4, fontSize: 13 },
  noVehicleCard: { margin: 16, backgroundColor: '#fef3c7', borderRadius: 16, padding: 20 },
  noVehicleText: { color: '#b45309', fontWeight: '600' },
  sessionCard: { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  stat: { alignItems: 'center' },
  statVal: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  statLbl: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  actionBtn: { borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 8 },
  actionBtnGreen: { backgroundColor: '#16a34a' },
  actionBtnRed: { backgroundColor: '#dc2626' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  section: { paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 1, marginBottom: 8 },
  riderCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  riderRoute: { fontWeight: '600', color: '#0f172a', fontSize: 14 },
  riderFare: { color: '#16a34a', fontWeight: '700', fontSize: 16, marginTop: 2 },
  riderBtnRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  riderBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  riderBtnGreen: { backgroundColor: '#16a34a' },
  riderBtnGray: { backgroundColor: '#64748b' },
  riderBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
