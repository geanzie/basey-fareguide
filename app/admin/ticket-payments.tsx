import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '@/services/api';
import { ListSkeleton } from '@/ui/Skeleton';

interface TicketPayment {
  id: string;
  ticketNumber: string;
  amount: number;
  receiptNumber: string;
  paidAt: string;
  recordedBy: string;
  incidentType?: string;
  plateNumber?: string;
}

interface PaymentsResponse {
  payments: TicketPayment[];
  total: number;
  hasMore: boolean;
}

const PAGE_SIZE = 20;

export default function AdminTicketPaymentsScreen() {
  const router = useRouter();
  const [payments, setPayments] = useState<TicketPayment[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (pageNum = 1, replace = true) => {
    try {
      const res = await api.get<PaymentsResponse>(
        `/api/admin/ticket-payments?page=${pageNum}&pageSize=${PAGE_SIZE}`,
      );
      const items = res.payments ?? [];
      setPayments((prev) => replace ? items : [...prev, ...items]);
      setHasMore(res.hasMore ?? false);
      setPage(pageNum);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load(1, true);
  };

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    void load(page + 1, false);
  };

  const filtered = search.trim()
    ? payments.filter((p) =>
        p.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
        (p.receiptNumber ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : payments;

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <ListSkeleton count={4} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View>
            <View style={s.headerRow}>
              <Pressable onPress={() => router.back()}>
                <Text style={s.backBtn}>Back</Text>
              </Pressable>
              <Text style={s.title}>Ticket Payments</Text>
            </View>
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
        ListFooterComponent={loadingMore ? <ActivityIndicator color="#16a34a" style={s.loadMore} /> : null}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardRow}>
              <Text style={s.ticketNum}>#{item.ticketNumber}</Text>
              <Text style={s.amount}>₱{item.amount.toFixed(2)}</Text>
            </View>
            {item.incidentType && (
              <Text style={s.type}>{item.incidentType.replace(/_/g, ' ')}</Text>
            )}
            {item.plateNumber && (
              <Text style={s.plate}>{item.plateNumber}</Text>
            )}
            <View style={s.metaRow}>
              <Text style={s.meta}>Receipt: {item.receiptNumber || '—'}</Text>
              <Text style={s.meta}>{new Date(item.paidAt).toLocaleDateString('en-PH')}</Text>
            </View>
            <Text style={s.recorder}>Recorded by {item.recordedBy}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
