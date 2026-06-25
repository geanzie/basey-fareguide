import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TextInput,
  ScrollView,
} from 'react-native';
import { api } from '@/services/api';
import GradientHeader from '@/ui/GradientHeader';
import { colors, radii, spacing } from '@/ui/theme';
import Card from '@/ui/Card';
import Badge from '@/ui/Badge';
import Button from '@/ui/Button';
import SearchBar from '@/ui/SearchBar';
import FilterChips from '@/ui/FilterChips';
import AppModal from '@/ui/AppModal';
import { ListSkeleton } from '@/ui/Skeleton';
import { useFeedback } from '@/ui/FeedbackProvider';

interface TicketedIncident {
  id: string;
  ticketNumber: string | null;
  incidentType?: string;
  type?: string;
  plateNumber?: string | null;
  location: string;
  incidentDate: string;
  description?: string;
  penaltyAmount?: number | null;
  paymentStatus?: string | null;
  officialReceiptNumber?: string | null;
  paidAt?: string | null;
  remarks?: string | null;
  status: string;
}

type PaymentFilter = 'ALL' | 'UNPAID' | 'PAID';

const PAYMENT_FILTER_OPTIONS: { label: string; value: PaymentFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Unpaid', value: 'UNPAID' },
  { label: 'Paid', value: 'PAID' },
];

export default function EncoderTicketPaymentsScreen() {
  const { showSuccess, showError, showWarning } = useFeedback();
  const [incidents, setIncidents] = useState<TicketedIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('UNPAID');

  const [selected, setSelected] = useState<TicketedIncident | null>(null);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ incidents: TicketedIncident[] }>(
        '/api/incidents?limit=200',
      );
      setIncidents((res.incidents ?? []).filter((i) => Boolean(i.ticketNumber)));
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

  const stats = useMemo(() => {
    const unpaid = incidents.filter((i) => i.paymentStatus === 'UNPAID');
    const paid = incidents.filter((i) => i.paymentStatus === 'PAID');
    const outstanding = unpaid.reduce((sum, i) => sum + (i.penaltyAmount ?? 0), 0);
    return { total: incidents.length, unpaid: unpaid.length, paid: paid.length, outstanding };
  }, [incidents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return incidents.filter((i) => {
      const ps = i.paymentStatus ?? 'UNPAID';
      if (paymentFilter === 'UNPAID' && ps !== 'UNPAID') return false;
      if (paymentFilter === 'PAID' && ps !== 'PAID') return false;
      if (!q) return true;
      const type = (i.incidentType ?? i.type ?? '').toLowerCase();
      return (
        (i.ticketNumber ?? '').toLowerCase().includes(q) ||
        (i.officialReceiptNumber ?? '').toLowerCase().includes(q) ||
        (i.plateNumber ?? '').toLowerCase().includes(q) ||
        i.location.toLowerCase().includes(q) ||
        type.includes(q)
      );
    });
  }, [incidents, paymentFilter, search]);

  const openDetails = (item: TicketedIncident) => {
    setSelected(item);
    setReceiptNumber(item.officialReceiptNumber ?? '');
    setPaymentRemarks(item.remarks ?? '');
  };

  const closeDetails = () => {
    setSelected(null);
    setReceiptNumber('');
    setPaymentRemarks('');
  };

  const submitPayment = async () => {
    if (!selected) return;
    if (!receiptNumber.trim()) {
      showWarning('Official receipt number is required.', { title: 'Required' });
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/api/incidents/${selected.id}/payment`, {
        officialReceiptNumber: receiptNumber.trim(),
        remarks: paymentRemarks.trim() || undefined,
      });
      closeDetails();
      await load();
      showSuccess('Ticket payment recorded. Incident marked as resolved.', { title: 'Recorded' });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to record payment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={s.container}>
        <GradientHeader title="Ticket Payments" />
        <ListSkeleton count={4} />
      </View>
    );
  }

  const typeLabel = (item: TicketedIncident) =>
    (item.incidentType ?? item.type ?? '').replace(/_/g, ' ');

  return (
    <View style={s.container}>
      <GradientHeader title="Ticket Payments" />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View style={s.headerBlock}>
            {/* Stats row */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.statsScroll}>
              <View style={s.statsRow}>
                <StatBox label="Total" value={stats.total} />
                <StatBox label="Unpaid" value={stats.unpaid} tint={colors.warning} />
                <StatBox label="Paid" value={stats.paid} tint={colors.primary} />
                <StatBox label="Outstanding" value={`₱${stats.outstanding.toLocaleString('en-PH')}`} tint={colors.danger} wide />
              </View>
            </ScrollView>

            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder="Search ticket #, receipt, plate, location…"
            />
            <FilterChips
              options={PAYMENT_FILTER_OPTIONS}
              value={paymentFilter}
              onChange={(v) => setPaymentFilter(v as PaymentFilter)}
            />
          </View>
        }
        ListEmptyComponent={
          <Text style={s.empty}>
            {search || paymentFilter !== 'ALL'
              ? 'No tickets match current filters.'
              : 'No ticketed incidents found.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={s.cardTop}>
              <Text style={s.ticketNum}>#{item.ticketNumber}</Text>
              <Badge label={item.paymentStatus ?? 'UNPAID'} />
            </View>
            <Text style={s.cardType}>{typeLabel(item)}</Text>
            <Text style={s.cardMeta}>{item.location} · {new Date(item.incidentDate).toLocaleDateString('en-PH')}</Text>
            {item.plateNumber ? <Text style={s.plate}>{item.plateNumber}</Text> : null}
            {item.penaltyAmount != null && (
              <Text style={s.penalty}>₱{Number(item.penaltyAmount).toLocaleString('en-PH')}</Text>
            )}
            <View style={s.btnRow}>
              <Button
                label="View Details"
                variant="secondary"
                size="sm"
                onPress={() => openDetails(item)}
                style={s.actionBtn}
              />
            </View>
          </Card>
        )}
      />

      {/* Details + payment modal */}
      <AppModal
        visible={selected != null}
        onClose={closeDetails}
        title="Ticket Payment Details"
        closeLabel="Close"
        footer={
          selected?.paymentStatus === 'UNPAID' ? (
            <Button
              label="Record Payment"
              onPress={submitPayment}
              loading={submitting}
              style={s.flex1}
            />
          ) : undefined
        }
      >
        {selected ? (
          <View style={s.detailBody}>
            <DetailRow label="Ticket Number" value={`#${selected.ticketNumber ?? '—'}`} />
            <DetailRow label="Violation" value={typeLabel(selected)} />
            <DetailRow label="Plate Number" value={selected.plateNumber ?? '—'} />
            <DetailRow label="Location" value={selected.location} />
            <DetailRow label="Date" value={new Date(selected.incidentDate).toLocaleDateString('en-PH')} />
            <DetailRow label="Penalty" value={selected.penaltyAmount != null ? `₱${Number(selected.penaltyAmount).toLocaleString('en-PH')}` : '—'} />
            <DetailRow label="Payment Status" value={selected.paymentStatus ?? 'UNPAID'} />
            {selected.officialReceiptNumber
              ? <DetailRow label="Official Receipt" value={selected.officialReceiptNumber} />
              : null}
            {selected.paidAt
              ? <DetailRow label="Paid At" value={new Date(selected.paidAt).toLocaleString('en-PH')} />
              : null}
            {selected.description ? (
              <View style={s.descBlock}>
                <Text style={s.detailLabel}>Description</Text>
                <Text style={s.descText}>{selected.description}</Text>
              </View>
            ) : null}

            {selected.paymentStatus === 'UNPAID' && (
              <View style={s.paymentForm}>
                <Text style={s.formSectionLabel}>Record Payment</Text>

                <Text style={s.fieldLabel}>Official Receipt Number *</Text>
                <TextInput
                  style={s.input}
                  value={receiptNumber}
                  onChangeText={setReceiptNumber}
                  placeholder="e.g. OR-2024-001234"
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="characters"
                />

                <Text style={s.fieldLabel}>Receipt Notes (optional)</Text>
                <TextInput
                  style={[s.input, s.inputMulti]}
                  value={paymentRemarks}
                  onChangeText={setPaymentRemarks}
                  placeholder="Optional notes…"
                  placeholderTextColor={colors.textFaint}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            )}
          </View>
        ) : null}
      </AppModal>
    </View>
  );
}

function StatBox({ label, value, tint, wide }: { label: string; value: string | number; tint?: string; wide?: boolean }) {
  return (
    <View style={[s.statBox, wide && s.statBoxWide]}>
      <Text style={[s.statValue, tint ? { color: tint } : null]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, gap: 10 },

  headerBlock: { marginBottom: 8, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', color: colors.textStrong },

  statsScroll: { marginHorizontal: -4 },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 4, paddingVertical: 2 },
  statBox: { backgroundColor: colors.surface, borderRadius: radii.md, padding: 12, alignItems: 'center', minWidth: 72, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  statBoxWide: { minWidth: 110 },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.textStrong },
  statLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', marginTop: 2 },

  empty: { textAlign: 'center', color: colors.textFaint, marginTop: 40 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  ticketNum: { fontWeight: '800', color: colors.textStrong, fontSize: 15, letterSpacing: 0.5 },
  cardType: { color: colors.textBody, fontSize: 13, fontWeight: '600' },
  cardMeta: { color: colors.textFaint, fontSize: 12 },
  plate: { fontWeight: '800', color: colors.textStrong, letterSpacing: 1, fontSize: 13 },
  penalty: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  actionBtn: { alignSelf: 'flex-start' },

  flex1: { flex: 1 },

  detailBody: { gap: 0 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  detailLabel: { fontSize: 13, color: colors.textMuted, flexShrink: 0 },
  detailValue: { fontSize: 13, color: colors.textStrong, fontWeight: '600', textAlign: 'right', flex: 1 },
  descBlock: { paddingTop: 10, gap: 4 },
  descText: { fontSize: 13, color: colors.textBody, backgroundColor: colors.surfaceAlt, borderRadius: radii.sm, padding: 10, lineHeight: 18 },

  paymentForm: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border, gap: 0 },
  formSectionLabel: { fontSize: 15, fontWeight: '700', color: colors.textStrong, marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textBody, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 14, fontSize: 15, color: colors.textStrong, backgroundColor: colors.surface },
  inputMulti: { minHeight: 80, paddingTop: 12 },
});
