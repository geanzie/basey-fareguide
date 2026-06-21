import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { calculateRoute, saveFareCalculation } from '@/services/fare';
import LocationSelector, { type PinCoords } from '@/components/LocationSelector';
import FareResultCard from '@/components/FareResultCard';
import type { RouteCalculationResponse } from '@/types/fare';

type DiscountType = 'NONE' | 'STUDENT' | 'SENIOR_CITIZEN' | 'PWD';

const DISCOUNTS: { label: string; value: DiscountType }[] = [
  { label: 'Regular', value: 'NONE' },
  { label: 'Student', value: 'STUDENT' },
  { label: 'Senior', value: 'SENIOR_CITIZEN' },
  { label: 'PWD', value: 'PWD' },
];

export default function CalculatorScreen() {
  const [origin, setOrigin] = useState<PinCoords | null>(null);
  const [destination, setDestination] = useState<PinCoords | null>(null);
  const [discount, setDiscount] = useState<DiscountType>('NONE');
  const [result, setResult] = useState<RouteCalculationResponse | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const getGPS = async (setPin: (p: PinCoords) => void) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location access is needed to use GPS.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setPin({
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      label: 'My Location',
    });
  };

  const calculate = async () => {
    if (!origin || !destination) {
      Alert.alert('Missing', 'Select both origin and destination.');
      return;
    }
    setCalculating(true);
    setResult(null);
    setSaved(false);
    try {
      const res = await calculateRoute({
        originLat: origin.lat,
        originLng: origin.lng,
        destinationLat: destination.lat,
        destinationLng: destination.lng,
        discountType: discount,
      });
      setResult(res);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Calculation failed.');
    } finally {
      setCalculating(false);
    }
  };

  const save = async () => {
    if (!result || !origin || !destination) return;
    setSaving(true);
    try {
      await saveFareCalculation({
        originLat: origin.lat,
        originLng: origin.lng,
        originLabel: origin.label,
        destinationLat: destination.lat,
        destinationLng: destination.lng,
        destinationLabel: destination.label,
        distanceKm: result.distanceKm,
        fare: result.fare,
        discountType: discount,
        isEstimate: result.isEstimate,
      });
      setSaved(true);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save trip.');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setOrigin(null);
    setDestination(null);
    setDiscount('NONE');
    setResult(null);
    setSaved(false);
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Fare Calculator</Text>

        <LocationSelector
          label="Origin"
          selected={origin}
          onSelect={setOrigin}
          onUseGPS={() => getGPS(setOrigin)}
        />
        <LocationSelector
          label="Destination"
          selected={destination}
          onSelect={setDestination}
          onUseGPS={() => getGPS(setDestination)}
        />

        <Text style={s.discountLabel}>Passenger Type</Text>
        <View style={s.discountRow}>
          {DISCOUNTS.map((d) => (
            <Pressable
              key={d.value}
              style={[s.chip, discount === d.value && s.chipActive]}
              onPress={() => { setDiscount(d.value); setResult(null); setSaved(false); }}
            >
              <Text style={[s.chipText, discount === d.value && s.chipTextActive]}>
                {d.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [s.calcBtn, pressed && s.calcBtnPressed, calculating && s.calcBtnDisabled]}
          onPress={calculate}
          disabled={calculating}
        >
          {calculating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.calcBtnText}>Calculate Fare</Text>
          )}
        </Pressable>

        {result && origin && destination && (
          <View style={s.resultSection}>
            <FareResultCard result={result} originLabel={origin.label} destinationLabel={destination.label} />

            <View style={s.actionRow}>
              {!saved ? (
                <Pressable
                  style={[s.saveBtn, saving && s.saveBtnDisabled]}
                  onPress={save}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={s.saveBtnText}>Save Trip</Text>
                  )}
                </Pressable>
              ) : (
                <View style={s.savedBadge}>
                  <Text style={s.savedText}>Trip saved!</Text>
                </View>
              )}
              <Pressable style={s.resetBtn} onPress={reset}>
                <Text style={s.resetBtnText}>Reset</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 20 },
  discountLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  discountRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  chip: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#16a34a' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  chipTextActive: { color: '#fff' },
  calcBtn: { backgroundColor: '#16a34a', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 24 },
  calcBtnPressed: { opacity: 0.85 },
  calcBtnDisabled: { opacity: 0.6 },
  calcBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  resultSection: { gap: 12 },
  actionRow: { flexDirection: 'row', gap: 10 },
  saveBtn: { flex: 1, backgroundColor: '#0f172a', borderRadius: 12, padding: 14, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  savedBadge: { flex: 1, backgroundColor: '#dcfce7', borderRadius: 12, padding: 14, alignItems: 'center' },
  savedText: { color: '#16a34a', fontWeight: '700' },
  resetBtn: { borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  resetBtnText: { color: '#64748b', fontWeight: '600' },
});
