import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator,
  TextInput, TouchableOpacity, Modal, Pressable, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/services/api';

interface Vehicle {
  id: string;
  plateNumber: string;
  vehicleType: string;
  make: string;
  model: string;
  year: number;
  ownerName: string;
  isActive: boolean;
}

const VEHICLE_TYPES = ['JEEPNEY', 'TRICYCLE', 'HABAL_HABAL', 'MULTICAB', 'BUS', 'VAN'] as const;
type VehicleType = typeof VEHICLE_TYPES[number];

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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filtered, setFiltered] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const load = async () => {
    try {
      const data = await api.get<{ vehicles: Vehicle[] }>('/api/vehicles');
      setVehicles(data.vehicles ?? []);
      setFiltered(data.vehicles ?? []);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q
        ? vehicles.filter(
            (v) =>
              v.plateNumber.toLowerCase().includes(q) ||
              v.ownerName.toLowerCase().includes(q) ||
              v.make.toLowerCase().includes(q),
          )
        : vehicles,
    );
  }, [search, vehicles]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setAddError('');
    setShowAdd(true);
  };

  const closeAdd = () => {
    setShowAdd(false);
    setAddError('');
  };

  const submitAdd = async () => {
    const required = ['plateNumber', 'make', 'model', 'year', 'color', 'capacity', 'ownerName', 'ownerContact', 'registrationExpiry'] as const;
    for (const field of required) {
      if (!form[field].trim()) {
        setAddError(`${field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())} is required.`);
        return;
      }
    }
    setAddLoading(true);
    setAddError('');
    try {
      await api.post<Vehicle>('/api/vehicles', {
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
      closeAdd();
      await load();
      Alert.alert('Success', 'Vehicle registered successfully.');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to register vehicle.');
    } finally {
      setAddLoading(false);
    }
  };

  if (loading) {
    return <SafeAreaView style={s.center}><ActivityIndicator color="#16a34a" size="large" /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.container}>
      <FlatList
        data={filtered}
        keyExtractor={(v) => v.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View style={s.headerBlock}>
            <View style={s.headerRow}>
              <Text style={s.title}>Vehicle Registry</Text>
              <TouchableOpacity style={s.addBtn} onPress={openAdd}>
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={s.search}
              value={search}
              onChangeText={setSearch}
              placeholder="Search plate, owner, make..."
              placeholderTextColor="#94a3b8"
              clearButtonMode="while-editing"
            />
          </View>
        }
        ListEmptyComponent={<Text style={s.empty}>No vehicles found.</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.plate}>{item.plateNumber}</Text>
              <Text style={s.type}>{item.vehicleType.replace(/_/g, ' ')}</Text>
            </View>
            <Text style={s.vehicle}>{item.year} {item.make} {item.model}</Text>
            <Text style={s.owner}>{item.ownerName}</Text>
          </View>
        )}
      />

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeAdd}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Register Vehicle</Text>
            <Pressable onPress={closeAdd}><Text style={s.cancel}>Cancel</Text></Pressable>
          </View>
          <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLabel}>Plate Number *</Text>
            <TextInput
              style={s.input}
              value={form.plateNumber}
              onChangeText={(v) => setForm((f) => ({ ...f, plateNumber: v.toUpperCase() }))}
              placeholder="e.g. ABC 123"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
            />

            <Text style={s.fieldLabel}>Vehicle Type *</Text>
            <View style={s.typeGrid}>
              {VEHICLE_TYPES.map((t) => (
                <Pressable
                  key={t}
                  style={[s.typeChip, form.vehicleType === t && s.typeChipActive]}
                  onPress={() => setForm((f) => ({ ...f, vehicleType: t }))}
                >
                  <Text style={[s.typeChipText, form.vehicleType === t && s.typeChipTextActive]}>
                    {t.replace(/_/g, ' ')}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.fieldLabel}>Make *</Text>
            <TextInput
              style={s.input}
              value={form.make}
              onChangeText={(v) => setForm((f) => ({ ...f, make: v }))}
              placeholder="e.g. Toyota"
              placeholderTextColor="#94a3b8"
            />

            <Text style={s.fieldLabel}>Model *</Text>
            <TextInput
              style={s.input}
              value={form.model}
              onChangeText={(v) => setForm((f) => ({ ...f, model: v }))}
              placeholder="e.g. Hi-Ace"
              placeholderTextColor="#94a3b8"
            />

            <Text style={s.fieldLabel}>Year *</Text>
            <TextInput
              style={s.input}
              value={form.year}
              onChangeText={(v) => setForm((f) => ({ ...f, year: v }))}
              placeholder="e.g. 2022"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              maxLength={4}
            />

            <Text style={s.fieldLabel}>Color *</Text>
            <TextInput
              style={s.input}
              value={form.color}
              onChangeText={(v) => setForm((f) => ({ ...f, color: v }))}
              placeholder="e.g. Yellow"
              placeholderTextColor="#94a3b8"
            />

            <Text style={s.fieldLabel}>Capacity (seats) *</Text>
            <TextInput
              style={s.input}
              value={form.capacity}
              onChangeText={(v) => setForm((f) => ({ ...f, capacity: v }))}
              placeholder="e.g. 16"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
            />

            <Text style={s.fieldLabel}>Owner Name *</Text>
            <TextInput
              style={s.input}
              value={form.ownerName}
              onChangeText={(v) => setForm((f) => ({ ...f, ownerName: v }))}
              placeholder="Full name"
              placeholderTextColor="#94a3b8"
            />

            <Text style={s.fieldLabel}>Owner Contact *</Text>
            <TextInput
              style={s.input}
              value={form.ownerContact}
              onChangeText={(v) => setForm((f) => ({ ...f, ownerContact: v }))}
              placeholder="+63 9xx xxx xxxx"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
            />

            <Text style={s.fieldLabel}>Registration Expiry * (YYYY-MM-DD)</Text>
            <TextInput
              style={s.input}
              value={form.registrationExpiry}
              onChangeText={(v) => setForm((f) => ({ ...f, registrationExpiry: v }))}
              placeholder="e.g. 2025-12-31"
              placeholderTextColor="#94a3b8"
            />

            <Text style={s.sectionLabel}>Driver Info (optional)</Text>

            <Text style={s.fieldLabel}>Driver Name</Text>
            <TextInput
              style={s.input}
              value={form.driverName}
              onChangeText={(v) => setForm((f) => ({ ...f, driverName: v }))}
              placeholder="Full name"
              placeholderTextColor="#94a3b8"
            />

            <Text style={s.fieldLabel}>Driver License No.</Text>
            <TextInput
              style={s.input}
              value={form.driverLicense}
              onChangeText={(v) => setForm((f) => ({ ...f, driverLicense: v }))}
              placeholder="License number"
              placeholderTextColor="#94a3b8"
            />

            {addError ? <Text style={s.error}>{addError}</Text> : null}

            <Pressable
              style={[s.submitBtn, addLoading && s.submitDisabled]}
              onPress={submitAdd}
              disabled={addLoading}
            >
              {addLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitText}>Register Vehicle</Text>}
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
  headerBlock: { marginBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#16a34a', justifyContent: 'center', alignItems: 'center' },
  search: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 14, color: '#0f172a', backgroundColor: '#fff', marginBottom: 4 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  plate: { fontSize: 16, fontWeight: '800', color: '#0f172a', letterSpacing: 1 },
  type: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  vehicle: { fontSize: 14, color: '#374151', fontWeight: '600' },
  owner: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  modal: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  cancel: { color: '#3b82f6', fontSize: 15 },
  modalBody: { padding: 16 },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginTop: 24, marginBottom: 4, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 15, color: '#0f172a', backgroundColor: '#fff' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0' },
  typeChipActive: { backgroundColor: '#f0fdf4', borderColor: '#16a34a' },
  typeChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  typeChipTextActive: { color: '#16a34a' },
  error: { color: '#dc2626', fontSize: 13, marginTop: 12 },
  submitBtn: { marginTop: 24, backgroundColor: '#16a34a', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 40 },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
