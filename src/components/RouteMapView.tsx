import { View, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

interface Props {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  snappedOrigin: { lat: number; lng: number } | null;
  snappedDestination: { lat: number; lng: number } | null;
  polyline: string | null;
}

/** Decodes a Google-encoded polyline string into lat/lng pairs. */
function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const coords: { latitude: number; longitude: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return coords;
}

export default function RouteMapView({
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  snappedOrigin,
  snappedDestination,
  polyline,
}: Props) {
  if (!polyline) return null;

  const coords = decodePolyline(polyline);
  if (coords.length === 0) return null;

  const originCoord = snappedOrigin
    ? { latitude: snappedOrigin.lat, longitude: snappedOrigin.lng }
    : { latitude: originLat, longitude: originLng };

  const destCoord = snappedDestination
    ? { latitude: snappedDestination.lat, longitude: snappedDestination.lng }
    : { latitude: destinationLat, longitude: destinationLng };

  const midLat = (originCoord.latitude + destCoord.latitude) / 2;
  const midLng = (originCoord.longitude + destCoord.longitude) / 2;
  const latDelta = Math.abs(originCoord.latitude - destCoord.latitude) * 1.5 + 0.01;
  const lngDelta = Math.abs(originCoord.longitude - destCoord.longitude) * 1.5 + 0.01;

  return (
    <View style={s.container}>
      <MapView
        style={s.map}
        initialRegion={{
          latitude: midLat,
          longitude: midLng,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Polyline
          coordinates={coords}
          strokeColor="#16a34a"
          strokeWidth={4}
        />
        <Marker coordinate={originCoord} pinColor="#0f172a" />
        <Marker coordinate={destCoord} pinColor="#16a34a" />
      </MapView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    height: 200,
    backgroundColor: '#e2e8f0',
  },
  map: { flex: 1 },
});
