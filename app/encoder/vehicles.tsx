import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator,
  TouchableOpacity, Pressable, TextInput, type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GradientHeader from '@/ui/GradientHeader';
import { api } from '@/services/api';
import { setVehicleActive } from '@/services/vehicles';
import { colors, radii } from '@/ui/theme';
import Card from '@/ui/Card';
import Badge from '@/ui/Badge';
import Button from '@/ui/Button';
import SearchBar from '@/ui/SearchBar';
import FilterChips from '@/ui/FilterChips';
import { useFeedback } from '@/ui/FeedbackProvider';
import AppModal from '@/ui/AppModal';
import { StatGridSkeleton, ListSkeleton } from '@/ui/Skeleton';

interface VehiclePermit {
  permitPlateNumber: string;
  status: string;
  expiryDate: string;
}

interface Vehicle {
  id: string;
  plateNumber: string;
  vehicleType: string;
  make: string;
  model: string;
  year: number;
  color?: string;
  capacity?: number;
  ownerName: string;
  ownerContact?: string;
  driverName?: string | null;
  driverLicense?: string | null;
  registrationExpiry?: string;
  isActive: boolean;
  permit?: VehiclePermit | null;
}

const VEHICLE_TYPES = ['JEEPNEY', 'TRICYCLE', 'HABAL_HABAL', 'MULTICAB', 'BUS', 'VAN'] as const;
type VehicleType = typeof VEHICLE_TYPES[number];

const TYPE_OPTIONS = [{ label: 'All Types', value: '' }, ...VEHICLE_TYPES.map((t) => ({ label: t.replace(/_/g, ' '), value: t }))];
const ACTIVE_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

const EMPTY_FORM = {
  plateNumber: '',
  vehicleType: 'JEEPNEY' as VehicleType,
  make: '',
  model: '',
  year: '',
  color: '',
  capacity: '',
  ownerName: '',
  ownerContact: '',
  registrationExpiry: '',
  driverName: '',
  driverLicense: '',
};

export default function VehiclesScreen() {
  const { showSuccess, showError, showConfirm } = useFeedback();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const [detail, setDetail] = useState<Vehicle | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const load = async () => {
    try {
      const data = await api.get<{ vehicles: Vehicle[] }>('/api/vehicles');
      setVehicles(data.vehicles ?? []);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return vehicles.filter((v) => {
      if (typeFilter && v.vehicleType !== typeFilter) return false;
      if (activeFilter === 'active' && !v.isActive) return false;
      if (activeFilter === 'inactive' && v.isActive) return false;
      if (!q) return true;
      return (
        v.plateNumber.toLowerCase().includes(q) ||
        v.ownerName.toLowerCase().includes(q) ||
        v.make.toLowerCase().includes(q)
      );
    });
  }, [vehicles, search, typeFilter, activeFilter]);

  const stats = useMemo(() => ({
    total: vehicles.length,
    active: vehicles.filter((v) => v.isActive).length,
    withPermit: vehicles.filter((v) => v.permit).length,
  }), [vehicles]);

  const openAdd = () => { setForm(EMPTY_FORM); setAddError(''); setShowAdd(true); };

  const submitAdd = async () => {
    const required = ['plateNumber', 'make', 'model', 'year', 'color', 'capacity', 'ownerName', 'ownerContact', 'registrationExpiry'] as const;
    for (const field of required) {
      if (!form[field].trim()) {
        setAddError(`${field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())} is required.`);
        return;
      }
    }
    setAddLoading(true);
    setAddError('');
    try {
      await api.post('/api/vehicles', {
        plateNumber: form.plateNumber.trim().toUpperCase(),
        vehicleType: form.vehicleType,
        make: form.make.trim(),
        model: form.model.trim(),
        year: form.year.trim(),
        color: form.color.trim(),
        capacity: form.capacity.trim(),
        ownerName: form.ownerName.trim(),
        ownerContact: form.ownerContact.trim(),
        registrationExpiry: form.registrationExpiry.trim(),
        driverName: form.driverName.trim() || undefined,
        driverLicense: form.driverLicense.trim() || undefined,
      });
      setShowAdd(false);
      await load();
      showSuccess('Vehicle registered successfully.');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to register vehicle.');
    } finally {
      setAddLoading(false);
    }
  };

  const toggleActive = (v: Vehicle) => {
    const next = !v.isActive;
    const apply = async () => {
      setStatusBusy(true);
      try {
        await setVehicleActive(v.id, next);
        setDetail((d) => (d ? { ...d, isActive: next } : d));
        await load();
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Failed to update vehicle.');
      } finally {
        setStatusBusy(false);
      }
    };
    if (next) void apply();
    else
      showConfirm({
        title: 'Deactivate Vehicle',
        message: `Deactivate ${v.plateNumber}?`,
        confirmLabel: 'Deactivate',
        destructive: true,
        onConfirm: apply,
      });
  };

  if (loading) {
    return (
      <View style={s.container}>
        <GradientHeader title="Vehicle Registry" />
        <StatGridSkeleton count={3} />
        <ListSkeleton count={4} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <GradientHeader
        title="Vehicle Registry"
        right={
          <TouchableOpacity style={s.headerAddBtn} onPress={openAdd}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        }
      />
      <FlatList
        data={filtered}
        keyExtractor={(v) => v.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View style={s.headerBlock}>
            <View style={s.statsRow}>
              <Stat label="Total" value={stats.total} />
              <Stat label="Active" value={stats.active} tint={colors.primary} />
              <Stat label="With Permit" value={stats.withPermit} tint={colors.info} />
            </View>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search plate, owner, make…" />
            <View style={s.filters}>
              <FilterChips options={TYPE_OPTIONS} value={typeFilter} onChange={setTypeFilter} />
              <FilterChips options={ACTIVE_OPTIONS} value={activeFilter} onChange={setActiveFilter} />
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={s.empty}>No vehicles found.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => setDetail(item)}>
            <Card>
              <View style={s.row}>
                <Text style={s.plate}>{item.plateNumber}</Text>
                <Badge label={item.isActive ? 'ACTIVE' : 'INACTIVE'} />
              </View>
              <Text style={s.vehicle}>{item.year} {item.make} {item.model}</Text>
              <Text style={s.owner}>
                {item.vehicleType.replace(/_/g, ' ')} · {item.ownerName}
                {item.permit ? ` · Permit ${item.permit.permitPlateNumber}` : ' · No permit'}
              </Text>
            </Card>
          </Pressable>
        )}
      />

      {/* Detail modal */}
      <AppModal
        visible={detail != null}
        onClose={() => setDetail(null)}
        title="Vehicle Details"
        variant="center"
        footer={detail ? (
          <Button
            label={detail.isActive ? 'Deactivate' : 'Activate'}
            variant={detail.isActive ? 'danger' : 'success'}
            loading={statusBusy}
            onPress={() => toggleActive(detail)}
            style={s.flex1}
          />
        ) : undefined}
      >
        {detail ? (
          <View style={s.detailBody}>
            <View style={s.row}>
              <Text style={s.plate}>{detail.plateNumber}</Text>
              <Badge label={detail.isActive ? 'ACTIVE' : 'INACTIVE'} />
            </View>
            <DetailRow label="Type" value={detail.vehicleType.replace(/_/g, ' ')} />
            <DetailRow label="Vehicle" value={`${detail.year} ${detail.make} ${detail.model}`} />
            {detail.color ? <DetailRow label="Color" value={detail.color} /> : null}
            {detail.capacity != null ? <DetailRow label="Capacity" value={`${detail.capacity} seats`} /> : null}
            <DetailRow label="Owner" value={detail.ownerName} />
            {detail.ownerContact ? <DetailRow label="Contact" value={detail.ownerContact} /> : null}
            {detail.driverName ? <DetailRow label="Driver" value={detail.driverName} /> : null}
            {detail.driverLicense ? <DetailRow label="License" value={detail.driverLicense} /> : null}
            {detail.registrationExpiry ? (
              <DetailRow label="Registration" value={new Date(detail.registrationExpiry).toLocaleDateString('en-PH')} />
            ) : null}
            <DetailRow
              label="Permit"
              value={detail.permit ? `${detail.permit.permitPlateNumber} (${detail.permit.status})` : 'None'}
            />
          </View>
        ) : null}
      </AppModal>

      {/* Add modal */}
      <AppModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        title="Register Vehicle"
        closeLabel="Cancel"
        footer={<Button label="Register Vehicle" onPress={submitAdd} loading={addLoading} style={s.flex1} />}
      >
        <Text style={s.fieldLabel}>Plate Number *</Text>
        <Field value={form.plateNumber} onChangeText={(v) => setForm((f) => ({ ...f, plateNumber: v.toUpperCase() }))} placeholder="e.g. ABC 123" autoCapitalize="characters" />

        <Text style={s.fieldLabel}>Vehicle Type *</Text>
        <FilterChips
          options={VEHICLE_TYPES.map((t) => ({ label: t.replace(/_/g, ' '), value: t }))}
          value={form.vehicleType}
          onChange={(v) => setForm((f) => ({ ...f, vehicleType: v as VehicleType }))}
        />

        <Text style={s.fieldLabel}>Make *</Text>
        <Field value={form.make} onChangeText={(v) => setForm((f) => ({ ...f, make: v }))} placeholder="e.g. Toyota" />
        <Text style={s.fieldLabel}>Model *</Text>
        <Field value={form.model} onChangeText={(v) => setForm((f) => ({ ...f, model: v }))} placeholder="e.g. Hi-Ace" />
        <Text style={s.fieldLabel}>Year *</Text>
        <Field value={form.year} onChangeText={(v) => setForm((f) => ({ ...f, year: v }))} placeholder="e.g. 2022" keyboardType="numeric" maxLength={4} />
        <Text style={s.fieldLabel}>Color *</Text>
        <Field value={form.color} onChangeText={(v) => setForm((f) => ({ ...f, color: v }))} placeholder="e.g. Yellow" />
        <Text style={s.fieldLabel}>Capacity (seats) *</Text>
        <Field value={form.capacity} onChangeText={(v) => setForm((f) => ({ ...f, capacity: v }))} placeholder="e.g. 16" keyboardType="numeric" />
        <Text style={s.fieldLabel}>Owner Name *</Text>
        <Field value={form.ownerName} onChangeText={(v) => setForm((f) => ({ ...f, ownerName: v }))} placeholder="Full name" />
        <Text style={s.fieldLabel}>Owner Contact *</Text>
        <Field value={form.ownerContact} onChangeText={(v) => setForm((f) => ({ ...f, ownerContact: v }))} placeholder="+63 9xx xxx xxxx" keyboardType="phone-pad" />
        <Text style={s.fieldLabel}>Registration Expiry * (YYYY-MM-DD)</Text>
        <Field value={form.registrationExpiry} onChangeText={(v) => setForm((f) => ({ ...f, registrationExpiry: v }))} placeholder="e.g. 2025-12-31" />

        <Text style={s.sectionLabel}>Driver Info (optional)</Text>
        <Text style={s.fieldLabel}>Driver Name</Text>
        <Field value={form.driverName} onChangeText={(v) => setForm((f) => ({ ...f, driverName: v }))} placeholder="Full name" />
        <Text style={s.fieldLabel}>Driver License No.</Text>
        <Field value={form.driverLicense} onChangeText={(v) => setForm((f) => ({ ...f, driverLicense: v }))} placeholder="License number" />

        {addError ? <Text style={s.error}>{addError}</Text> : null}
      </AppModal>
    </View>
  );
}

function Stat({ label, value, tint }: { label: string; value: number; tint?: string }) {
  return (
    <View style={s.stat}>
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

function Field(props: TextInputProps) {
  return <TextInput style={s.input} placeholderTextColor={colors.textFaint} {...props} />;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  list: { padding: 16, gap: 10 },
  headerBlock: { marginBottom: 8, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: '700', color: colors.textStrong },
  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  headerAddBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.md, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.textStrong },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  filters: { gap: 8 },
  empty: { textAlign: 'center', color: colors.textFaint, marginTop: 40 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  plate: { fontSize: 16, fontWeight: '800', color: colors.textStrong, letterSpacing: 1 },
  vehicle: { fontSize: 14, color: colors.textBody, fontWeight: '600' },
  owner: { fontSize: 12, color: colors.textFaint, marginTop: 2 },

  flex1: { flex: 1 },
  detailBody: { gap: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  detailLabel: { fontSize: 13, color: colors.textMuted },
  detailValue: { fontSize: 13, color: colors.textStrong, fontWeight: '600', flexShrink: 1, textAlign: 'right' },

  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.textStrong, marginTop: 24, marginBottom: 4, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textBody, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 14, fontSize: 15, color: colors.textStrong, backgroundColor: colors.surface },
  error: { color: colors.danger, fontSize: 13, marginTop: 12 },
});
