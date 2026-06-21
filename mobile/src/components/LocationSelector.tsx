import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { fetchActiveLocations } from '@/services/locations';
import type { Location } from '@/types/common';

export interface PinCoords {
  lat: number;
  lng: number;
  label: string;
}

interface Props {
  label: string;
  selected: PinCoords | null;
  onSelect: (pin: PinCoords) => void;
  onUseGPS: () => void;
}

export default function LocationSelector({ label, selected, onSelect, onUseGPS }: Props) {
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [filtered, setFiltered] = useState<Location[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchActiveLocations()
      .then((data) => {
        setLocations(data);
        setFiltered(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(q ? locations.filter((l) => l.name.toLowerCase().includes(q)) : locations);
  }, [search, locations]);

  const pick = (loc: Location) => {
    const [lat, lng] = loc.coordinates.split(',').map(Number);
    onSelect({ lat: lat ?? 0, lng: lng ?? 0, label: loc.name });
    setOpen(false);
    setSearch('');
  };

  return (
    <>
      <View style={s.container}>
        <Text style={s.label}>{label}</Text>
        <View style={s.row}>
          <Pressable
            style={({ pressed }) => [s.selector, pressed && s.selectorPressed]}
            onPress={() => setOpen(true)}
          >
            <Text style={selected ? s.selectedText : s.placeholder} numberOfLines={1}>
              {selected?.label ?? 'Select location'}
            </Text>
          </Pressable>
          <Pressable style={s.gpsBtn} onPress={onUseGPS}>
            <Text style={s.gpsBtnText}>GPS</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Select {label}</Text>
            <Pressable onPress={() => setOpen(false)} style={s.closeBtn}>
              <Text style={s.closeBtnText}>Cancel</Text>
            </Pressable>
          </View>
          <TextInput
            style={s.search}
            placeholder="Search locations..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            autoFocus
            clearButtonMode="while-editing"
          />
          {loading ? (
            <ActivityIndicator color="#16a34a" style={s.loadingSpinner} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              contentContainerStyle={s.modalList}
              ListEmptyComponent={<Text style={s.empty}>No locations found.</Text>}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [s.locationItem, pressed && s.locationItemPressed]}
                  onPress={() => pick(item)}
                >
                  <Text style={s.locationName}>{item.name}</Text>
                  {item.barangay ? <Text style={s.locationBarangay}>{item.barangay}</Text> : null}
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  selector: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#fff',
  },
  selectorPressed: { backgroundColor: '#f8fafc' },
  placeholder: { color: '#94a3b8', fontSize: 15 },
  selectedText: { color: '#0f172a', fontSize: 15, fontWeight: '500' },
  gpsBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    justifyContent: 'center',
  },
  gpsBtnText: { color: '#16a34a', fontWeight: '700', fontSize: 13 },
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
  search: {
    margin: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  loadingSpinner: { marginTop: 40 },
  modalList: { paddingHorizontal: 12, paddingBottom: 40 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  locationItem: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 6 },
  locationItemPressed: { backgroundColor: '#f0fdf4' },
  locationName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  locationBarangay: { fontSize: 12, color: '#64748b', marginTop: 2 },
});
