import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchPlaces, readCachedPlaces, searchWider } from '@/services/locations';
import { browsePlaces, searchPlaces } from '@/lib/placeSearch';
import { recentKey, recentLabel, recentToSelection, type RecentEntry } from '@/lib/recentPlaces';
import EmptyState from '@/ui/EmptyState';
import Button from '@/ui/Button';
import { colors, radii, spacing, shadow, text } from '@/ui/theme';
import type { Place, PlaceCandidate, PlaceCoordinates, PlaceSelection } from '@/types/places';

interface Props {
  /** Which end a tapped row fills. Wording only — the screen owns the assignment. */
  slot: 'origin' | 'destination';
  /** The live query from the focused field. Empty means "browse". */
  query: string;
  /** Places this rider has quoted before, newest first. */
  recents: RecentEntry[];
  /** The detected pickup, used to sort the browse list nearest-first. */
  originCoordinates: PlaceCoordinates | null;
  onSelect: (selection: PlaceSelection) => void;
  /** Lets the rider abandon search and pin the spot on the map instead. */
  /**
   * Omitted when the device is offline: a dropped pin cannot be priced without
   * a connection, so the button is withdrawn rather than left to dead-end.
   */
  onPickOnMap?: () => void;
  /**
   * Offered for the pickup only. The recovery path after the on-open prompt was
   * refused, and the re-acquire path for a rider who has since moved.
   */
  onUseCurrentLocation?: () => void;
  /** True while a fix is outstanding, so the row cannot be tapped twice. */
  locating?: boolean;
}

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  barangay: 'business-outline',
  sitio: 'home-outline',
  landmark: 'flag-outline',
};

type Row =
  | { type: 'header'; key: string; title: string }
  | { type: 'recent'; key: string; entry: RecentEntry }
  | { type: 'place'; key: string; place: Place };

/**
 * The body of the trip screen: recents, then everything else, then whatever the
 * rider types over the top of both.
 *
 * It is deliberately not a modal any more. Search is how a trip gets set now,
 * so it is the screen rather than a layer over one.
 */
export default function PlacePickerField({
  slot,
  query,
  recents,
  originCoordinates,
  onSelect,
  onPickOnMap,
  onUseCurrentLocation,
  locating = false,
}: Props) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [candidates, setCandidates] = useState<PlaceCandidate[] | null>(null);
  const [searchingWider, setSearchingWider] = useState(false);
  const [widerError, setWiderError] = useState<string | null>(null);

  // Render the cached list first, then let the network correct it. Waiting on a
  // round trip here would be the whole screen waiting.
  useEffect(() => {
    let cancelled = false;
    let served = false;

    void readCachedPlaces().then((cached) => {
      if (cancelled || !cached?.length) return;
      served = true;
      setPlaces(cached);
      setLoading(false);
    });

    fetchPlaces()
      .then((fresh) => {
        if (cancelled) return;
        served = true;
        setPlaces(fresh);
        setLoadError(false);
      })
      .catch(() => {
        // Only a cold start with no connection is an error worth showing.
        if (!cancelled && !served) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Local matching over a cached list, so this runs on every keystroke with no
  // debounce and no network round-trip.
  const { places: results, isFuzzy } = useMemo(
    () => searchPlaces(places, query),
    [places, query],
  );

  const browse = useMemo(
    () => browsePlaces(places, originCoordinates),
    [places, originCoordinates],
  );

  useEffect(() => {
    setCandidates(null);
    setWiderError(null);
  }, [query]);

  const searching = query.trim().length > 0;

  /**
   * A stored recent carries the Place as it was when it was quoted. Re-resolving
   * against the live list means a renamed or re-surveyed place shows its current
   * self rather than a snapshot.
   */
  const recentRows: Row[] = useMemo(() => {
    const byId = new Map(places.map((place) => [place.id, place]));
    return recents.map((entry) => {
      if (entry.kind !== 'place') {
        return { type: 'recent' as const, key: recentKey(entry), entry };
      }
      const live = byId.get(entry.place.id);
      return {
        type: 'recent' as const,
        key: recentKey(entry),
        entry: live ? { ...entry, place: live } : entry,
      };
    });
  }, [recents, places]);

  const rows: Row[] = useMemo(() => {
    if (searching) {
      return results.map((place) => ({ type: 'place' as const, key: place.id, place }));
    }

    const built: Row[] = [];
    if (recentRows.length > 0) {
      built.push({ type: 'header', key: 'h-recent', title: 'Recent' });
      built.push(...recentRows);
    }
    if (browse.length > 0) {
      built.push({
        type: 'header',
        key: 'h-browse',
        title: originCoordinates ? 'Nearby' : 'All places',
      });
      built.push(...browse.map((place) => ({ type: 'place' as const, key: place.id, place })));
    }
    return built;
  }, [searching, results, recentRows, browse, originCoordinates]);

  const pickPlace = (place: Place) => onSelect({ kind: 'place', place });

  const pickCandidate = (candidate: PlaceCandidate) => {
    // A geocoded result is never authoritative — it enters as a pin, which the
    // server bounds-checks like any other dropped pin.
    onSelect({ kind: 'pin', coordinates: candidate.coordinates, label: candidate.label });
  };

  const runSearchWider = async () => {
    setSearchingWider(true);
    setWiderError(null);
    try {
      const found = await searchWider(query.trim());
      setCandidates(found);
      if (found.length === 0) setWiderError('Nothing found for that name.');
    } catch (err) {
      setWiderError(err instanceof Error ? err.message : 'Wider search is unavailable.');
      setCandidates([]);
    } finally {
      setSearchingWider(false);
    }
  };

  if (loading && places.length === 0) {
    return (
      <View style={s.statePad}>
        <ActivityIndicator color={colors.primary} />
        <Text style={s.loadingText}>Loading places…</Text>
      </View>
    );
  }

  if (loadError && places.length === 0) {
    return (
      <View style={s.statePad}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Could not load places"
          message={
            onPickOnMap
              ? 'Check your connection, or pick the point on the map.'
              : 'The saved place list has not reached this phone yet. Connect once and it will be here next time.'
          }
          actionLabel={onPickOnMap ? 'Pick on map' : undefined}
          onAction={onPickOnMap}
        />
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.key}
      contentContainerStyle={s.listContainer}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListHeaderComponent={
        <View>
          {onUseCurrentLocation ? (
            <Pressable style={s.actionRow} onPress={onUseCurrentLocation} disabled={locating}>
              <Ionicons
                name="locate-outline"
                size={18}
                color={locating ? colors.textFaint : colors.primary}
              />
              <Text style={[s.actionRowText, locating && s.actionRowTextMuted]}>
                {locating ? 'Finding your location…' : 'Use my current location'}
              </Text>
            </Pressable>
          ) : null}

          {onPickOnMap ? (
            <Pressable style={s.actionRow} onPress={onPickOnMap}>
              <Ionicons name="location-outline" size={18} color={colors.primary} />
              <Text style={s.actionRowText}>
                {slot === 'origin'
                  ? 'Pick the pickup point on the map'
                  : 'Pick the drop-off point on the map'}
              </Text>
            </Pressable>
          ) : null}

          {isFuzzy && results.length > 0 ? (
            <Text style={s.fuzzyNote}>No exact match — did you mean one of these?</Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        searching ? (
          <NoLocalMatch
            query={query}
            canSearchWider={query.trim().length >= 3}
            searching={searchingWider}
            candidates={candidates}
            error={widerError}
            onSearchWider={runSearchWider}
            onPickCandidate={pickCandidate}
            onPickOnMap={onPickOnMap}
          />
        ) : (
          <EmptyState
            icon="search-outline"
            title="Search for a place"
            message="Type a barangay or landmark name — spelling does not have to be exact."
          />
        )
      }
      renderItem={({ item }) => {
        if (item.type === 'header') {
          return (
            <View style={s.sectionHead}>
              <Text style={text.sectionLabel}>{item.title}</Text>
              <View style={s.sectionRule} />
            </View>
          );
        }

        if (item.type === 'recent') {
          const entry = item.entry;
          return (
            <PlaceRow
              icon={entry.kind === 'pin' ? 'location' : (CATEGORY_ICON[entry.place.category] ?? 'flag-outline')}
              title={recentLabel(entry)}
              detail={entry.kind === 'pin' ? 'Dropped pin' : describePlace(entry.place)}
              onPress={() => onSelect(recentToSelection(entry))}
            />
          );
        }

        return (
          <PlaceRow
            icon={CATEGORY_ICON[item.place.category] ?? 'flag-outline'}
            title={item.place.name}
            detail={describePlace(item.place)}
            warn={item.place.needsResurvey}
            onPress={() => pickPlace(item.place)}
          />
        );
      }}
    />
  );
}

function describePlace(place: Place): string {
  if (place.category === 'barangay') return 'Barangay';
  return (
    [place.barangay, place.category === 'sitio' ? 'Sitio' : null].filter(Boolean).join(' · ') ||
    'Basey'
  );
}

function PlaceRow({
  icon,
  title,
  detail,
  warn,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  warn?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [s.row, pressed && s.rowPressed]} onPress={onPress}>
      <View style={s.rowIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={s.rowDetail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {warn ? <Ionicons name="alert-circle-outline" size={18} color={colors.warning} /> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

function NoLocalMatch({
  query,
  canSearchWider,
  searching,
  candidates,
  error,
  onSearchWider,
  onPickCandidate,
  onPickOnMap,
}: {
  query: string;
  canSearchWider: boolean;
  searching: boolean;
  candidates: PlaceCandidate[] | null;
  error: string | null;
  onSearchWider: () => void;
  onPickCandidate: (candidate: PlaceCandidate) => void;
  onPickOnMap?: () => void;
}) {
  if (candidates && candidates.length > 0) {
    return (
      <View style={s.candidateWrap}>
        <Text style={s.candidateNote}>
          Not a listed Basey place. Check the location on the map before using it — the fare is
          estimated from the point you confirm.
        </Text>
        {candidates.map((candidate) => (
          <Pressable
            key={`${candidate.coordinates.lat},${candidate.coordinates.lng}`}
            style={({ pressed }) => [s.row, pressed && s.rowPressed]}
            onPress={() => onPickCandidate(candidate)}
          >
            <View style={[s.rowIcon, s.rowIconMuted]}>
              <Ionicons name="globe-outline" size={20} color={colors.warningDark} />
            </View>
            <View style={s.rowBody}>
              <Text style={s.rowTitle} numberOfLines={1}>
                {candidate.label}
              </Text>
              <Text style={s.rowDetail} numberOfLines={1}>
                {candidate.address}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View style={s.noMatchWrap}>
      <EmptyState
        icon="help-circle-outline"
        title={`No Basey place called "${query.trim()}"`}
        message="Search wider to look it up on the map, or drop a pin yourself."
      />
      {error ? <Text style={s.errorText}>{error}</Text> : null}
      <View style={s.noMatchActions}>
        <Button
          label={searching ? 'Searching…' : 'Search wider'}
          onPress={onSearchWider}
          loading={searching}
          disabled={!canSearchWider}
        />
        {onPickOnMap ? (
          <Button label="Pick on map" variant="secondary" onPress={onPickOnMap} />
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
  },
  actionRowText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  actionRowTextMuted: { color: colors.textFaint },

  statePad: { flex: 1, marginTop: 40, alignItems: 'center', gap: spacing.md },
  loadingText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },

  listContainer: { paddingHorizontal: spacing.md, paddingBottom: 40 },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionRule: { flex: 1, height: 1, backgroundColor: colors.border },

  fuzzyNote: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  rowPressed: { backgroundColor: colors.surfaceTint },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconMuted: { backgroundColor: '#fef3c7' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textStrong },
  rowDetail: { fontSize: 12, color: colors.textMuted, marginTop: 3 },

  noMatchWrap: { gap: spacing.md },
  noMatchActions: { gap: spacing.sm, paddingHorizontal: spacing.md },
  errorText: { fontSize: 12, color: colors.danger, textAlign: 'center' },

  candidateWrap: { gap: spacing.sm },
  candidateNote: {
    fontSize: 12,
    color: colors.warningDark,
    backgroundColor: '#fffbeb',
    borderRadius: radii.md,
    padding: 12,
    marginBottom: spacing.xs,
  },
});
