import { useEffect, useState, useRef } from 'react';
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
import { searchVehicles } from '@/services/vehicles';
import type { VehicleLookup } from '@/types/fare';

interface Props {
  selected: VehicleLookup | null;
  onSelect: (vehicle: VehicleLookup) => void;
  onClear: () => void;
  /** When provided, controls the modal open state externally. */
  open?: boolean;
  onClose?: () => void;
  /** Hide the trigger button row (when parent controls open state). */
  hideTrigger?: boolean;
}

export default function VehiclePickerField({ selected, onSelect, onClear, open: externalOpen, onClose, hideTrigger }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VehicleLookup[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (externalOpen !== undefined) setOpen(externalOpen);
  }, [externalOpen]);

  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchVehicles(query);
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query, open]);

  const pick = (vehicle: VehicleLookup) => {
    onSelect(vehicle);
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  const close = () => {
    setOpen(false);
    setQuery('');
    setResults([]);
    onClose?.();
  };

  const displayLabel = selected
    ? (selected.permitPlateNumber ?? selected.plateNumber)
    : null;

  return (
    <>
      {!hideTrigger && <View style={s.container}>
        <Text style={s.label}>Vehicle / Driver</Text>
        <View style={s.row}>
          <Pressable
            style={({ pressed }) => [s.selector, pressed && s.selectorPressed]}
            onPress={() => setOpen(true)}
          >
            <Text style={selected ? s.selectedText : s.placeholder} numberOfLines={1}>
              {displayLabel ?? 'Search by plate or permit number'}
            </Text>
          </Pressable>
          {selected && (
            <Pressable style={s.clearBtn} onPress={onClear}>
              <Text style={s.clearBtnText}>✕</Text>
            </Pressable>
          )}
        </View>
        {selected && (
          <Text style={s.subtext}>
            {[selected.vehicleType, selected.make, selected.model, selected.color]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
      </View>}

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={close}
      >
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Select Vehicle</Text>
            <Pressable onPress={close} style={s.closeBtn}>
              <Text style={s.closeBtnText}>Cancel</Text>
            </Pressable>
          </View>
          <TextInput
            style={s.search}
            placeholder="Type plate or permit number (min. 2 chars)…"
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
            autoFocus
            clearButtonMode="while-editing"
            autoCapitalize="characters"
          />
          {loading ? (
            <ActivityIndicator color="#16a34a" style={s.loadingSpinner} />
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              contentContainerStyle={s.listContainer}
              ListEmptyComponent={
                query.trim().length >= 2 ? (
                  <Text style={s.empty}>No vehicles found.</Text>
                ) : (
                  <Text style={s.hint}>Enter at least 2 characters to search.</Text>
                )
              }
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [s.vehicleItem, pressed && s.vehicleItemPressed]}
                  onPress={() => pick(item)}
                >
                  <View style={s.vehicleRow}>
                    <Text style={s.plateText}>
                      {item.permitPlateNumber ?? item.plateNumber}
                    </Text>
                    <Text style={s.vehicleTypeBadge}>{item.vehicleType}</Text>
                  </View>
                  <Text style={s.vehicleDetail}>
                    {[item.make, item.model, item.color].filter(Boolean).join(' · ')}
                  </Text>
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
  selectedText: { color: '#0f172a', fontSize: 15, fontWeight: '600' },
  clearBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    justifyContent: 'center',
  },
  clearBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
  subtext: { fontSize: 12, color: '#64748b', marginTop: 4, marginLeft: 2 },
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
  listContainer: { paddingHorizontal: 12, paddingBottom: 40 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  hint: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 13 },
  vehicleItem: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 6 },
  vehicleItemPressed: { backgroundColor: '#f0fdf4' },
  vehicleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  plateText: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  vehicleTypeBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    textTransform: 'uppercase',
  },
  vehicleDetail: { fontSize: 12, color: '#64748b', marginTop: 3 },
});
