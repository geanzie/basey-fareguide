import { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import MapView, { Marker, Polyline, type MapPressEvent, type Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadow, spacing } from '@/ui/theme';

interface Coord {
  lat: number;
  lng: number;
}

/** The stretch from a drop-off to a point only reachable on foot. */
export interface WalkTail {
  from: Coord;
  to: Coord;
  walkMeters: number;
  label: string;
}

interface Props {
  originPin: Coord | null;
  destPin: Coord | null;
  snappedOrigin: Coord | null;
  snappedDestination: Coord | null;
  polyline: string | null;
  /** Drawn when the requested point is past where a ride can go. */
  walkTail?: WalkTail | null;
  /** Which end a map tap fills. Null means taps are inert. */
  activeSlot: 'origin' | 'destination' | null;
  onMapPress: (coord: Coord) => void;
  /** Called when the armed slot is dismissed from the on-map hint. */
  onCancelPick?: () => void;
  /** Height of the fare sheet covering the bottom of the map, so the route frames above it. */
  bottomInset?: number;
  /** Height of the trip panel covering the top of the map. */
  topInset?: number;
}

/** Decodes a Google-encoded polyline string into lat/lng pairs. */
function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const coords: { latitude: number; longitude: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte: number;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return coords;
}

const BASEY_REGION: Region = {
  latitude: 11.2800,
  longitude: 125.0700,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

/** A close-in region around one point, for when there is nothing to fit between. */
function regionAround(point: { latitude: number; longitude: number }): Region {
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };
}

export default function InteractiveCalculatorMap({
  originPin,
  destPin,
  snappedOrigin,
  snappedDestination,
  polyline,
  walkTail = null,
  activeSlot,
  onMapPress,
  onCancelPick,
  bottomInset = 0,
  topInset = 0,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const polylineCoords = polyline ? decodePolyline(polyline) : [];

  const originCoord = snappedOrigin
    ? { latitude: snappedOrigin.lat, longitude: snappedOrigin.lng }
    : originPin
      ? { latitude: originPin.lat, longitude: originPin.lng }
      : null;

  const destCoord = snappedDestination
    ? { latitude: snappedDestination.lat, longitude: snappedDestination.lng }
    : destPin
      ? { latitude: destPin.lat, longitude: destPin.lng }
      : null;

  const walkTailCoords = walkTail
    ? [
        { latitude: walkTail.from.lat, longitude: walkTail.from.lng },
        { latitude: walkTail.to.lat, longitude: walkTail.to.lng },
      ]
    : [];

  const framed = [
    ...polylineCoords,
    ...walkTailCoords,
    ...(originCoord ? [originCoord] : []),
    ...(destCoord ? [destCoord] : []),
  ];
  const hasSomethingToFrame = framed.length > 0;

  const recenter = useCallback(() => {
    if (framed.length === 0) return;
    if (framed.length === 1) {
      mapRef.current?.animateToRegion(regionAround(framed[0]), 450);
      return;
    }
    // Pad past the fare sheet so the route frames in the visible strip of map,
    // not behind the panel covering the bottom of it.
    mapRef.current?.fitToCoordinates(framed, {
      edgePadding: {
        top: Math.round(topInset) + 48,
        right: 56,
        bottom: Math.round(bottomInset) + 48,
        left: 56,
      },
      animated: true,
    });
  }, [framed, bottomInset, topInset]);

  // Frame whatever is drawn whenever it changes. Without this the camera stays
  // on the municipality-wide initial region and a route picked by search can
  // land entirely off-screen. Keyed on the coordinates, not the array identity.
  const frameKey = [
    polyline ?? '',
    walkTail ? `${walkTail.from.lat},${walkTail.from.lng}->${walkTail.to.lat},${walkTail.to.lng}` : '',
    originCoord ? `${originCoord.latitude},${originCoord.longitude}` : '',
    destCoord ? `${destCoord.latitude},${destCoord.longitude}` : '',
  ].join('|');

  useEffect(() => {
    if (!hasSomethingToFrame) return;
    recenter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey]);

  const handlePress = (e: MapPressEvent) => {
    // Taps only mean something while a slot is armed for them.
    if (activeSlot === null) return;
    const { latitude, longitude } = e.nativeEvent.coordinate;
    onMapPress({ lat: latitude, lng: longitude });
  };

  return (
    <View style={s.container}>
      {/*
        No UrlTile: the platform map SDK draws the basemap itself. This used to
        overlay CARTO raster tiles, but CARTO now requires an API key and serves
        unauthenticated tiles stamped "API KEY REQUIRED". The native basemap
        needs no key in Expo Go and uses the restricted GOOGLE_MAPS_API_KEY in
        real builds, and it matches RouteMapView.
      */}
      <MapView
        ref={mapRef}
        style={s.map}
        initialRegion={BASEY_REGION}
        onPress={handlePress}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {polylineCoords.length > 0 && (
          <Polyline coordinates={polylineCoords} strokeColor={colors.primary} strokeWidth={4} />
        )}

        {/*
          The ride ends at the drop-off; the dashes carry on to the pin the
          rider chose, so the map says where walking starts without a legend.
        */}
        {walkTailCoords.length === 2 && (
          <Polyline
            coordinates={walkTailCoords}
            strokeColor={colors.walkTail}
            strokeWidth={3}
            lineDashPattern={[5, 7]}
          />
        )}

        {walkTail && (
          <Marker
            coordinate={walkTailCoords[0]}
            title={walkTail.label}
            description={`${walkTail.walkMeters} m walk from here`}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={s.dropoffDot} />
          </Marker>
        )}

        {originCoord && (
          <Marker coordinate={originCoord} pinColor={colors.warning} title="Start" />
        )}
        {destCoord && (
          <Marker coordinate={destCoord} pinColor={colors.primary} title="Destination" />
        )}
      </MapView>

      {activeSlot ? (
        <View style={[s.pickHint, { top: topInset + spacing.sm }]} pointerEvents="box-none">
          <Ionicons name="location" size={15} color={colors.primary} />
          <Text style={s.pickHintText}>
            {activeSlot === 'origin'
              ? 'Tap the map to set the starting point'
              : 'Tap the map to set the destination'}
          </Text>
          {onCancelPick ? (
            <Pressable onPress={onCancelPick} hitSlop={10} accessibilityRole="button">
              <Text style={s.pickHintCancel}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
      ) : hasSomethingToFrame ? (
        <Pressable
          style={({ pressed }) => [
            s.recenterBtn,
            { top: topInset + spacing.sm },
            pressed && s.recenterBtnPressed,
          ]}
          onPress={recenter}
          accessibilityRole="button"
          accessibilityLabel="Recenter the map on the route"
        >
          <Ionicons name="locate" size={15} color={colors.textBody} />
          <Text style={s.recenterText}>Recenter</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  dropoffDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.walkTail,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  container: { flex: 1, position: 'relative' },
  map: { flex: 1 },

  recenterBtn: {
    position: 'absolute',
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  recenterBtnPressed: { backgroundColor: colors.surfaceAlt },
  recenterText: { fontSize: 13, fontWeight: '600', color: colors.textBody },

  pickHint: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  pickHintText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textStrong },
  pickHintCancel: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
});
