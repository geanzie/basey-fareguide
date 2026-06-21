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
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '@/services/api';

interface TicketedIncident {
  id: string;
  ticketNumber: string;
  incidentType: string;
  plateNumber?: string | null;
  location: string;
  incidentDate: string;
  penaltyAmount?: number | null;
  paymentStatus?: string | null;
  status: string;
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  UNPAID: '#dc2626',
  PAID: '#16a34a',
  WAIVED: '#64748b',
};

export default function EncoderTicketPaymentsScreen() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<TicketedIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ incidents: TicketedIncident[] }>(
        '/api/incidents?status=TICKET_ISSUED',
      );
      setIncidents(res.incidents ?? []);
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

  const openPaymentModal = (id: string) => {
    setSelectedId(id);
    setReceiptNumber('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedId(null);
    setReceiptNumber('');
  };

  const submitPayment = async () => {
    if (!selectedId) return;
    if (!receiptNumber.trim()) {
      Alert.alert('Required', 'Official receipt number is required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/api/incidents/${selectedId}/payment`, {
        officialReceiptNumber: receiptNumber.trim(),
      });
      closeModal();
      await load();
      Alert.alert('Payment Recorded', 'Ticket payment recorded and incident marked as resolved.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to record payment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <SafeAreaView style={s.center}><ActivityIndicator color="#16a34a" size="large" /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.container}>
      <FlatList
        data={incidents}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View style={s.headerRow}>
            <Pressable style={s.backBtn} onPress={() => router.back()}>
              <Text style={s.backBtnText}>Back</Text>
            </Pressable>
            <Text style={s.title}>Ticket Payments</Text>
          </View>
        }
        ListEmptyComponent={<Text style={s.empty}>No tickets awaiting payment.</Text>}
        renderItem={({ item }) => {
          const psColor = PAYMENT_STATUS_COLORS[item.paymentStatus ?? ''] ?? '#64748b';
          return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.ticketNum}>#{item.ticketNumber}</Text>
                {item.paymentStatus && (
                  <View style={[s.badge, { backgroundColor: psColor + '22' }]}>
                    <Text style={[s.badgeText, { color: psColor }]}>{item.paymentStatus}</Text>
                  </View>
                )}
              </View>
              <Text style={s.cardType}>{item.incidentType.replace(/_/g, ' ')}</Text>
              <Text style={s.cardMeta}>{item.location} · {new Date(item.incidentDate).toLocaleDateString('en-PH')}</Text>
              {item.plateNumber ? <Text style={s.plate}>{item.plateNumber}</Text> : null}
              {item.penaltyAmount != null && (
                <Text style={s.penalty}>Penalty: ₱{Number(item.penaltyAmount).toLocaleString('en-PH')}</Text>
              )}
              {item.paymentStatus === 'UNPAID' && (
                <Pressable style={s.recordBtn} onPress={() => openPaymentModal(item.id)}>
                  <Text style={s.recordBtnText}>Record Payment</Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Record Payment</Text>
            <Pressable onPress={closeModal}><Text style={s.cancelText}>Cancel</Text></Pressable>
          </View>
          <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLabel}>Official Receipt Number</Text>
            <TextInput
              style={s.input}
              value={receiptNumber}
              onChangeText={setReceiptNumber}
              placeholder="e.g. OR-2024-001234"
              placeholderTextColor="#94a3b8"
              autoFocus
            />
            <Text style={s.hint}>
              Recording payment will mark the incident as resolved. Ensure the receipt number is correct before submitting.
            </Text>
            <Pressable
              style={[s.submitBtn, submitting && s.submitBtnDisabled]}
              onPress={submitPayment}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitBtnText}>Confirm Payment</Text>}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  backBtn: {},
  backBtnText: { color: '#3b82f6', fontSize: 15 },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1, gap: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketNum: { fontWeight: '800', color: '#0f172a', fontSize: 15 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardType: { color: '#374151', fontSize: 13, fontWeight: '600' },
  cardMeta: { color: '#94a3b8', fontSize: 12 },
  plate: { fontWeight: '800', color: '#0f172a', letterSpacing: 1, fontSize: 13 },
  penalty: { color: '#dc2626', fontWeight: '700', fontSize: 13 },
  recordBtn: { backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 8 },
  recordBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  modal: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  cancelText: { color: '#3b82f6', fontSize: 15 },
  modalBody: { padding: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 15, color: '#0f172a', backgroundColor: '#fff', marginBottom: 12 },
  hint: { fontSize: 12, color: '#94a3b8', lineHeight: 18, marginBottom: 20 },
  submitBtn: { backgroundColor: '#16a34a', borderRadius: 14, padding: 16, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
