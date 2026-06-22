import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  fetchEnforcerIncidents,
  issueTicket,
  dismissIncident,
  verifyEvidence,
  getTicketPreview,
  getIncidentEvidence,
} from '@/services/incidents';
import type { Incident, TicketPenaltyPreview, EvidenceFile } from '@/types/incidents';
import AppModal from '@/ui/AppModal';
import Button from '@/ui/Button';
import { ListSkeleton } from '@/ui/Skeleton';

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  INVESTIGATING: '#3b82f6',
  TICKET_ISSUED: '#8b5cf6',
  RESOLVED: '#16a34a',
  DISMISSED: '#64748b',
};

const EVIDENCE_STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: '⏳ Pending',
  VERIFIED: '✓ Verified',
  REJECTED: '✗ Rejected',
  REQUIRES_ADDITIONAL: '⚠ Needs More',
};

const EVIDENCE_STATUS_COLORS: Record<string, string> = {
  PENDING_REVIEW: '#64748b',
  VERIFIED: '#16a34a',
  REJECTED: '#dc2626',
  REQUIRES_ADDITIONAL: '#b45309',
};

type StatusFilter = 'ALL' | 'PENDING' | 'TICKET_ISSUED';

type ModalMode = 'ticket' | 'dismiss' | null;

interface TicketModalState {
  incident: Incident;
  penalty: TicketPenaltyPreview | null;
  loadingPreview: boolean;
}

export default function EnforcerIncidentsScreen() {
  const { plate } = useLocalSearchParams<{ plate?: string }>();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState(plate ?? '');

  useEffect(() => {
    if (plate) setSearch(plate);
  }, [plate]);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [remarksValue, setRemarksValue] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [ticketModal, setTicketModal] = useState<TicketModalState | null>(null);

  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, EvidenceFile[] | null>>({});
  const [loadingEvidenceId, setLoadingEvidenceId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchEnforcerIncidents('unresolved');
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

  const filtered = useMemo(() => {
    return incidents.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        item.plateNumber?.toLowerCase().includes(q) ||
        item.location?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q)
      );
    });
  }, [incidents, statusFilter, search]);

  const handleVerifyEvidence = (id: string) => {
    Alert.alert(
      'Verify Evidence',
      'Confirm you have reviewed all submitted evidence and it is sufficient to proceed.',
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

  const handleOpenTicketModal = async (incident: Incident) => {
    setTicketModal({ incident, penalty: null, loadingPreview: true });
    setInputValue('');
    setRemarksValue('');
    try {
      const preview = await getTicketPreview(incident.id);
      setTicketModal((prev) => prev ? { ...prev, penalty: preview.penalty, loadingPreview: false } : null);
    } catch (err) {
      setTicketModal(null);
      Alert.alert('Cannot Issue Ticket', err instanceof Error ? err.message : 'Failed to load ticket details.');
    }
  };

  const closeTicketModal = () => {
    setTicketModal(null);
    setInputValue('');
    setRemarksValue('');
  };

  const submitTicket = async () => {
    if (!ticketModal) return;
    if (!inputValue.trim()) {
      Alert.alert('Required', 'Enter a ticket number.');
      return;
    }
    setModalLoading(true);
    try {
      await issueTicket(ticketModal.incident.id, {
        ticketNumber: inputValue.trim(),
        remarks: remarksValue.trim() || undefined,
      });
      closeTicketModal();
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to issue ticket.');
    } finally {
      setModalLoading(false);
    }
  };

  const openDismissModal = (id: string) => {
    setActiveId(id);
    setModalMode('dismiss');
    setInputValue('');
  };

  const closeDismissModal = () => {
    setModalMode(null);
    setActiveId(null);
    setInputValue('');
  };

  const submitDismiss = async () => {
    if (!activeId) return;
    if (!inputValue.trim()) {
      Alert.alert('Required', 'Enter a reason for dismissal.');
      return;
    }
    setModalLoading(true);
    try {
      await dismissIncident(activeId, { remarks: inputValue.trim() });
      closeDismissModal();
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to dismiss incident.');
    } finally {
      setModalLoading(false);
    }
  };

  const toggleEvidence = async (id: string) => {
    if (expandedEvidence[id] !== undefined) {
      setExpandedEvidence((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    setLoadingEvidenceId(id);
    try {
      const res = await getIncidentEvidence(id);
      setExpandedEvidence((prev) => ({ ...prev, [id]: res.evidence ?? [] }));
    } catch {
      setExpandedEvidence((prev) => ({ ...prev, [id]: [] }));
    } finally {
      setLoadingEvidenceId(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <ListSkeleton count={4} variant="complex" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Search */}
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search plate, location, description..."
          placeholderTextColor="#94a3b8"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Status filter tabs */}
      <View style={s.tabs}>
        {(['ALL', 'PENDING', 'TICKET_ISSUED'] as StatusFilter[]).map((f) => (
          <Pressable
            key={f}
            style={[s.tab, statusFilter === f && s.tabActive]}
            onPress={() => setStatusFilter(f)}
          >
            <Text style={[s.tabText, statusFilter === f && s.tabTextActive]}>
              {f === 'ALL' ? 'All' : f === 'PENDING' ? 'Pending' : 'Ticket Issued'}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <Text style={s.title}>
            Incident Queue{filtered.length > 0 ? ` (${filtered.length})` : ''}
          </Text>
        }
        ListEmptyComponent={<Text style={s.empty}>No incidents in queue.</Text>}
        renderItem={({ item }) => {
          const color = STATUS_COLORS[item.status] ?? '#64748b';
          const isPending = item.status === 'PENDING';
          const isTicketIssued = item.status === 'TICKET_ISSUED';
          const evidenceVerified = !!item.evidenceVerifiedAt;
          const hasEvidence = (item.evidenceCount ?? 0) > 0;
          const isVerifying = verifyingId === item.id;
          const evidenceExpanded = expandedEvidence[item.id] !== undefined;
          const evidenceFiles = expandedEvidence[item.id] ?? [];
          const isLoadingEvidence = loadingEvidenceId === item.id;

          return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.type}>{item.incidentType.replace(/_/g, ' ')}</Text>
                <View style={[s.badge, { backgroundColor: color + '22' }]}>
                  <Text style={[s.badgeText, { color }]}>{item.status.replace(/_/g, ' ')}</Text>
                </View>
              </View>

              <Text style={s.desc} numberOfLines={2}>{item.description}</Text>
              <Text style={s.meta}>{item.location} · {new Date(item.incidentDate).toLocaleDateString('en-PH')}</Text>
              {item.plateNumber ? <Text style={s.plate}>{item.plateNumber}</Text> : null}

              {/* Evidence summary + toggle */}
              <Pressable style={s.evidenceRow} onPress={() => toggleEvidence(item.id)}>
                {isLoadingEvidence ? (
                  <ActivityIndicator size="small" color="#64748b" />
                ) : (
                  <Text style={s.evidenceMeta}>
                    {hasEvidence
                      ? `${item.evidenceCount} evidence file${item.evidenceCount !== 1 ? 's' : ''} · ${evidenceVerified ? 'Verified ✓' : 'Pending verification'}`
                      : 'No evidence attached'}
                    {hasEvidence ? ` ${evidenceExpanded ? '▲' : '▼'}` : ''}
                  </Text>
                )}
              </Pressable>

              {/* Evidence file list */}
              {evidenceExpanded && (
                <View style={s.evidenceList}>
                  {evidenceFiles.length === 0 ? (
                    <Text style={s.evidenceEmpty}>No evidence files.</Text>
                  ) : (
                    evidenceFiles.map((f) => (
                      <View key={f.id} style={s.evidenceItem}>
                        <Text style={s.evidenceFileName} numberOfLines={1}>{f.fileName}</Text>
                        <Text style={[s.evidenceStatus, { color: EVIDENCE_STATUS_COLORS[f.status] ?? '#64748b' }]}>
                          {EVIDENCE_STATUS_LABELS[f.status] ?? f.status}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TICKET_ISSUED info */}
              {isTicketIssued && (
                <View style={s.ticketIssuedBox}>
                  <Text style={s.ticketIssuedLabel}>Ticket #{item.ticketNumber}</Text>
                  {item.penaltyAmount != null && (
                    <Text style={s.ticketIssuedAmount}>₱{item.penaltyAmount.toFixed(2)}</Text>
                  )}
                  <Text style={s.ticketIssuedNote}>Awaiting payment recording by encoder</Text>
                </View>
              )}

              {/* Action buttons — PENDING only */}
              {isPending && (
                <View style={s.btnRow}>
                  {!hasEvidence ? (
                    <>
                      <View style={[s.noEvidenceBox, { flex: 1 }]}>
                        <Text style={s.noEvidenceText}>No evidence — dismiss or wait for reporter</Text>
                      </View>
                      <Pressable style={[s.btn, s.btnGray]} onPress={() => openDismissModal(item.id)}>
                        <Text style={s.btnText}>Dismiss</Text>
                      </Pressable>
                    </>
                  ) : !evidenceVerified ? (
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
                      <Pressable style={[s.btn, s.btnGray]} onPress={() => openDismissModal(item.id)}>
                        <Text style={s.btnText}>Dismiss</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable style={[s.btn, s.btnGreen]} onPress={() => handleOpenTicketModal(item)}>
                        <Text style={s.btnText}>Issue Ticket</Text>
                      </Pressable>
                      <Pressable style={[s.btn, s.btnGray]} onPress={() => openDismissModal(item.id)}>
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

      {/* Ticket issuance modal */}
      <AppModal
        visible={ticketModal !== null}
        onClose={closeTicketModal}
        title="Issue Ticket"
        closeLabel="Cancel"
        footer={
          <Button
            label="Issue Ticket"
            onPress={submitTicket}
            loading={modalLoading}
            disabled={ticketModal?.loadingPreview}
            style={s.flex1}
          />
        }
      >
        <View style={s.modalFields}>
          {ticketModal?.loadingPreview ? (
            <View style={s.penaltyLoading}>
              <ActivityIndicator color="#7c3aed" />
              <Text style={s.penaltyLoadingText}>Loading penalty details...</Text>
            </View>
          ) : ticketModal?.penalty ? (
            <View style={s.penaltyBox}>
              <Text style={s.penaltyTitle}>Penalty Preview</Text>
              <View style={s.penaltyRow}>
                <Text style={s.penaltyKey}>Offense</Text>
                <Text style={s.penaltyVal}>#{ticketModal.penalty.offenseNumber} — {ticketModal.penalty.offenseTierLabel}</Text>
              </View>
              <View style={s.penaltyRow}>
                <Text style={s.penaltyKey}>Prior Tickets</Text>
                <Text style={s.penaltyVal}>{ticketModal.penalty.priorTicketCount} ({ticketModal.penalty.priorUnpaidTicketCount} unpaid)</Text>
              </View>
              {ticketModal.penalty.carriedForwardPenaltyAmount > 0 && (
                <View style={s.penaltyRow}>
                  <Text style={s.penaltyKey}>Carried Forward</Text>
                  <Text style={s.penaltyVal}>₱{ticketModal.penalty.carriedForwardPenaltyAmount.toFixed(2)}</Text>
                </View>
              )}
              <View style={[s.penaltyRow, s.penaltyTotal]}>
                <Text style={s.penaltyTotalKey}>Total Amount</Text>
                <Text style={s.penaltyTotalVal}>₱{ticketModal.penalty.currentPenaltyAmount.toFixed(2)}</Text>
              </View>
            </View>
          ) : null}

          <View>
            <Text style={s.modalLabel}>Ticket Number *</Text>
            <TextInput
              style={s.modalInput}
              value={inputValue}
              onChangeText={setInputValue}
              placeholder="e.g. TKT-2024-001"
              placeholderTextColor="#94a3b8"
              autoFocus
            />
          </View>

          <View>
            <Text style={s.modalLabel}>Remarks (optional)</Text>
            <TextInput
              style={[s.modalInput, s.modalInputMulti]}
              value={remarksValue}
              onChangeText={setRemarksValue}
              placeholder="Additional notes..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>
      </AppModal>

      {/* Dismiss modal */}
      <AppModal
        visible={modalMode === 'dismiss'}
        onClose={closeDismissModal}
        title="Dismiss Incident"
        closeLabel="Cancel"
        footer={
          <Button
            label="Dismiss"
            variant="danger"
            onPress={submitDismiss}
            loading={modalLoading}
            style={s.flex1}
          />
        }
      >
        <Text style={s.modalLabel}>Reason for dismissal *</Text>
        <TextInput
          style={[s.modalInput, s.modalInputMulti]}
          value={inputValue}
          onChangeText={setInputValue}
          placeholder="Enter reason..."
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          autoFocus
        />
      </AppModal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  searchRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#e2e8f0' },
  tabActive: { backgroundColor: '#0f172a' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#fff' },

  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    elevation: 1,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  type: { fontWeight: '700', color: '#0f172a', fontSize: 14, flex: 1, marginRight: 8 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  desc: { color: '#64748b', fontSize: 13 },
  meta: { color: '#94a3b8', fontSize: 12 },
  plate: { fontWeight: '800', color: '#0f172a', letterSpacing: 1, fontSize: 13 },

  evidenceRow: { paddingVertical: 2 },
  evidenceMeta: { color: '#64748b', fontSize: 12, fontStyle: 'italic' },
  evidenceList: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 10, gap: 6 },
  evidenceEmpty: { color: '#94a3b8', fontSize: 12, textAlign: 'center' },
  evidenceItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  evidenceFileName: { fontSize: 12, color: '#374151', flex: 1, marginRight: 8 },
  evidenceStatus: { fontSize: 11, fontWeight: '600' },

  ticketIssuedBox: { backgroundColor: '#ede9fe', borderRadius: 8, padding: 10, gap: 2 },
  ticketIssuedLabel: { fontSize: 13, fontWeight: '700', color: '#7c3aed' },
  ticketIssuedAmount: { fontSize: 16, fontWeight: '800', color: '#5b21b6' },
  ticketIssuedNote: { fontSize: 11, color: '#7c3aed' },

  noEvidenceBox: { backgroundColor: '#fef3c7', borderRadius: 8, padding: 8, justifyContent: 'center' },
  noEvidenceText: { fontSize: 11, color: '#92400e' },

  btnRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btn: { flex: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, alignItems: 'center' },
  btnBlue: { backgroundColor: '#2563eb' },
  btnGreen: { backgroundColor: '#16a34a' },
  btnGray: { backgroundColor: '#64748b' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  modal: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  closeBtn: { padding: 4 },
  closeBtnText: { color: '#3b82f6', fontSize: 15 },
  modalBody: { padding: 16 },

  penaltyLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  penaltyLoadingText: { color: '#7c3aed', fontSize: 14 },
  penaltyBox: { backgroundColor: '#ede9fe', borderRadius: 12, padding: 14, gap: 8 },
  penaltyTitle: { fontSize: 13, fontWeight: '700', color: '#5b21b6', marginBottom: 2 },
  penaltyRow: { flexDirection: 'row', justifyContent: 'space-between' },
  penaltyKey: { fontSize: 13, color: '#6d28d9' },
  penaltyVal: { fontSize: 13, fontWeight: '600', color: '#3b0764' },
  penaltyTotal: { paddingTop: 8, borderTopWidth: 1, borderTopColor: '#c4b5fd', marginTop: 4 },
  penaltyTotalKey: { fontSize: 14, fontWeight: '700', color: '#5b21b6' },
  penaltyTotalVal: { fontSize: 18, fontWeight: '800', color: '#5b21b6' },

  flex1: { flex: 1 },
  modalFields: { gap: 16 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#fff',
    minHeight: 50,
  },
  modalInputMulti: { minHeight: 90 },
  modalSubmitBtn: { backgroundColor: '#16a34a', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4 },
  modalSubmitDismiss: { backgroundColor: '#64748b' },
  modalSubmitDisabled: { opacity: 0.6 },
  modalSubmitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
