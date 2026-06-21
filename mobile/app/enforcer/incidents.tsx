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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchEnforcerIncidents, issueTicket, dismissIncident, verifyEvidence } from '@/services/incidents';
import type { Incident } from '@/types/incidents';

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  INVESTIGATING: '#3b82f6',
  TICKET_ISSUED: '#8b5cf6',
  RESOLVED: '#16a34a',
  DISMISSED: '#64748b',
};

type ModalMode = 'ticket' | 'dismiss' | null;

export default function EnforcerIncidentsScreen() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchEnforcerIncidents();
      setIncidents(res.items);
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

  const openModal = (id: string, mode: ModalMode) => {
    setActiveId(id);
    setModalMode(mode);
    setInputValue('');
  };

  const closeModal = () => {
    setModalMode(null);
    setActiveId(null);
    setInputValue('');
  };

  const handleVerifyEvidence = async (id: string) => {
    Alert.alert(
      'Verify Evidence',
      'Confirm that you have reviewed all submitted evidence and it is sufficient to proceed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify',
          onPress: async () => {
            setVerifyingId(id);
            try {
              await verifyEvidence(id);
              await load();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to verify evidence.');
            } finally {
              setVerifyingId(null);
            }
          },
        },
      ],
    );
  };

  const submitModal = async () => {
    if (!activeId || !modalMode) return;
    if (modalMode === 'ticket') {
      if (!inputValue.trim()) {
        Alert.alert('Required', 'Enter a ticket number.');
        return;
      }
      setModalLoading(true);
      try {
        await issueTicket(activeId, { ticketNumber: inputValue.trim() });
        closeModal();
        await load();
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed.');
      } finally {
        setModalLoading(false);
      }
    } else {
      if (!inputValue.trim()) {
        Alert.alert('Required', 'Enter a reason for dismissal.');
        return;
      }
      setModalLoading(true);
      try {
        await dismissIncident(activeId, { remarks: inputValue.trim() });
        closeModal();
        await load();
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed.');
      } finally {
        setModalLoading(false);
      }
    }
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
      <FlatList
        data={incidents}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={<Text style={s.title}>Incident Queue</Text>}
        ListEmptyComponent={<Text style={s.empty}>No incidents in queue.</Text>}
        renderItem={({ item }) => {
          const color = STATUS_COLORS[item.status] ?? '#64748b';
          const isPending = item.status === 'PENDING';
          const evidenceVerified = !!item.evidenceVerifiedAt;
          const isVerifying = verifyingId === item.id;

          return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.type}>{item.incidentType.replace(/_/g, ' ')}</Text>
                <View style={[s.badge, { backgroundColor: color + '22' }]}>
                  <Text style={[s.badgeText, { color }]}>{item.status}</Text>
                </View>
              </View>
              <Text style={s.desc} numberOfLines={2}>{item.description}</Text>
              <Text style={s.meta}>{item.location} · {new Date(item.incidentDate).toLocaleDateString('en-PH')}</Text>
              {item.plateNumber ? <Text style={s.plate}>{item.plateNumber}</Text> : null}

              {item.evidenceCount !== undefined && item.evidenceCount > 0 && (
                <Text style={s.evidenceMeta}>
                  {item.evidenceCount} evidence file{item.evidenceCount !== 1 ? 's' : ''}
                  {evidenceVerified ? ' · Verified' : ' · Pending verification'}
                </Text>
              )}

              {isPending && (
                <View style={s.btnRow}>
                  {!evidenceVerified ? (
                    <>
                      <Pressable
                        style={[s.btn, s.btnBlue, isVerifying && s.btnDisabled]}
                        onPress={() => handleVerifyEvidence(item.id)}
                        disabled={isVerifying}
                      >
                        {isVerifying
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={s.btnText}>Verify Evidence</Text>}
                      </Pressable>
                      <Pressable style={[s.btn, s.btnGray]} onPress={() => openModal(item.id, 'dismiss')}>
                        <Text style={s.btnText}>Dismiss</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable style={[s.btn, s.btnGreen]} onPress={() => openModal(item.id, 'ticket')}>
                        <Text style={s.btnText}>Issue Ticket</Text>
                      </Pressable>
                      <Pressable style={[s.btn, s.btnGray]} onPress={() => openModal(item.id, 'dismiss')}>
                        <Text style={s.btnText}>Dismiss</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              )}
            </View>
          );
        }}
      />

      <Modal visible={modalMode !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>
              {modalMode === 'ticket' ? 'Issue Ticket' : 'Dismiss Incident'}
            </Text>
            <Pressable onPress={closeModal} style={s.closeBtn}>
              <Text style={s.closeBtnText}>Cancel</Text>
            </Pressable>
          </View>
          <View style={s.modalBody}>
            <Text style={s.modalLabel}>
              {modalMode === 'ticket' ? 'Ticket Number' : 'Reason for dismissal'}
            </Text>
            <TextInput
              style={s.modalInput}
              value={inputValue}
              onChangeText={setInputValue}
              placeholder={modalMode === 'ticket' ? 'e.g. 500' : 'Enter reason...'}
              placeholderTextColor="#94a3b8"
              keyboardType="default"
              autoFocus
              multiline={modalMode === 'dismiss'}
              numberOfLines={modalMode === 'dismiss' ? 4 : 1}
              textAlignVertical={modalMode === 'dismiss' ? 'top' : 'center'}
            />
            <Pressable
              style={[s.modalSubmitBtn, modalLoading && s.modalSubmitDisabled]}
              onPress={submitModal}
              disabled={modalLoading}
            >
              {modalLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.modalSubmitText}>
                  {modalMode === 'ticket' ? 'Issue Ticket' : 'Dismiss'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  type: { fontWeight: '700', color: '#0f172a', fontSize: 14 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  desc: { color: '#64748b', fontSize: 13 },
  meta: { color: '#94a3b8', fontSize: 12 },
  plate: { fontWeight: '800', color: '#0f172a', letterSpacing: 1, fontSize: 13 },
  evidenceMeta: { color: '#64748b', fontSize: 12, fontStyle: 'italic' },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  btn: { flex: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
  btnBlue: { backgroundColor: '#2563eb' },
  btnGreen: { backgroundColor: '#16a34a' },
  btnGray: { backgroundColor: '#64748b' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  modal: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  closeBtn: { padding: 4 },
  closeBtnText: { color: '#3b82f6', fontSize: 15 },
  modalBody: { padding: 16 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  modalInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 15, color: '#0f172a', backgroundColor: '#fff', marginBottom: 16, minHeight: 50 },
  modalSubmitBtn: { backgroundColor: '#16a34a', borderRadius: 14, padding: 16, alignItems: 'center' },
  modalSubmitDisabled: { opacity: 0.6 },
  modalSubmitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
