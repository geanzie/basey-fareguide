import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Modal,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Button from '@/ui/Button';
import { colors, radii, spacing, text } from '@/ui/theme';
import {
  calculateRoute,
  discountTypeToPassengerType,
  saveFareCalculation,
  selectionToLocationInput,
  toVehicleType,
} from '@/services/fare';
import { fetchCuratedRoutes } from '@/services/curatedRoutes';
import { fetchPlaces } from '@/services/locations';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { resolveOfflineQuote } from '@/lib/offline/offlineQuote';
import { loadLastFarePolicy, saveLastFarePolicy } from '@/lib/offline/farePolicyCache';
import { routeCacheKey, saveCachedRoute } from '@/lib/offline/routeCache';
import { fetchMyDiscountCard, usableDiscountCard } from '@/services/discountCards';
import {
  CURRENT_LOCATION_MESSAGES,
  getCurrentPlaceSelection,
  resolveSelectionLabel,
  type CurrentLocationFailure,
} from '@/services/currentLocation';
import { ApiError, isOfflineError } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import {
  loadRecentPlaces,
  rememberRecentPlaces,
  type RecentEntry,
} from '@/lib/recentPlaces';
import { useFeedback } from '@/ui/FeedbackProvider';
import InteractiveCalculatorMap from '@/components/InteractiveCalculatorMap';
import FareResultCard from '@/components/FareResultCard';
import OfflineFareNotice from '@/components/OfflineFareNotice';
import TripManifest from '@/components/TripManifest';
import VehiclePickerField from '@/components/VehiclePickerField';
import PlacePickerField from '@/components/PlacePickerField';
import QRScannerModal from '@/components/QRScannerModal';
import type {
  DiscountType,
  FarePolicySnapshot,
  NoVehicleAccessDetails,
  RouteCalculationResponse,
  VehicleLookup,
  VehicleType,
} from '@/types/fare';
import type { WalkTail } from '@/components/InteractiveCalculatorMap';
import type { DiscountCard } from '@/types/discount';
import type { PlaceSelection } from '@/types/places';
import { selectionCoordinates, selectionLabel } from '@/types/places';

type Slot = 'origin' | 'destination';
type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * The screen moves through three states rather than layering everything over a
 * map: pick the ride, set the trip, read the fare.
 */
type Phase = 'vehicle' | 'trip' | 'fare';

interface RouteError {
  code?: string;
  message: string;
  /** Present on NO_VEHICLE_ACCESS: where the ride can stop instead. */
  access?: NoVehicleAccessDetails;
}

function parseAccessDetails(details: unknown): NoVehicleAccessDetails | undefined {
  if (!details || typeof details !== 'object') return undefined;
  const candidate = details as Partial<NoVehicleAccessDetails>;
  if (!candidate.dropoff || typeof candidate.dropoff.lat !== 'number') return undefined;
  if (candidate.field !== 'origin' && candidate.field !== 'destination') return undefined;
  return candidate as NoVehicleAccessDetails;
}

/** Identifies an endpoint by what the quote request would carry for it. */
function requestKey(selection: PlaceSelection): string {
  if (selection.kind === 'place') return `place:${selection.place.name}`;
  return `pin:${selection.coordinates.lat},${selection.coordinates.lng}`;
}

/**
 * The two rides this ordinance system is deployed for. Basey FareCheck is
 * distributed to tricycle and habal-habal drivers; the other types the server
 * knows about have no fleet behind them here.
 */
const VEHICLE_TYPE_CHOICES: {
  value: VehicleType;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  hint: string;
}[] = [
  {
    value: 'TRICYCLE',
    label: 'Tricycle',
    icon: 'rickshaw',
    hint: 'Roads and paved streets',
  },
  {
    value: 'HABAL_HABAL',
    label: 'Habal-habal',
    icon: 'motorbike',
    hint: 'Reaches trails a tricycle cannot',
  },
];

/** A scan can still name a type with no card here; show it rather than refuse it. */
function vehicleTypeLabel(type: VehicleType): string {
  const choice = VEHICLE_TYPE_CHOICES.find((entry) => entry.value === type);
  if (choice) return choice.label;
  const spaced = type.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const PASSENGER_LABELS: Record<DiscountType, string> = {
  NONE: 'Regular fare',
  STUDENT: 'Student fare',
  SENIOR_CITIZEN: 'Senior citizen fare',
  PWD: 'PWD fare',
};

const PHASE_TITLES: Record<Phase, string> = {
  vehicle: 'How are you riding?',
  trip: 'Your trip',
  fare: 'Your fare',
};

/**
 * Search first, map on request.
 *
 * The map used to be the page, which meant tiles, a GPS fix and a reverse
 * geocode all had to land before anything was tappable. A rider almost always
 * knows the name of where they are going, so the name is the input and the map
 * is a tool they summon — for dropping a pin, or for seeing the route once it
 * has been measured.
 */
export default function CalculatorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showError, showWarning } = useFeedback();
  const userId = useAuthStore((state) => state.user?.id ?? null);

  const [phase, setPhase] = useState<Phase>('vehicle');
  const [origin, setOrigin] = useState<PlaceSelection | null>(null);
  const [destination, setDestination] = useState<PlaceSelection | null>(null);
  // Which row is taking typing, and so which end a tapped result fills.
  const [activeField, setActiveField] = useState<Slot | null>(null);
  const [query, setQuery] = useState('');
  // Which end a map tap fills. Null means the map is inert, i.e. a preview.
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleLookup | null>(null);
  const [chosenVehicleType, setChosenVehicleType] = useState<VehicleType | null>(null);
  const [result, setResult] = useState<RouteCalculationResponse | null>(null);
  const [routeError, setRouteError] = useState<RouteError | null>(null);
  const [calculating, setCalculating] = useState(false);
  /**
   * Set when there is no connection and no exact distance for this trip.
   * Distinct from routeError: nothing failed, we simply refuse to guess a fare.
   */
  const [offlineUnpriced, setOfflineUnpriced] = useState(false);
  /** The last rates the server sent, shown alongside the offline notice. */
  const [cachedPolicy, setCachedPolicy] = useState<FarePolicySnapshot | null>(null);
  const isOnline = useOnlineStatus();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sendError, setSendError] = useState<{ status: number; message: string } | null>(null);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [discountCard, setDiscountCard] = useState<DiscountCard | null>(null);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [retryNonce, setRetryNonce] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locationFailure, setLocationFailure] = useState<CurrentLocationFailure | null>(null);

  const discountType: DiscountType = discountCard?.discountType ?? 'NONE';
  const passengerLabel = PASSENGER_LABELS[discountType];

  // A scanned or looked-up plate knows its own type, so it overrides the choice
  // rather than sitting beside it and disagreeing.
  const vehicleTypeFromPlate = toVehicleType(selectedVehicle?.vehicleType);
  const vehicleType = vehicleTypeFromPlate ?? chosenVehicleType;

  // The discount is tied to an issued card, never self-declared. A quote for a
  // category the trip request cannot honour would be worse than no quote.
  useEffect(() => {
    let cancelled = false;
    fetchMyDiscountCard()
      .then((status) => {
        if (!cancelled) setDiscountCard(usableDiscountCard(status));
      })
      .catch(() => {
        // A missing or unreadable card just means the regular fare.
      });
    return () => { cancelled = true; };
  }, []);

  // Recents are per rider: these phones get shared.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void loadRecentPlaces(userId).then((entries) => {
      if (!cancelled) setRecents(entries);
    });
    return () => { cancelled = true; };
  }, [userId]);

  const clearResult = () => {
    setResult(null);
    setRouteError(null);
    setOfflineUnpriced(false);
    setSaved(false);
    setSendError(null);
  };

  const setSlot = (slot: Slot, selection: PlaceSelection | null) => {
    if (slot === 'origin') setOrigin(selection);
    else setDestination(selection);
    clearResult();
  };

  const handleMapPress = (coord: { lat: number; lng: number }) => {
    if (!activeSlot) return;
    setSlot(activeSlot, { kind: 'pin', coordinates: coord });
    setActiveSlot(null);
    setMapOpen(false);
  };

  /**
   * Fills the pickup from the phone's own GPS.
   *
   * A prefill, never a lock: search and map-tapping stay open throughout, and a
   * refusal leaves the screen exactly as it behaved before GPS existed. The
   * barangay name arrives after the pin, so the quote never waits on a label.
   */
  const useCurrentLocation = async () => {
    setLocating(true);
    setLocationFailure(null);

    const located = await getCurrentPlaceSelection();

    if (!located.ok) {
      setLocationFailure(located.reason);
      setLocating(false);
      return;
    }

    setSlot('origin', located.selection);
    setLocating(false);

    const labelled = await resolveSelectionLabel(located.selection);
    // Only relabel the pin still standing in the origin slot.
    setOrigin((current) =>
      current && requestKey(current) === requestKey(located.selection) ? labelled : current,
    );
  };

  // Ask once, on open, and only into an empty pickup. Running it here rather
  // than on the trip phase means the fix and its barangay label resolve while
  // the rider is still choosing a vehicle.
  //
  // Skipped entirely when offline. A GPS fix is a dropped pin, and no offline
  // source can price a pin — the surveyed corpus is keyed on saved places. So
  // offline this would quietly seed the screen with a trip that can only ever
  // come back unpriced. Leaving the pickup empty steers the rider to the place
  // list instead, which works with no connection at all.
  useEffect(() => {
    if (origin) return;
    if (!isOnline) return;
    void useCurrentLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // Keep the rate card ready before it is needed: it is what the offline notice
  // shows in place of a fare.
  useEffect(() => {
    void loadLastFarePolicy().then(setCachedPolicy);
  }, [result]);

  // Pull the surveyed distance corpus whenever we have a connection. This is
  // what lets a rider price a barangay pair they have never looked up before
  // once they are out of signal; a route-by-route cache could only ever replay
  // trips they had already asked about.
  //
  // The place list is warmed here too rather than waiting for the picker to
  // mount: offline the rider can only choose places by name, so an empty place
  // cache is the one failure that leaves them with nothing to select at all.
  useEffect(() => {
    if (!isOnline) return;
    void fetchCuratedRoutes().catch(() => {
      // Best effort. Without it the offline path falls back to cached routes.
    });
    void fetchPlaces().catch(() => {});
  }, [isOnline]);

  // Recalculates whenever either end, the passenger's discount card, or the
  // ride type changes. The ride type belongs here because a habal-habal and a
  // tricycle take different roads, so it moves the distance and the fare.
  // What the request would carry for one end — a preset name or a coordinate.
  // Keying the recalculation on this rather than on object identity means
  // relabelling a pin (the GPS pickup, once its barangay resolves) does not
  // re-quote a trip that has not moved.
  const originKey = origin ? requestKey(origin) : null;
  const destinationKey = destination ? requestKey(destination) : null;

  useEffect(() => {
    if (!origin || !destination) return;

    let cancelled = false;
    setCalculating(true);
    setResult(null);
    setRouteError(null);
    setOfflineUnpriced(false);
    setSaved(false);
    setSendError(null);
    // Move to the fare view now, so the measuring state is what the rider
    // watches rather than a list they have finished with.
    setActiveField(null);
    setQuery('');
    setPhase('fare');

    /**
     * Price the trip from what is already on the phone, or show the offline
     * notice. Never estimates: see resolveOfflineQuote.
     */
    const settleOffline = async () => {
      const offline = await resolveOfflineQuote({
        origin,
        destination,
        passengerType: discountTypeToPassengerType(discountType),
        vehicleType,
      });
      if (cancelled) return;

      if (offline) {
        setResult(offline);
        if (userId) {
          void rememberRecentPlaces(userId, [origin, destination]).then(setRecents);
        }
      } else {
        setOfflineUnpriced(true);
      }
    };

    const run = async () => {
      // No point spending the request timeout on a connection we know is down.
      if (!isOnline) {
        await settleOffline();
        return;
      }

      try {
        const res = await calculateRoute({
          origin: selectionToLocationInput(origin),
          destination: selectionToLocationInput(destination),
          discountType,
          vehicleType,
        });
        if (cancelled) return;

        setResult(res);
        // Only places that actually produced a fare are worth offering back.
        if (userId) {
          void rememberRecentPlaces(userId, [origin, destination]).then(setRecents);
        }
        void persistForOffline(res);
      } catch (err) {
        if (cancelled) return;

        // A timed-out or refused request means we never heard from the server,
        // which is the same situation as being offline outright. Anything with
        // a real HTTP status is the server telling us something, and the rider
        // deserves to see that rather than a silent fallback.
        if (isOfflineError(err)) {
          await settleOffline();
          return;
        }

        setRouteError({
          code: err instanceof ApiError ? err.code : undefined,
          message: err instanceof Error ? err.message : 'The fare could not be calculated.',
          access: err instanceof ApiError ? parseAccessDetails(err.details) : undefined,
        });
      }
    };

    /**
     * Keep what the server measured so this pair can be priced offline later.
     *
     * Stores the distance and the policy, never the fare: distance does not
     * change when the ordinance rate does, so the peso figure is recomputed at
     * display time and a rate change can never replay a stale price.
     */
    const persistForOffline = async (res: RouteCalculationResponse) => {
      void saveLastFarePolicy(res.farePolicy);
      // A same-point response carries no measurement worth replaying.
      if (res.method === null) return;

      void saveCachedRoute(routeCacheKey(origin, destination, vehicleType), {
        distanceKm: res.distanceKm,
        durationMin: res.durationMin ?? null,
        farePolicy: res.farePolicy,
        storedAt: Date.now(),
      });
    };

    void run().finally(() => {
      if (!cancelled) setCalculating(false);
    });

    return () => {
      cancelled = true;
    };
    // origin/destination are read through their request keys on purpose; see
    // the comment above originKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originKey, destinationKey, discountType, vehicleType, retryNonce, isOnline]);

  const send = async () => {
    if (!result || !origin || !destination) return;
    if (!selectedVehicle) {
      showWarning('Scan the driver’s QR code or enter their plate number first.', {
        title: 'No vehicle selected',
      });
      return;
    }
    if (!selectedVehicle.id) {
      showError('This vehicle is missing its record ID. Select it again.');
      return;
    }

    const originCoords = selectionCoordinates(origin);
    const destCoords = selectionCoordinates(destination);
    const discount = result.fareBreakdown.discount ?? 0;
    const subtotal = result.fareBreakdown.baseFare + result.fareBreakdown.additionalFare;
    // The server validates discount usage as a set: card id, original fare and
    // a positive discount amount, or none of the three.
    const usesCard = Boolean(discountCard) && discount > 0;

    setSaving(true);
    setSendError(null);
    try {
      const response = await saveFareCalculation({
        originLat: originCoords.lat,
        originLng: originCoords.lng,
        originLabel: result.origin,
        destinationLat: destCoords.lat,
        destinationLng: destCoords.lng,
        destinationLabel: result.destination,
        distanceKm: result.distanceKm,
        fare: result.fare,
        discountType: usesCard ? discountType : 'NONE',
        isEstimate: result.isEstimate,
        vehicleId: selectedVehicle.id,
        method: result.method,
        provider: result.provider,
        polyline: result.polyline,
        farePolicySnapshot: result.farePolicy,
        discountCardId: usesCard ? discountCard!.id : null,
        originalFare: usesCard ? subtotal : null,
        discountApplied: usesCard ? discount : null,
      });
      if (!response.success) {
        setSendError({ status: 0, message: 'The trip request was not accepted. Try again.' });
        return;
      }
      setSaved(true);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const message = err instanceof Error ? err.message : 'The trip request could not be sent.';
      // 409 is the one failure the screen cannot predict: the vehicle is valid
      // but its driver has no open trip session.
      if (status === 409) setSendError({ status, message });
      else showError(message);
    } finally {
      setSaving(false);
    }
  };

  /** Opens the trip phase on whichever end is still missing. */
  const goToTrip = (nextOrigin: PlaceSelection | null = origin) => {
    setPhase('trip');
    setQuery('');
    setActiveField(nextOrigin ? 'destination' : 'origin');
  };

  const chooseVehicleType = (value: VehicleType) => {
    setChosenVehicleType(value);
    goToTrip();
  };

  const pickVehicle = (vehicle: VehicleLookup) => {
    setSelectedVehicle(vehicle);
    setSendError(null);
    setQrScannerOpen(false);
    setVehiclePickerOpen(false);
    // A scanned plate carries its own type, so the ride is settled either way.
    if (phase === 'vehicle') goToTrip();
  };

  const focusField = (slot: Slot) => {
    setActiveField(slot);
    setQuery('');
  };

  const selectPlace = (selection: PlaceSelection) => {
    const slot = activeField ?? 'destination';
    const current = slot === 'origin' ? origin : destination;
    const other: Slot = slot === 'origin' ? 'destination' : 'origin';
    const otherFilled = other === 'origin' ? Boolean(origin) : Boolean(destination);

    setQuery('');

    // Re-picking what is already there must not clear a fare the quote effect
    // will not recompute — the request keys have not moved, so it would never
    // re-fire and the rider would be left staring at an empty fare view.
    if (current && requestKey(current) === requestKey(selection)) {
      setActiveField(otherFilled ? null : other);
      if (otherFilled) setPhase('fare');
      return;
    }

    setSlot(slot, selection);
    // Move to the end still empty, so a two-tap trip needs no third tap.
    setActiveField(otherFilled ? null : other);
  };

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
    setQuery('');
    clearResult();
  };

  const reset = () => {
    setOrigin(null);
    setDestination(null);
    setActiveSlot(null);
    // A refusal from an earlier fix should not haunt a freshly cleared trip.
    setLocationFailure(null);
    setBreakdownOpen(false);
    clearResult();
    setQuery('');
    // Clearing from the vehicle phase is still just clearing: it must not
    // skip the rider past the choice they have not made yet.
    if (phase !== 'vehicle') {
      setPhase('trip');
      setActiveField('origin');
    } else {
      setActiveField(null);
    }
  };

  const clearSlot = (slot: Slot) => {
    setSlot(slot, null);
    focusField(slot);
  };

  const armMapPick = (slot: Slot) => {
    setActiveField(null);
    setActiveSlot(slot);
    setMapOpen(true);
  };

  const openRoutePreview = () => {
    setActiveSlot(null);
    setMapOpen(true);
  };

  const closeMap = () => {
    setMapOpen(false);
    setActiveSlot(null);
  };

  const editTrip = useCallback((slot: Slot) => {
    setPhase('trip');
    setQuery('');
    setActiveField(slot);
  }, []);

  /** One step back through the phases; false means the screen itself should close. */
  const stepBack = useCallback((): boolean => {
    if (mapOpen) {
      setMapOpen(false);
      setActiveSlot(null);
      return true;
    }
    if (phase === 'fare') {
      setPhase('trip');
      setActiveField(null);
      return true;
    }
    if (phase === 'trip') {
      setPhase('vehicle');
      setActiveField(null);
      return true;
    }
    return false;
  }, [mapOpen, phase]);

  // The phases are internal state, so without this the hardware button would
  // pop the whole route and disagree with the arrow in the header.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => stepBack());
    return () => subscription.remove();
  }, [stepBack]);

  const vehicleDisplay = selectedVehicle
    ? (selectedVehicle.permitPlateNumber ?? selectedVehicle.plateNumber ?? 'Selected vehicle')
    : null;
  const vehicleDetail = selectedVehicle
    ? [selectedVehicle.vehicleType, selectedVehicle.make, selectedVehicle.model, selectedVehicle.color]
        .filter(Boolean)
        .join(' · ')
    : null;

  const originPin = origin ? selectionCoordinates(origin) : null;
  const destPin = destination ? selectionCoordinates(destination) : null;

  const endpointFor = (field: Slot) => (field === 'origin' ? origin : destination);

  const useDropoff = (field: Slot, point: { lat: number; lng: number }, label: string) => {
    setSlot(field, { kind: 'pin', coordinates: point, label });
  };

  // Where the ride stops and the walk begins — from a blocked quote, or from a
  // vetted place that was measured to its drop-off.
  const walkTail: WalkTail | null = (() => {
    const blocked = routeError?.access;
    if (blocked) {
      const end = endpointFor(blocked.field);
      if (!end) return null;
      return {
        from: { lat: blocked.dropoff.lat, lng: blocked.dropoff.lng },
        to: selectionCoordinates(end),
        walkMeters: blocked.dropoff.walkMeters,
        label: blocked.dropoff.label,
      };
    }

    const notice = result?.dropoffNotices?.[0];
    if (!notice) return null;
    const end = endpointFor(notice.field);
    if (!end) return null;

    return {
      from: { lat: notice.lat, lng: notice.lng },
      to: selectionCoordinates(end),
      walkMeters: notice.walkMeters,
      label: notice.label,
    };
  })();

  const sameSpot = Boolean(result) && result!.distanceKm === 0;
  const rideLocked = Boolean(vehicleTypeFromPlate);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable
          onPress={() => { if (!stepBack()) router.back(); }}
          hitSlop={10}
          style={s.headerBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.textStrong} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{PHASE_TITLES[phase]}</Text>
        {origin || destination ? (
          <Pressable
            onPress={reset}
            hitSlop={10}
            style={s.headerAction}
            accessibilityRole="button"
          >
            <Text style={s.headerActionText}>Clear</Text>
          </Pressable>
        ) : (
          <View style={s.headerAction} />
        )}
      </View>

      {phase === 'vehicle' ? (
        <ScrollView contentContainerStyle={s.vehicleBody} keyboardShouldPersistTaps="handled">
          <Text style={s.lede}>
            A habal-habal can take trails a tricycle cannot, so the ride you pick changes the
            distance and the fare.
          </Text>

          <View style={s.rideCards}>
            {VEHICLE_TYPE_CHOICES.map((choice) => {
              const selected = vehicleType === choice.value;
              return (
                <Pressable
                  key={choice.value}
                  onPress={() => chooseVehicleType(choice.value)}
                  disabled={rideLocked}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: rideLocked }}
                  style={({ pressed }) => [
                    s.rideCard,
                    selected && s.rideCardOn,
                    rideLocked && !selected && s.rideCardMuted,
                    pressed && !rideLocked && s.pressedSurface,
                  ]}
                >
                  <View style={[s.rideIcon, selected && s.rideIconOn]}>
                    <MaterialCommunityIcons
                      name={choice.icon}
                      size={30}
                      color={selected ? colors.onPrimary : colors.primaryDark}
                    />
                  </View>
                  <Text style={s.rideLabel}>{choice.label}</Text>
                  <Text style={s.rideHint}>{choice.hint}</Text>
                </Pressable>
              );
            })}
          </View>

          {rideLocked ? (
            <Text style={s.rideLockedNote}>
              Taken from the plate you selected
              {vehicleTypeFromPlate ? `: ${vehicleTypeLabel(vehicleTypeFromPlate)}.` : '.'}
            </Text>
          ) : null}

          <Section label="Driver (optional)">
            {selectedVehicle ? (
              <VehicleCard
                display={vehicleDisplay!}
                detail={vehicleDetail}
                onChange={() => { setSelectedVehicle(null); setSendError(null); }}
              />
            ) : (
              <View style={s.driverActions}>
                <ActionChip
                  icon="qr-code-outline"
                  label="Scan the driver’s QR code"
                  onPress={() => setQrScannerOpen(true)}
                />
                <Pressable
                  onPress={() => setVehiclePickerOpen(true)}
                  hitSlop={8}
                  style={s.plateLinkBtn}
                  accessibilityRole="button"
                >
                  <Text style={s.plateLink}>Enter the plate number instead</Text>
                </Pressable>
                <Text style={s.driverNote}>
                  Only needed to send the driver a trip request. Skip it to check a fare.
                </Text>
              </View>
            )}
          </Section>
        </ScrollView>
      ) : null}

      {phase === 'trip' ? (
        <View style={s.tripBody}>
          <View style={s.tripHead}>
            <TripManifest
              origin={origin}
              destination={destination}
              activeField={activeField}
              query={query}
              onQueryChange={setQuery}
              onFocusField={focusField}
              onClear={clearSlot}
              onSwap={swap}
              onPickOnMap={isOnline ? armMapPick : undefined}
              locating={locating}
            />

            <View style={s.tripMeta}>
              <View style={s.farePill}>
                <Ionicons name="pricetag-outline" size={13} color={colors.primaryDark} />
                <Text style={s.farePillText}>{passengerLabel}</Text>
              </View>
              {vehicleType ? (
                <Text style={s.tripMetaText}>{vehicleTypeLabel(vehicleType)}</Text>
              ) : null}
            </View>

            {/*
              Offline the calculator can only price trips between saved places,
              so say so before the rider picks a pin and gets nothing back.
            */}
            {!isOnline ? (
              <View style={s.locationFailure}>
                <Text style={s.locationHint}>
                  You are offline. Pick both places by name to get a fare — a dropped pin
                  cannot be priced without a connection.
                </Text>
              </View>
            ) : locationFailure && !origin ? (
              <View style={s.locationFailure}>
                <Text style={s.locationHint}>{CURRENT_LOCATION_MESSAGES[locationFailure]}</Text>
                <Pressable
                  onPress={() => void useCurrentLocation()}
                  disabled={locating}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Text style={[s.retryText, locating && s.retryTextMuted]}>
                    {locating ? 'Finding your location…' : 'Use my location'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <PlacePickerField
            slot={activeField ?? 'destination'}
            query={query}
            recents={recents}
            originCoordinates={originPin}
            locating={locating}
            onSelect={selectPlace}
            // Both of these produce a dropped pin, and no offline source can
            // price one. Withdrawing them offline is the difference between a
            // rider being steered to the cached place list and being walked
            // into a dead end.
            onPickOnMap={isOnline ? () => armMapPick(activeField ?? 'destination') : undefined}
            onUseCurrentLocation={
              isOnline && (activeField ?? 'destination') === 'origin'
                ? () => void useCurrentLocation()
                : undefined
            }
          />
        </View>
      ) : null}

      {phase === 'fare' ? (
        <ScrollView
          contentContainerStyle={s.fareBody}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            style={({ pressed }) => [s.routeBar, pressed && s.pressedSurface]}
            onPress={() => editTrip('destination')}
            accessibilityRole="button"
            accessibilityLabel="Change the trip"
          >
            <Text style={s.routeText} numberOfLines={1}>
              <Text style={s.routePlace}>{origin ? selectionLabel(origin) : '—'}</Text>
              {'  →  '}
              <Text style={s.routePlace}>
                {destination ? selectionLabel(destination) : '—'}
              </Text>
            </Text>
            <Ionicons name="create-outline" size={17} color={colors.textMuted} />
          </Pressable>

          {calculating ? (
            <Placeholder>
              <ActivityIndicator color={colors.primary} />
              <Text style={s.placeholderText}>
                {isOnline ? 'Measuring the road route…' : 'Checking saved distances…'}
              </Text>
            </Placeholder>
          ) : routeError ? (
            <RouteErrorState
              error={routeError}
              onRetry={() => setRetryNonce((n) => n + 1)}
              onEditTrip={() => editTrip('destination')}
              onMovePin={() => armMapPick(routeError.access?.field ?? 'destination')}
              onUseDropoff={
                routeError.access
                  ? () =>
                      useDropoff(
                        routeError.access!.field,
                        {
                          lat: routeError.access!.dropoff.lat,
                          lng: routeError.access!.dropoff.lng,
                        },
                        routeError.access!.dropoff.label,
                      )
                  : undefined
              }
            />
          ) : sameSpot ? (
            <Placeholder>
              <Text style={s.placeholderTitle}>Same start and destination</Text>
              <Text style={s.placeholderText}>Pick two different places to see a fare.</Text>
            </Placeholder>
          ) : offlineUnpriced ? (
            <OfflineFareNotice
              farePolicy={cachedPolicy}
              onRetry={() => setRetryNonce((n) => n + 1)}
            />
          ) : result ? (
            <>
              <FareResultCard
                result={result}
                expanded={breakdownOpen}
                onToggleExpanded={() => setBreakdownOpen((open) => !open)}
                passengerLabel={passengerLabel}
                discountCardApplied={Boolean(discountCard)}
                onApplyForCard={() => router.push('/public/discount')}
              />

              <ActionChip
                icon="map-outline"
                label="View the route on the map"
                onPress={openRoutePreview}
              />

              {/* The fare covers the ride only; say where it ends. */}
              {result.dropoffNotices?.map((notice) => (
                <View key={`${notice.field}-${notice.lat}`} style={s.noticeCard}>
                  <View style={s.errorHead}>
                    <Ionicons name="footsteps" size={16} color={colors.walkTail} />
                    <Text style={s.noticeTitle}>Drop-off at {notice.label}</Text>
                  </View>
                  <Text style={s.errorBody}>
                    {notice.walkMeters} m walk to {notice.requestedLabel}.
                    {notice.note ? ` ${notice.note}` : ''}
                  </Text>
                </View>
              ))}
            </>
          ) : null}

          <Section label="Ride">
            <Pressable
              style={({ pressed }) => [s.rideRow, pressed && s.pressedSurface]}
              onPress={() => setPhase('vehicle')}
              accessibilityRole="button"
              accessibilityLabel="Change the ride type"
            >
              <Text style={s.rideRowText}>
                {vehicleType ? vehicleTypeLabel(vehicleType) : 'Not set'}
              </Text>
              <Text style={s.changeText}>Change</Text>
            </Pressable>
          </Section>

          <Section label="Driver">
            {selectedVehicle ? (
              <VehicleCard
                display={vehicleDisplay!}
                detail={vehicleDetail}
                onChange={() => { setSelectedVehicle(null); setSendError(null); }}
              />
            ) : (
              <View style={s.driverActions}>
                <ActionChip
                  icon="qr-code-outline"
                  label="Scan the driver’s QR code"
                  onPress={() => setQrScannerOpen(true)}
                />
                <Pressable
                  onPress={() => setVehiclePickerOpen(true)}
                  hitSlop={8}
                  style={s.plateLinkBtn}
                  accessibilityRole="button"
                >
                  <Text style={s.plateLink}>Enter the plate number instead</Text>
                </Pressable>
              </View>
            )}
          </Section>

          {result && !sameSpot ? (
            <View style={s.actions}>
              {saved ? (
                <View style={s.sentCard}>
                  <View style={s.sentHead}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.primaryDark} />
                    <Text style={s.sentTitle}>Trip request sent</Text>
                  </View>
                  <Text style={s.sentBody}>
                    The driver has 10 minutes to accept. Track it from the home screen.
                  </Text>
                  <Button
                    label="View trip status"
                    variant="secondary"
                    onPress={() => router.push('/public')}
                  />
                </View>
              ) : sendError ? (
                <View style={s.errorCard}>
                  <View style={s.errorHead}>
                    <Ionicons name="alert-circle" size={18} color={colors.warningDark} />
                    <Text style={s.errorTitle}>
                      {sendError.status === 409
                        ? 'This driver is not accepting trips'
                        : 'Request not sent'}
                    </Text>
                  </View>
                  <Text style={s.errorBody}>{sendError.message}</Text>
                  <View style={s.errorActions}>
                    <Button label="Try again" onPress={send} loading={saving} style={s.flex1} />
                    <Button
                      label="Another vehicle"
                      variant="secondary"
                      onPress={() => { setSelectedVehicle(null); setSendError(null); }}
                      style={s.flex1}
                    />
                  </View>
                </View>
              ) : (
                <>
                  <Button
                    label="Send trip request"
                    onPress={send}
                    loading={saving}
                    disabled={!selectedVehicle}
                  />
                  <Text style={s.ctaNote}>
                    {selectedVehicle
                      ? 'The driver has 10 minutes to accept.'
                      : 'Scan the driver’s QR code to send this trip.'}
                  </Text>
                </>
              )}
            </View>
          ) : null}
        </ScrollView>
      ) : null}

      {/* The map is a tool, not the page: it mounts only when it is asked for. */}
      <Modal
        visible={mapOpen}
        animationType="slide"
        onRequestClose={closeMap}
        presentationStyle="fullScreen"
      >
        <View style={s.mapModal}>
          <View style={[s.mapHeader, { paddingTop: insets.top + spacing.sm }]}>
            <Pressable
              onPress={closeMap}
              hitSlop={10}
              style={s.headerBack}
              accessibilityRole="button"
              accessibilityLabel="Close the map"
            >
              <Ionicons name="close" size={22} color={colors.textStrong} />
            </Pressable>
            <Text style={s.headerTitle} numberOfLines={1}>
              {activeSlot
                ? activeSlot === 'origin'
                  ? 'Tap your pickup point'
                  : 'Tap your drop-off point'
                : 'Route'}
            </Text>
            <View style={s.headerAction} />
          </View>

          {mapOpen ? (
            <InteractiveCalculatorMap
              originPin={originPin}
              destPin={destPin}
              snappedOrigin={result?.snappedOrigin ?? null}
              snappedDestination={result?.snappedDestination ?? null}
              polyline={result?.polyline ?? null}
              walkTail={walkTail}
              activeSlot={activeSlot}
              onMapPress={handleMapPress}
              onCancelPick={closeMap}
              topInset={insets.top + 56}
              bottomInset={insets.bottom + spacing.lg}
            />
          ) : null}
        </View>
      </Modal>

      <QRScannerModal
        visible={qrScannerOpen}
        onVehicleFound={pickVehicle}
        onClose={() => setQrScannerOpen(false)}
      />

      <VehiclePickerField
        selected={selectedVehicle}
        onSelect={pickVehicle}
        onClear={() => setSelectedVehicle(null)}
        open={vehiclePickerOpen}
        onClose={() => setVehiclePickerOpen(false)}
        hideTrigger
      />
    </View>
  );
}

/** A small-caps heading ruled across the remaining width. */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <Text style={text.sectionLabel}>{label}</Text>
        <View style={s.sectionRule} />
      </View>
      {children}
    </View>
  );
}

function VehicleCard({
  display,
  detail,
  onChange,
}: {
  display: string;
  detail: string | null;
  onChange: () => void;
}) {
  return (
    <View style={s.vehicleCard}>
      <View style={s.vehicleIcon}>
        <Ionicons name="car" size={18} color={colors.primaryDark} />
      </View>
      <View style={s.vehicleInfo}>
        <Text style={s.vehiclePlate}>{display}</Text>
        {detail ? (
          <Text style={s.vehicleDetail} numberOfLines={1}>{detail}</Text>
        ) : null}
      </View>
      <Pressable onPress={onChange} hitSlop={8} accessibilityRole="button">
        <Text style={s.changeText}>Change</Text>
      </Pressable>
    </View>
  );
}

function ActionChip({
  icon,
  label,
  onPress,
}: {
  icon: IoniconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [s.chip, pressed && s.pressedSurface]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={17} color={colors.textBody} />
      <Text style={s.chipText} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** Holds the fare view at a steady height so the layout does not jump between states. */
function Placeholder({ children }: { children: React.ReactNode }) {
  return <View style={s.placeholder}>{children}</View>;
}

function RouteErrorState({
  error,
  onRetry,
  onEditTrip,
  onMovePin,
  onUseDropoff,
}: {
  error: RouteError;
  onRetry: () => void;
  onEditTrip: () => void;
  onMovePin: () => void;
  onUseDropoff?: () => void;
}) {
  // A point past the end of the road is a boundary, not a failure: the screen
  // says where the ride stops and offers that point, mirroring the map.
  if (error.access && onUseDropoff) {
    return (
      <View style={s.accessCard}>
        <View style={s.errorHead}>
          <Ionicons name="footsteps" size={18} color={colors.walkTail} />
          <Text style={s.errorTitle}>Ride can’t reach this spot</Text>
        </View>
        <Text style={s.errorBody}>{error.message}</Text>

        <View style={s.dropoffRows}>
          <View style={s.dropoffRow}>
            <Text style={s.dropoffKey}>Drop-off</Text>
            <Text style={s.dropoffValue} numberOfLines={2}>
              {error.access.dropoff.label}
            </Text>
          </View>
          <View style={s.dropoffRow}>
            <Text style={s.dropoffKey}>Walk from there</Text>
            <Text style={s.dropoffValue}>{error.access.dropoff.walkMeters} m</Text>
          </View>
        </View>

        <Button label="Use this drop-off" onPress={onUseDropoff} />
        <Pressable onPress={onMovePin} accessibilityRole="button" hitSlop={8}>
          <Text style={s.secondaryAction}>Move the pin</Text>
        </Pressable>
      </View>
    );
  }

  const action =
    error.code === 'NO_ROAD_ROUTE_FOUND'
      ? { label: 'Move the pin', onPress: onMovePin }
      : error.code === 'INVALID_ROUTE_INPUT'
        ? { label: 'Change locations', onPress: onEditTrip }
        : { label: 'Try again', onPress: onRetry };

  return (
    <View style={s.errorCard}>
      <View style={s.errorHead}>
        <Ionicons name="alert-circle" size={18} color={colors.warningDark} />
        <Text style={s.errorTitle}>No fare yet</Text>
      </View>
      <Text style={s.errorBody}>{error.message}</Text>
      <Button label={action.label} onPress={action.onPress} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  pressedSurface: { backgroundColor: colors.surfaceAlt },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBack: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.textStrong },
  headerAction: { minWidth: 52, alignItems: 'flex-end', paddingRight: spacing.sm },
  headerActionText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },

  // Vehicle phase
  vehicleBody: { padding: spacing.lg, gap: spacing.lg },
  lede: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  rideCards: { flexDirection: 'row', gap: spacing.md },
  rideCard: {
    flex: 1,
    gap: 6,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  rideCardOn: { borderColor: colors.primary, backgroundColor: colors.surfaceTint },
  rideCardMuted: { opacity: 0.5 },
  rideIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  rideIconOn: { backgroundColor: colors.primary },
  rideLabel: { fontSize: 16, fontWeight: '700', color: colors.textStrong },
  rideHint: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  rideLockedNote: { fontSize: 12, color: colors.textMuted },

  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionRule: { flex: 1, height: 1, backgroundColor: colors.border },

  driverActions: { gap: spacing.xs },
  driverNote: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginTop: spacing.xs },
  plateLinkBtn: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' },
  plateLink: { fontSize: 13, fontWeight: '600', color: colors.info },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.textBody },

  // Trip phase
  tripBody: { flex: 1 },
  tripHead: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tripMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  farePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceTint,
  },
  farePillText: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  tripMetaText: { fontSize: 12, color: colors.textMuted },
  locationFailure: { gap: 2 },
  locationHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  retryText: { fontSize: 13, fontWeight: '700', color: colors.primary, paddingVertical: 4 },
  retryTextMuted: { color: colors.textFaint },

  // Fare phase
  fareBody: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  routeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  routeText: { flex: 1, fontSize: 14, color: colors.textFaint },
  routePlace: { fontWeight: '700', color: colors.textStrong },
  rideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rideRowText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textStrong },

  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  vehicleIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleInfo: { flex: 1 },
  vehiclePlate: { fontSize: 15, fontWeight: '700', color: colors.textStrong },
  vehicleDetail: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  changeText: { fontSize: 13, fontWeight: '600', color: colors.info, padding: 6 },

  // Map modal
  mapModal: { flex: 1, backgroundColor: colors.bg },
  mapHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  placeholder: { minHeight: 96, justifyContent: 'center', gap: 6 },
  placeholderTitle: { ...text.heading },
  placeholderText: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },

  actions: { gap: spacing.sm },
  ctaNote: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  flex1: { flex: 1 },

  sentCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceTint,
  },
  sentHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sentTitle: { fontSize: 15, fontWeight: '700', color: colors.primaryDark },
  sentBody: { fontSize: 13, color: colors.textBody, lineHeight: 18 },

  errorCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  errorHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorTitle: { fontSize: 15, fontWeight: '700', color: colors.textStrong },
  errorBody: { fontSize: 13, color: colors.textBody, lineHeight: 18 },
  errorActions: { flexDirection: 'row', gap: spacing.sm },

  // Ride-access block: graphite, not red — the trip is possible, just shorter.
  accessCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.surfaceAlt,
  },
  dropoffRows: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.rule,
  },
  dropoffRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  dropoffKey: { flex: 1, fontSize: 13, color: colors.textMuted },
  dropoffValue: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textStrong, textAlign: 'right' },
  noticeCard: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    backgroundColor: colors.surfaceAlt,
  },
  noticeTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textStrong },
  secondaryAction: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
