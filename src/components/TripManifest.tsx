import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/ui/theme';
import type { PlaceSelection } from '@/types/places';
import { selectionLabel } from '@/types/places';

type Slot = 'origin' | 'destination';

interface Props {
  origin: PlaceSelection | null;
  destination: PlaceSelection | null;
  /** Which row is taking typing. Null means neither — both read as plain text. */
  activeField: Slot | null;
  /** The text in the active row. Owned by the screen, because the list filters on it. */
  query: string;
  onQueryChange: (text: string) => void;
  onFocusField: (slot: Slot) => void;
  onClear: (slot: Slot) => void;
  onSwap: () => void;
  /**
   * Omitted when the device is offline: a dropped pin cannot be priced without
   * a connection, so the button is withdrawn rather than left to dead-end.
   */
  onPickOnMap?: (slot: Slot) => void;
  /** True while a GPS fix for the pickup is outstanding. */
  locating?: boolean;
}

/**
 * The FROM / TO pair, always on screen and always the way in.
 *
 * Only the focused row carries a TextInput. Two live inputs would mean two
 * queries, two keyboards fighting for focus, and an ambiguous answer to the one
 * question the list below has to ask: which end does a tapped row fill?
 */
export default function TripManifest({
  origin,
  destination,
  activeField,
  query,
  onQueryChange,
  onFocusField,
  onClear,
  onSwap,
  onPickOnMap,
  locating = false,
}: Props) {
  const swapDisabled = !origin && !destination;

  return (
    <View style={s.card}>
      <View style={s.fields}>
        <FieldRow
          slot="origin"
          label="Pickup"
          placeholder={locating ? 'Finding your location…' : 'Enter pickup location'}
          selection={origin}
          active={activeField === 'origin'}
          query={query}
          onQueryChange={onQueryChange}
          onFocus={() => onFocusField('origin')}
          onClear={() => onClear('origin')}
          onPickOnMap={onPickOnMap ? () => onPickOnMap('origin') : undefined}
        />

        <View style={s.rule} />

        <FieldRow
          slot="destination"
          label="Drop-off"
          placeholder="Enter drop-off location"
          selection={destination}
          active={activeField === 'destination'}
          query={query}
          onQueryChange={onQueryChange}
          onFocus={() => onFocusField('destination')}
          onClear={() => onClear('destination')}
          onPickOnMap={onPickOnMap ? () => onPickOnMap('destination') : undefined}
        />
      </View>

      <Pressable
        style={({ pressed }) => [s.swap, pressed && !swapDisabled && s.swapPressed]}
        onPress={onSwap}
        disabled={swapDisabled}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Swap pickup and drop-off"
      >
        <Ionicons
          name="swap-vertical"
          size={18}
          color={swapDisabled ? colors.textFaint : colors.primary}
        />
      </Pressable>
    </View>
  );
}

function FieldRow({
  slot,
  label,
  placeholder,
  selection,
  active,
  query,
  onQueryChange,
  onFocus,
  onClear,
  onPickOnMap,
}: {
  slot: Slot;
  label: string;
  placeholder: string;
  selection: PlaceSelection | null;
  active: boolean;
  query: string;
  onQueryChange: (text: string) => void;
  onFocus: () => void;
  onClear: () => void;
  onPickOnMap?: () => void;
}) {
  const filled = Boolean(selection);

  return (
    <View style={[s.row, active && s.rowActive]}>
      <View
        style={[
          s.marker,
          slot === 'origin' ? s.markerOrigin : s.markerDestination,
        ]}
      />

      {active ? (
        <TextInput
          style={s.input}
          value={query}
          onChangeText={onQueryChange}
          placeholder={filled ? selectionLabel(selection!) : placeholder}
          placeholderTextColor={filled ? colors.textStrong : colors.textFaint}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={`${label} search`}
        />
      ) : (
        <Pressable
          style={s.valuePress}
          onPress={onFocus}
          accessibilityRole="button"
          accessibilityLabel={
            filled ? `${label}: ${selectionLabel(selection!)}. Tap to change.` : `Set ${label}`
          }
        >
          <Text style={filled ? s.value : s.placeholder} numberOfLines={1}>
            {filled ? selectionLabel(selection!) : placeholder}
          </Text>
        </Pressable>
      )}

      {active && query.length > 0 ? (
        <Pressable
          onPress={() => onQueryChange('')}
          hitSlop={8}
          style={s.trailing}
          accessibilityRole="button"
          accessibilityLabel="Clear what you typed"
        >
          <Ionicons name="close-circle" size={18} color={colors.textFaint} />
        </Pressable>
      ) : filled ? (
        <Pressable
          onPress={onClear}
          hitSlop={8}
          style={s.trailing}
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label}`}
        >
          <Ionicons name="close" size={17} color={colors.textFaint} />
        </Pressable>
      ) : onPickOnMap ? (
        <Pressable
          onPress={onPickOnMap}
          hitSlop={8}
          style={s.trailing}
          accessibilityRole="button"
          accessibilityLabel={`Pick ${label} on the map`}
        >
          <Ionicons name="map-outline" size={18} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    paddingRight: spacing.sm,
  },
  fields: { flex: 1 },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingLeft: 14 },
  rowActive: { backgroundColor: colors.surfaceTint },

  // The two ends read as a route before a word is read: filled dot, then ring.
  marker: { width: 12, height: 12, borderRadius: 6 },
  markerOrigin: { backgroundColor: colors.primary },
  markerDestination: {
    borderWidth: 3,
    borderColor: colors.primaryDark,
    backgroundColor: colors.surface,
  },

  input: {
    flex: 1,
    minHeight: 54,
    paddingVertical: 0,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textStrong,
  },
  valuePress: { flex: 1, justifyContent: 'center', minHeight: 54 },
  value: { fontSize: 15, fontWeight: '600', color: colors.textStrong },
  placeholder: { fontSize: 15, color: colors.textFaint },

  trailing: { paddingHorizontal: 6, paddingVertical: 14 },

  rule: { height: 1, backgroundColor: colors.border, marginLeft: 14 + 12 + spacing.md },

  swap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapPressed: { backgroundColor: colors.surfaceAlt },
});
