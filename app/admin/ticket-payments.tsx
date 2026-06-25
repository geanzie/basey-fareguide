import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Pressable,
  TextInput,
} from 'react-native';
import GradientHeader from '@/ui/GradientHeader';
import { useRouter } from 'expo-router';
import { api } from '@/services/api';
import { ListSkeleton } from '@/ui/Skeleton';

// Ticketed incidents from the shared incidents endpoint; there is no dedicated
// ticket-payments API. Mirrors app/encoder/ticket-payments.tsx.
interface TicketPayment {
  id: string;
  ticketNumber: string | null;
  penaltyAmount?: number | null;
  officialReceiptNumber?: string | null;
  paymentStatus?: string | null;
  paidAt?: string | null;
  incidentType?: string;
  type?: string;
  plateNumber?: string | null;
  handledBy?: { firstName?: string; lastName?: string } | null;
}

export default function AdminTicketPaymentsScreen() {
  const router = useRouter();
  const [payments, setPayments] = useState<TicketPayment[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ incidents: TicketPayment[] }>('/api/incidents?limit=200');
      setPayments((res.incidents ?? []).filter((i) => Boolean(i.ticketNumber)));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket payments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const filtered = search.trim()
    ? payments.filter((p) =>
        (p.ticketNumber ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (p.officialReceiptNumber ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : payments;

  if (loading) {
    return (
      <View style={s.container}>
        <GradientHeader title="Ticket Payments" onBack={() => router.back()} />
        <ListSkeleton count={4} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <GradientHeader title="Ticket Payments" onBack={() => router.back()} />
      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View>
            {error ? (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
                <Pressable style={s.retryBtn} onPress={() => { setLoading(true); void load(); }}>
                  <Text style={s.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}
            <TextInput
              style={s.search}
              value={search}
              onChangeText={setSearch}
              placeholder="Search ticket or receipt number..."
              placeholderTextColor="#94a3b8"
              clearButtonMode="while-editing"
            />
          </View>
        }
        ListEmptyComponent={<Text style={s.empty}>No ticket payments found.</Text>}
        renderItem={({ item }) => {
          const isPaid = item.paymentStatus === 'PAID' || Boolean(item.paidAt);
          const handler = item.handledBy
            ? `${item.handledBy.firstName ?? ''} ${item.handledBy.lastName ?? ''}`.trim()
            : '';
          const incType = item.incidentType ?? item.type;
          return (
            <View style={s.card}>
              <View style={s.cardRow}>
                <Text style={s.ticketNum}>#{item.ticketNumber}</Text>
                <Text style={s.amount}>₱{(item.penaltyAmount ?? 0).toFixed(2)}</Text>
              </View>
              {incType && (
                <Text style={s.type}>{incType.replace(/_/g, ' ')}</Text>
              )}
              {item.plateNumber && (
                <Text style={s.plate}>{item.plateNumber}</Text>
              )}
              <View style={s.metaRow}>
                <Text style={[s.meta, { fontWeight: '700', color: isPaid ? '#16a34a' : '#f59e0b' }]}>
                  {isPaid ? 'PAID' : 'UNPAID'}
                </Text>
                {item.paidAt && (
                  <Text style={s.meta}>{new Date(item.paidAt).toLocaleDateString('en-PH')}</Text>
                )}
              </View>
              <Text style={s.meta}>Receipt: {item.officialReceiptNumber || '—'}</Text>
              {handler ? <Text style={s.recorder}>Handled by {handler}</Text> : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorBox: { marginBottom: 12, backgroundColor: '#fef2f2', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorText: { color: '#dc2626', fontSize: 13, fontWeight: '500', flex: 1, marginRight: 12 },
  retryBtn: { backgroundColor: '#dc2626', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  list: { padding: 16, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  backBtn: { color: '#3b82f6', fontSize: 15 },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  search: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 14, color: '#0f172a', backgroundColor: '#fff', marginBottom: 12 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  loadMore: { paddingVertical: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  ticketNum: { fontSize: 15, fontWeight: '800', color: '#0f172a', letterSpacing: 0.5 },
  amount: { fontSize: 16, fontWeight: '900', color: '#16a34a' },
  type: { fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 2 },
  plate: { fontSize: 12, color: '#374151', fontWeight: '700', marginBottom: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  meta: { fontSize: 11, color: '#94a3b8' },
  recorder: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
});
