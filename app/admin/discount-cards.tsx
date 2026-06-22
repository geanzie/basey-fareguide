import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '@/services/api';
import { ListSkeleton } from '@/ui/Skeleton';

interface DiscountCardUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
}

interface DiscountCard {
  id: string;
  discountType: string;
  verificationStatus: string;
  isActive: boolean;
  fullName: string;
  validFrom: string;
  validUntil: string;
  createdAt: string;
  user: DiscountCardUser;
}

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  APPROVED: '#16a34a',
  REJECTED: '#dc2626',
  SUSPENDED: '#64748b',
};

export default function AdminDiscountCardsScreen() {
  const router = useRouter();
  const [cards, setCards] = useState<DiscountCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('PENDING');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const q = filter !== 'ALL' ? `?verificationStatus=${filter}` : '';
      const res = await api.get<{ discountCards: DiscountCard[] }>(`/api/admin/discount-cards${q}`);
      setCards(res.discountCards ?? []);
    } catch {} finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleAction = (cardId: string, fullName: string, action: 'approve' | 'reject') => {
    Alert.alert(
      action === 'approve' ? 'Approve Application' : 'Reject Application',
      `${action === 'approve' ? 'Approve' : 'Reject'} discount card application for ${fullName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'approve' ? 'Approve' : 'Reject',
          style: action === 'reject' ? 'destructive' : 'default',
          onPress: async () => {
            setActionLoadingId(cardId);
            try {
              await api.patch('/api/admin/discount-cards', { discountCardId: cardId, action });
              await load();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Action failed.');
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ],
    );
  };

  const FILTERS: StatusFilter[] = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'];

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <ListSkeleton count={4} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.headerRow}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>Back</Text>
        </Pressable>
        <Text style={s.title}>Discount Cards</Text>
      </View>

      <View style={s.filterBar}>
        {FILTERS.map((f) => (
          <Pressable key={f} style={[s.filterBtn, filter === f && s.filterBtnActive]} onPress={() => setFilter(f)}>
            <Text style={[s.filterBtnText, filter === f && s.filterBtnTextActive]}>{f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.list}
        ListEmptyComponent={<Text style={s.empty}>No {filter !== 'ALL' ? filter.toLowerCase() : ''} applications.</Text>}
        renderItem={({ item }) => {
          const statusColor = STATUS_COLORS[item.verificationStatus] ?? '#64748b';
          const isActioning = actionLoadingId === item.id;
          const isPending = item.verificationStatus === 'PENDING';

          return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <View style={s.cardInfo}>
                  <Text style={s.cardName}>{item.fullName}</Text>
                  <Text style={s.cardUser}>@{item.user.username} · {item.user.firstName} {item.user.lastName}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: statusColor + '22' }]}>
                  <Text style={[s.badgeText, { color: statusColor }]}>{item.verificationStatus}</Text>
                </View>
              </View>
              <Text style={s.cardType}>{item.discountType.replace(/_/g, ' ')}</Text>
              <Text style={s.cardMeta}>
                Applied {new Date(item.createdAt).toLocaleDateString('en-PH')} ·
                Valid until {new Date(item.validUntil).toLocaleDateString('en-PH')}
              </Text>
              {isPending && (
                <View style={s.btnRow}>
                  <Pressable
                    style={[s.actionBtn, s.btnApprove, isActioning && s.btnDisabled]}
                    onPress={() => handleAction(item.id, item.fullName, 'approve')}
                    disabled={isActioning}
                  >
                    {isActioning
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={s.actionBtnText}>Approve</Text>}
                  </Pressable>
                  <Pressable
                    style={[s.actionBtn, s.btnReject, isActioning && s.btnDisabled]}
                    onPress={() => handleAction(item.id, item.fullName, 'reject')}
                    disabled={isActioning}
                  >
                    <Text style={s.actionBtnText}>Reject</Text>
                  </Pressable>
                </View>
              )}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  backBtn: {},
  backBtnText: { color: '#3b82f6', fontSize: 15 },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  filterBar: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  filterBtn: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#e2e8f0' },
  filterBtnActive: { backgroundColor: '#0f172a' },
  filterBtnText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  filterBtnTextActive: { color: '#fff' },
  list: { padding: 16, gap: 10 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1, gap: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInfo: { flex: 1, marginRight: 8 },
  cardName: { fontWeight: '700', color: '#0f172a', fontSize: 14 },
  cardUser: { color: '#64748b', fontSize: 12, marginTop: 2 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardType: { color: '#374151', fontSize: 13, fontWeight: '600' },
  cardMeta: { color: '#94a3b8', fontSize: 11 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  btnApprove: { backgroundColor: '#16a34a' },
  btnReject: { backgroundColor: '#dc2626' },
  btnDisabled: { opacity: 0.6 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
