import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GradientHeader from '@/ui/GradientHeader';
import {
  fetchPermits,
  createPermit,
  updatePermit,
  setPermitStatus,
  renewPermit,
  issuePermitQr,
} from '@/services/permits';
import { PERMIT_VEHICLE_TYPES } from '@/types/permits';
import type { Permit, DriverAccountResult } from '@/types/permits';
import type { VehicleLookup } from '@/types/fare';
import { colors, radii, shadow } from '@/ui/theme';
import Card from '@/ui/Card';
import Badge from '@/ui/Badge';
import Button from '@/ui/Button';
import SearchBar from '@/ui/SearchBar';
import FilterChips from '@/ui/FilterChips';
import { useFeedback } from '@/ui/FeedbackProvider';
import RowActions from '@/ui/RowActions';
import AppModal from '@/ui/AppModal';
import VehiclePickerField from '@/components/VehiclePickerField';
import { ListSkeleton } from '@/ui/Skeleton';

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Expired', value: 'EXPIRED' },
  { label: 'Suspended', value: 'SUSPENDED' },
  { label: 'Revoked', value: 'REVOKED' },
];

const TYPE_OPTIONS = [
  { label: 'All Types', value: '' },
  { label: 'Tricycle', value: 'TRICYCLE' },
  { label: 'Habal-habal', value: 'HABAL_HABAL' },
];

const EMPTY_FORM = {
  permitPlateNumber: '',
  driverFullName: '',
  vehicleType: 'TRICYCLE' as string,
  remarks: '',
};

export default function PermitsScreen() {
  const { showSuccess, showError, showConfirm } = useFeedback();
  const [permits, setPermits] = useState<Permit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Form modal (add / edit)
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleLookup | null>(null);
  const [formStatus, setFormStatus] = useState('ACTIVE');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // QR view modal
  const [qrPermit, setQrPermit] = useState<Permit | null>(null);

  // One-time driver credentials shown after a permit is created
  const [newDriverAccount, setNewDriverAccount] = useState<DriverAccountResult | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchPermits({
        status: statusFilter || undefined,
        vehicleType: typeFilter || undefined,
      });
      setPermits(data);
    } catch {
      // swallow — list simply stays as-is; pull-to-refresh retries
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return permits;
    return permits.filter(
      (p) =>
        p.permitPlateNumber.toLowerCase().includes(q) ||
        p.driverFullName.toLowerCase().includes(q) ||
        (p.vehicle?.plateNumber.toLowerCase().includes(q) ?? false),
    );
  }, [permits, search]);

  // ── Form ──
  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSelectedVehicle(null);
    setFormStatus('ACTIVE');
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (p: Permit) => {
    setEditingId(p.id);
    setForm({
      permitPlateNumber: p.permitPlateNumber,
      driverFullName: p.driverFullName,
      vehicleType: p.vehicleType,
      remarks: p.remarks ?? '',
    });
    setSelectedVehicle(null);
    setFormStatus(p.status);
    setFormError('');
    setShowForm(true);
  };

  const onPickVehicle = (v: VehicleLookup) => {
    setSelectedVehicle(v);
    const vt = (v.vehicleType ?? '').toUpperCase();
    setForm((f) => ({
      ...f,
      vehicleType: PERMIT_VEHICLE_TYPES.includes(vt as never) ? vt : f.vehicleType,
    }));
  };

  const submitForm = async () => {
    if (!form.permitPlateNumber.trim()) return setFormError('Permit plate number is required.');
    if (!form.driverFullName.trim()) return setFormError('Driver name is required.');

    setFormLoading(true);
    setFormError('');
    try {
      if (editingId) {
        await updatePermit(editingId, {
          permitPlateNumber: form.permitPlateNumber.trim().toUpperCase(),
          driverFullName: form.driverFullName.trim(),
          status: formStatus,
          remarks: form.remarks.trim() || undefined,
        });
      } else {
        if (!selectedVehicle?.id) {
          setFormLoading(false);
          return setFormError('Select the vehicle this permit belongs to.');
        }
        const res = await createPermit({
          vehicleId: selectedVehicle.id,
          permitPlateNumber: form.permitPlateNumber.trim().toUpperCase(),
          driverFullName: form.driverFullName.trim(),
          vehicleType: form.vehicleType,
          remarks: form.remarks.trim() || undefined,
        });
        if (res.driverAccount) setNewDriverAccount(res.driverAccount);
      }
      setShowForm(false);
      await load();
      showSuccess(editingId ? 'Permit updated.' : 'Permit created.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save permit.');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Row actions ──
  const runAction = async (id: string, fn: () => Promise<unknown>, successMsg: string) => {
    setBusyId(id);
    try {
      await fn();
      await load();
      showSuccess(successMsg, { title: 'Done' });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  };

  const onRenew = (p: Permit) =>
    showConfirm({
      title: 'Renew Permit',
      message: `Extend ${p.permitPlateNumber} by one year?`,
      confirmLabel: 'Renew',
      onConfirm: () => runAction(p.id, () => renewPermit(p.id), 'Permit renewed.'),
    });

  const onSuspend = (p: Permit) =>
    showConfirm({
      title: 'Suspend Permit',
      message: `Suspend ${p.permitPlateNumber}?`,
      confirmLabel: 'Suspend',
      destructive: true,
      onConfirm: () => runAction(p.id, () => setPermitStatus(p.id, 'SUSPENDED'), 'Permit suspended.'),
    });

  const onActivate = (p: Permit) =>
    runAction(p.id, () => setPermitStatus(p.id, 'ACTIVE'), 'Permit activated.');

  const onIssueOrRotateQr = (p: Permit) => {
    const rotating = p.hasQrToken;
    const go = () =>
      runAction(
        p.id,
        async () => {
          const res = await issuePermitQr(p.id);
          setQrPermit(res.permit);
        },
        rotating ? 'QR code rotated.' : 'QR code issued.',
      );
    if (rotating) {
      showConfirm({
        title: 'Rotate QR',
        message: 'The current QR code will stop working. Continue?',
        confirmLabel: 'Rotate',
        destructive: true,
        onConfirm: go,
      });
    } else {
      void go();
    }
  };

  if (loading) {
    return (
      <View style={s.container}>
        <GradientHeader title="Permit Management" />
        <ListSkeleton count={3} variant="complex" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <GradientHeader
        title="Permit Management"
        right={
          <TouchableOpacity style={s.headerAddBtn} onPress={openAdd}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        }
      />
      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View style={s.headerBlock}>
            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder="Search permit, vehicle plate, driver…"
            />
            <View style={s.filters}>
              <FilterChips options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
              <FilterChips options={TYPE_OPTIONS} value={typeFilter} onChange={setTypeFilter} />
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={s.empty}>No permits found.</Text>}
        renderItem={({ item }) => {
          const isActive = item.status.toUpperCase() === 'ACTIVE';
          const busy = busyId === item.id;
          return (
            <Card>
              <View style={s.cardTop}>
                <Text style={s.plate}>{item.permitPlateNumber}</Text>
                <Badge label={item.status} />
              </View>
              <Text style={s.driver}>{item.driverFullName}</Text>
              <Text style={s.meta}>
                {item.vehicleType.replace(/_/g, ' ')}
                {item.vehicle ? ` · ${item.vehicle.plateNumber}` : ''} · Expires{' '}
                {new Date(item.expiryDate).toLocaleDateString('en-PH')}
              </Text>
              <Text style={s.qrMeta}>{item.hasQrToken ? 'QR issued' : 'No QR issued'}</Text>

              {busy ? (
                <ActivityIndicator color={colors.primary} style={s.rowSpinner} />
              ) : (
                <RowActions>
                  <Button label="Edit" variant="secondary" size="sm" onPress={() => openEdit(item)} />
                  <Button label="Renew" variant="secondary" size="sm" onPress={() => onRenew(item)} />
                  {item.hasQrToken ? (
                    <Button
                      label="View QR"
                      variant="secondary"
                      size="sm"
                      onPress={() => setQrPermit(item)}
                    />
                  ) : null}
                  <Button
                    label={item.hasQrToken ? 'Rotate QR' : 'Issue QR'}
                    variant="secondary"
                    size="sm"
                    onPress={() => onIssueOrRotateQr(item)}
                  />
                  {isActive ? (
                    <Button label="Suspend" variant="danger" size="sm" onPress={() => onSuspend(item)} />
                  ) : (
                    <Button label="Activate" variant="success" size="sm" onPress={() => onActivate(item)} />
                  )}
                </RowActions>
              )}
            </Card>
          );
        }}
      />

      {/* Add / Edit form */}
      <AppModal
        visible={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? 'Edit Permit' : 'New Permit'}
        closeLabel="Cancel"
        footer={
          <Button
            label={editingId ? 'Save Changes' : 'Create Permit'}
            onPress={submitForm}
            loading={formLoading}
            style={s.flex1}
          />
        }
      >
        {!editingId ? (
          <VehiclePickerField
            selected={selectedVehicle}
            onSelect={onPickVehicle}
            onClear={() => setSelectedVehicle(null)}
          />
        ) : null}

        <Text style={s.fieldLabel}>Permit Plate Number *</Text>
        <TextInput
          style={s.input}
          value={form.permitPlateNumber}
          onChangeText={(v) => setForm((f) => ({ ...f, permitPlateNumber: v.toUpperCase() }))}
          placeholder="e.g. TRK 0421"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="characters"
        />

        <Text style={s.fieldLabel}>Driver Full Name *</Text>
        <TextInput
          style={s.input}
          value={form.driverFullName}
          onChangeText={(v) => setForm((f) => ({ ...f, driverFullName: v }))}
          placeholder="Full name"
          placeholderTextColor={colors.textFaint}
        />

        {!editingId ? (
          <>
            <Text style={s.fieldLabel}>Vehicle Type *</Text>
            <FilterChips
              options={PERMIT_VEHICLE_TYPES.map((t) => ({ label: t.replace(/_/g, ' '), value: t }))}
              value={form.vehicleType}
              onChange={(v) => setForm((f) => ({ ...f, vehicleType: v }))}
            />
          </>
        ) : (
          <>
            <Text style={s.fieldLabel}>Status</Text>
            <FilterChips
              options={STATUS_OPTIONS.filter((o) => o.value)}
              value={formStatus}
              onChange={setFormStatus}
            />
          </>
        )}

        <Text style={s.fieldLabel}>Remarks</Text>
        <TextInput
          style={[s.input, s.textArea]}
          value={form.remarks}
          onChangeText={(v) => setForm((f) => ({ ...f, remarks: v }))}
          placeholder="Optional notes"
          placeholderTextColor={colors.textFaint}
          multiline
        />

        {formError ? <Text style={s.error}>{formError}</Text> : null}
      </AppModal>

      {/* QR view */}
      <AppModal
        visible={qrPermit != null}
        onClose={() => setQrPermit(null)}
        title="Permit QR Token"
        variant="center"
      >
        {qrPermit ? (
          <View style={s.qrBody}>
            <Text style={s.qrPlate}>{qrPermit.permitPlateNumber}</Text>
            <Text style={s.qrLabel}>Scannable token</Text>
            <View style={s.tokenBox}>
              <Text selectable style={s.tokenText}>
                {qrPermit.qrToken ?? '—'}
              </Text>
            </View>
            {qrPermit.qrIssuedAt ? (
              <Text style={s.qrMeta}>
                Issued {new Date(qrPermit.qrIssuedAt).toLocaleString('en-PH')}
              </Text>
            ) : null}
            <Text style={s.qrHint}>
              This token is the payload encoded in the driver&apos;s QR. Use Rotate QR to invalidate
              and reissue it.
            </Text>
          </View>
        ) : null}
      </AppModal>

      {/* Driver account credentials (one-time) */}
      <AppModal
        visible={newDriverAccount != null}
        onClose={() => setNewDriverAccount(null)}
        title={newDriverAccount?.created ? 'Driver Account Created' : 'Driver Account'}
        variant="center"
      >
        {newDriverAccount ? (
          newDriverAccount.created ? (
            <View style={s.qrBody}>
              <Text style={s.credHint}>
                Share these one-time credentials with the driver. The temporary password is shown
                only now.
              </Text>
              <View style={s.credBox}>
                <Text style={s.credLabel}>Username</Text>
                <Text selectable style={s.credValue}>{newDriverAccount.username}</Text>
                <Text style={[s.credLabel, s.credLabelGap]}>Temporary password</Text>
                <Text selectable style={s.credValue}>{newDriverAccount.tempPassword}</Text>
              </View>
            </View>
          ) : (
            <View style={s.qrBody}>
              <Text style={s.credHint}>
                Username <Text style={s.credInline}>{newDriverAccount.username}</Text> already has a
                driver login. The permit was created without changing the existing account.
              </Text>
            </View>
          )
        ) : null}
      </AppModal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  list: { padding: 16, gap: 10 },
  headerBlock: { marginBottom: 8, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: '700', color: colors.textStrong },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filters: { gap: 8 },
  headerAddBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', color: colors.textFaint, marginTop: 40 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  plate: { fontSize: 16, fontWeight: '800', color: colors.textStrong, letterSpacing: 1 },
  driver: { fontSize: 14, color: colors.textBody, fontWeight: '600' },
  meta: { fontSize: 12, color: colors.textFaint, marginTop: 2 },
  qrMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  rowSpinner: { marginTop: 12, alignSelf: 'flex-start' },

  flex1: { flex: 1 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textBody, marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    fontSize: 15,
    color: colors.textStrong,
    backgroundColor: colors.surface,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: colors.danger, fontSize: 13, marginTop: 12 },

  qrBody: { alignItems: 'center', gap: 8, paddingVertical: 4 },
  qrPlate: { fontSize: 22, fontWeight: '800', color: colors.textStrong, letterSpacing: 2 },
  qrLabel: { fontSize: 11, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 1 },
  tokenBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    width: '100%',
    ...shadow.card,
  },
  tokenText: { fontSize: 13, color: colors.textStrong, fontFamily: 'monospace' },
  qrHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 18, marginTop: 4 },

  credHint: { fontSize: 13, color: colors.textBody, textAlign: 'center', lineHeight: 19 },
  credInline: { fontWeight: '800', color: colors.textStrong },
  credBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    width: '100%',
    ...shadow.card,
  },
  credLabel: { fontSize: 11, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 1 },
  credLabelGap: { marginTop: 12 },
  credValue: { fontSize: 16, color: colors.textStrong, fontFamily: 'monospace', marginTop: 2 },
});
