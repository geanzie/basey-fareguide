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
import { Ionicons } from '@expo/vector-icons';
import { searchVehicles } from '@/services/vehicles';
import EmptyState from '@/ui/EmptyState';
import { colors, radii, spacing, shadow } from '@/ui/theme';
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
            <Ionicons name="search" size={16} color={colors.textFaint} />
            <Text style={selected ? s.selectedText : s.placeholder} numberOfLines={1}>
              {displayLabel ?? 'Search by plate or permit number'}
            </Text>
          </Pressable>
          {selected && (
            <Pressable style={s.clearBtn} onPress={onClear}>
              <Ionicons name="close" size={16} color={colors.danger} />
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
            <Pressable onPress={close} style={s.closeBtn} hitSlop={8}>
              <Text style={s.closeBtnText}>Cancel</Text>
            </Pressable>
          </View>

          <View style={s.searchWrap}>
            <Ionicons name="search" size={18} color={colors.textFaint} />
            <TextInput
              style={s.search}
              placeholder="Plate or permit number (min. 2 chars)…"
              placeholderTextColor={colors.textFaint}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCapitalize="characters"
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textFaint} />
              </Pressable>
            ) : null}
          </View>

          {loading ? (
            <View style={s.statePad}>
              <ActivityIndicator color={colors.primary} />
              <Text style={s.loadingText}>Searching…</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item, index) => item.id ?? item.plateNumber ?? String(index)}
              contentContainerStyle={s.listContainer}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                query.trim().length >= 2 ? (
                  <EmptyState icon="car-outline" title="No vehicles found" message="Check the plate or permit number and try again." />
                ) : (
                  <EmptyState icon="search-outline" title="Search for a vehicle" message="Enter at least 2 characters of the plate or permit number." />
                )
              }
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [s.vehicleItem, pressed && s.vehicleItemPressed]}
                  onPress={() => pick(item)}
                >
                  <View style={s.vehicleIcon}>
                    <Ionicons name="car" size={20} color={colors.primary} />
                  </View>
                  <View style={s.vehicleBody}>
                    <View style={s.vehicleRow}>
                      <Text style={s.plateText}>{item.permitPlateNumber ?? item.plateNumber}</Text>
                      {item.vehicleType ? (
                        <Text style={s.vehicleTypeBadge}>{item.vehicleType}</Text>
                      ) : null}
                    </View>
                    <Text style={s.vehicleDetail} numberOfLines={1}>
                      {[item.make, item.model, item.color].filter(Boolean).join(' · ') || 'No details'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
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
  container: { marginBottom: spacing.lg },
  label: { fontSize: 13, fontWeight: '600', color: colors.textBody, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  selector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    backgroundColor: colors.surface,
  },
  selectorPressed: { backgroundColor: colors.surfaceAlt },
  placeholder: { flex: 1, color: colors.textFaint, fontSize: 15 },
  selectedText: { flex: 1, color: colors.textStrong, fontSize: 15, fontWeight: '600' },
  clearBtn: {
    borderRadius: radii.md,
    paddingHorizontal: 14,
    backgroundColor: colors.dangerSoftBg,
    borderWidth: 1,
    borderColor: colors.dangerSoftBorder,
    justifyContent: 'center',
  },
  subtext: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs, marginLeft: 2 },

  modal: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textStrong },
  closeBtn: { padding: 4 },
  closeBtnText: { color: colors.info, fontSize: 15, fontWeight: '600' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.md,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  search: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.textStrong },

  statePad: { marginTop: 56, alignItems: 'center', gap: spacing.md },
  loadingText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },

  listContainer: { paddingHorizontal: spacing.md, paddingBottom: 40 },
  vehicleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  vehicleItemPressed: { backgroundColor: colors.surfaceTint },
  vehicleIcon: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.surfaceTint, alignItems: 'center', justifyContent: 'center' },
  vehicleBody: { flex: 1 },
  vehicleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  plateText: { fontSize: 15, fontWeight: '700', color: colors.textStrong },
  vehicleTypeBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.surfaceTint,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
    textTransform: 'uppercase',
    overflow: 'hidden',
  },
  vehicleDetail: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
});
