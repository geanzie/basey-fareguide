import { useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import MapView, { Marker, Polyline, UrlTile, type MapPressEvent } from 'react-native-maps';

interface Props {
  originPin: { lat: number; lng: number } | null;
  destPin: { lat: number; lng: number } | null;
  snappedOrigin: { lat: number; lng: number } | null;
  snappedDestination: { lat: number; lng: number } | null;
  polyline: string | null;
  pickMode: 'origin' | 'destination' | 'done';
  onMapPress: (coord: { lat: number; lng: number }) => void;
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

const BASEY_REGION = {
  latitude: 11.2800,
  longitude: 125.0700,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function InteractiveCalculatorMap({
  originPin,
  destPin,
  snappedOrigin,
  snappedDestination,
  polyline,
  pickMode,
  onMapPress,
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

  const handlePress = (e: MapPressEvent) => {
    if (pickMode === 'done') return;
    const { latitude, longitude } = e.nativeEvent.coordinate;
    onMapPress({ lat: latitude, lng: longitude });
  };

  const zoomIn = () => {
    mapRef.current?.getCamera().then((cam) => {
      mapRef.current?.animateCamera({ zoom: (cam.zoom ?? 13) + 1 });
    });
  };

  const zoomOut = () => {
    mapRef.current?.getCamera().then((cam) => {
      mapRef.current?.animateCamera({ zoom: (cam.zoom ?? 13) - 1 });
    });
  };

  return (
    <View style={s.container}>
      <MapView
        ref={mapRef}
        style={s.map}
        initialRegion={BASEY_REGION}
        onPress={handlePress}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <UrlTile
          urlTemplate="https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
          shouldReplaceMapContent
        />

        {polylineCoords.length > 0 && (
          <Polyline coordinates={polylineCoords} strokeColor="#16a34a" strokeWidth={4} />
        )}

        {originCoord && (
          <Marker coordinate={originCoord} pinColor="#f97316" title="Origin" />
        )}
        {destCoord && (
          <Marker coordinate={destCoord} pinColor="#16a34a" title="Destination" />
        )}
      </MapView>

      {/* Zoom controls */}
      <View style={s.zoomControls}>
        <Pressable style={s.zoomBtn} onPress={zoomIn}>
          <Text style={s.zoomBtnText}>+</Text>
        </Pressable>
        <Pressable style={s.zoomBtn} onPress={zoomOut}>
          <Text style={s.zoomBtnText}>−</Text>
        </Pressable>
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  zoomControls: {
    position: 'absolute',
    top: 12,
    left: 12,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    elevation: 3,
  },
  zoomBtn: {
    width: 36,
    height: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  zoomBtnText: { fontSize: 20, fontWeight: '300', color: '#0f172a', lineHeight: 22 },
});
