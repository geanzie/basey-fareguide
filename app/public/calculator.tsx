import { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import GradientHeader from '@/ui/GradientHeader';
import Button from '@/ui/Button';
import Card from '@/ui/Card';
import { colors, radii, spacing } from '@/ui/theme';
import { calculateRoute, saveFareCalculation } from '@/services/fare';
import { useFeedback } from '@/ui/FeedbackProvider';
import InteractiveCalculatorMap from '@/components/InteractiveCalculatorMap';
import FareResultCard from '@/components/FareResultCard';
import VehiclePickerField from '@/components/VehiclePickerField';
import QRScannerModal from '@/components/QRScannerModal';
import type { RouteCalculationResponse, VehicleLookup } from '@/types/fare';

type PickMode = 'origin' | 'destination' | 'done';
type IoniconName = keyof typeof Ionicons.glyphMap;

const STEP_LABELS = ['Vehicle', 'Origin', 'Destination', 'Fare'] as const;

export default function CalculatorScreen() {
  const { showError, showWarning } = useFeedback();
  const [pickMode, setPickMode] = useState<PickMode>('origin');
  const [originPin, setOriginPin] = useState<{ lat: number; lng: number } | null>(null);
  const [destPin, setDestPin] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleLookup | null>(null);
  const [result, setResult] = useState<RouteCalculationResponse | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false);

  const handleMapPress = async (coord: { lat: number; lng: number }) => {
    if (pickMode === 'origin') {
      setOriginPin(coord);
      setResult(null);
      setSaved(false);
      setPickMode('destination');
    } else if (pickMode === 'destination') {
      setDestPin(coord);
      setPickMode('done');
      await runCalculation(originPin!, coord);
    }
  };

  const runCalculation = async (
    origin: { lat: number; lng: number },
    dest: { lat: number; lng: number },
  ) => {
    setCalculating(true);
    setResult(null);
    setSaved(false);
    try {
      const res = await calculateRoute({
        originLat: origin.lat,
        originLng: origin.lng,
        destinationLat: dest.lat,
        destinationLng: dest.lng,
        discountType: 'NONE',
      });
      setResult(res);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Calculation failed.');
      setPickMode('destination');
    } finally {
      setCalculating(false);
    }
  };

  const save = async () => {
    if (!result || !originPin || !destPin) return;
    if (!selectedVehicle) {
      showWarning('Scan operator QR or search manually to select a vehicle first.', { title: 'Select Vehicle' });
      return;
    }
    if (!selectedVehicle.id) {
      showError('Vehicle ID missing. Re-select the vehicle.');
      return;
    }
    setSaving(true);
    try {
      const response = await saveFareCalculation({
        originLat: originPin.lat,
        originLng: originPin.lng,
        originLabel: result.origin,
        destinationLat: destPin.lat,
        destinationLng: destPin.lng,
        destinationLabel: result.destination,
        distanceKm: result.distanceKm,
        fare: result.fare,
        discountType: 'NONE',
        isEstimate: result.isEstimate,
        vehicleId: selectedVehicle.id!,
        method: result.method,
        provider: result.provider,
        polyline: result.polyline,
        farePolicySnapshot: result.farePolicy,
      });
      if (!response.success) {
        showError('Trip request could not be submitted. Please try again.');
        return;
      }
      setSaved(true);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not send trip request.');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setPickMode('origin');
    setOriginPin(null);
    setDestPin(null);
    setResult(null);
    setSaved(false);
  };

  const vehicleDisplay = selectedVehicle
    ? (selectedVehicle.permitPlateNumber ?? selectedVehicle.plateNumber ?? 'Selected Vehicle')
    : null;

  // Step completion drives the indicator + instruction line.
  const done = [Boolean(selectedVehicle), Boolean(originPin), Boolean(destPin), Boolean(result)];
  const activeStep = done.findIndex((d) => !d); // -1 when all complete

  return (
    <View style={s.root}>
      <GradientHeader title="Fare Calculator" subtitle="Tap the map to set your trip" compact />

      <View style={s.topSection}>
        <StepIndicator done={done} activeStep={activeStep} />

        {vehicleDisplay ? (
          <Card style={s.vehicleCard}>
            <View style={s.vehicleIcon}>
              <Ionicons name="car" size={20} color={colors.primary} />
            </View>
            <View style={s.vehicleInfo}>
              <Text style={s.vehiclePlate}>{vehicleDisplay}</Text>
              {selectedVehicle!.vehicleType ? (
                <Text style={s.vehicleType}>{selectedVehicle!.vehicleType}</Text>
              ) : null}
            </View>
            <Button label="Change" variant="ghost" size="sm" onPress={() => setSelectedVehicle(null)} />
          </Card>
        ) : (
          <View style={s.vehicleBtns}>
            <Button
              label="Scan operator QR"
              onPress={() => setQrScannerOpen(true)}
              style={s.flex1}
            />
            <Button
              label="Search"
              variant="secondary"
              onPress={() => setVehiclePickerOpen(true)}
            />
          </View>
        )}

        {pickMode !== 'done' && (
          <View style={s.instructionRow}>
            <Ionicons
              name="location"
              size={16}
              color={pickMode === 'origin' ? colors.warning : colors.primary}
            />
            <Text style={s.instructionText}>
              {pickMode === 'origin'
                ? 'Tap map to drop origin pin.'
                : 'Tap map to drop destination pin.'}
            </Text>
          </View>
        )}
      </View>

      <View style={s.mapWrapper}>
        <InteractiveCalculatorMap
          originPin={originPin}
          destPin={destPin}
          snappedOrigin={result?.snappedOrigin ?? null}
          snappedDestination={result?.snappedDestination ?? null}
          polyline={result?.polyline ?? null}
          pickMode={pickMode}
          onMapPress={handleMapPress}
        />

        {calculating && (
          <View style={s.calculatingOverlay}>
            <ActivityIndicator color={colors.onPrimary} size="large" />
            <Text style={s.calculatingText}>Calculating route…</Text>
          </View>
        )}

        {result && (
          <BlurView intensity={40} tint="light" style={s.glassPanel}>
            <View style={s.glassPanelInner}>
              <View style={s.resultSection}>
                <FareResultCard
                  result={result}
                  originLabel={result.origin}
                  destinationLabel={result.destination}
                />

                <View style={s.actionCol}>
                  {!saved ? (
                    <>
                      {!selectedVehicle && (
                        <Text style={s.vehicleHint}>
                          Scan QR or search manually to send a trip request
                        </Text>
                      )}
                      <Button
                        label="Send Trip Request"
                        onPress={save}
                        loading={saving}
                        disabled={!selectedVehicle}
                      />
                    </>
                  ) : (
                    <View style={s.savedBadge}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                      <Text style={s.savedText}>Trip request sent!</Text>
                    </View>
                  )}
                  <Button label="Reset" variant="secondary" onPress={reset} />
                </View>
              </View>
            </View>
          </BlurView>
        )}
      </View>

      <QRScannerModal
        visible={qrScannerOpen}
        onVehicleFound={(v) => { setSelectedVehicle(v); setQrScannerOpen(false); }}
        onClose={() => setQrScannerOpen(false)}
      />

      <VehiclePickerField
        selected={selectedVehicle}
        onSelect={(v) => { setSelectedVehicle(v); setVehiclePickerOpen(false); }}
        onClear={() => setSelectedVehicle(null)}
        open={vehiclePickerOpen}
        onClose={() => setVehiclePickerOpen(false)}
        hideTrigger
      />
    </View>
  );
}

function StepIndicator({ done, activeStep }: { done: boolean[]; activeStep: number }) {
  return (
    <View style={s.steps}>
      {STEP_LABELS.map((label, i) => {
        const isDone = done[i];
        const isActive = i === activeStep;
        const tone = isDone ? colors.primary : isActive ? colors.warning : colors.border;
        const icon: IoniconName = isDone ? 'checkmark' : (['car', 'location', 'flag', 'cash'] as IoniconName[])[i];
        return (
          <View key={label} style={s.step}>
            {i > 0 ? <View style={[s.stepLine, { backgroundColor: done[i - 1] ? colors.primary : colors.border }]} /> : <View style={s.stepLineSpacer} />}
            <View style={[s.stepDot, { backgroundColor: isDone ? colors.primary : colors.surface, borderColor: tone }]}>
              <Ionicons name={icon} size={13} color={isDone ? colors.onPrimary : tone} />
            </View>
            <Text style={[s.stepLabel, { color: isActive || isDone ? colors.textStrong : colors.textFaint }]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topSection: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.md },

  steps: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center' },
  stepLine: { position: 'absolute', top: 13, right: '50%', width: '100%', height: 2 },
  stepLineSpacer: { height: 2 },
  stepDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  stepLabel: { fontSize: 11, fontWeight: '600', marginTop: 4 },

  vehicleBtns: { flexDirection: 'row', gap: spacing.sm },
  flex1: { flex: 1 },
  vehicleCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  vehicleIcon: { width: 38, height: 38, borderRadius: radii.md, backgroundColor: colors.surfaceTint, alignItems: 'center', justifyContent: 'center' },
  vehicleInfo: { flex: 1 },
  vehiclePlate: { fontSize: 15, fontWeight: '700', color: colors.textStrong },
  vehicleType: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  instructionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  instructionText: { fontSize: 13, fontWeight: '600', color: colors.textBody },

  mapWrapper: { flex: 1, position: 'relative' },
  calculatingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  calculatingText: { color: colors.onPrimary, fontWeight: '600', fontSize: 14 },
  glassPanel: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  glassPanelInner: { backgroundColor: 'rgba(255,255,255,0.94)', padding: 14, paddingBottom: 28 },
  resultSection: { gap: spacing.md },
  vehicleHint: { fontSize: 12, color: colors.warning, textAlign: 'center', marginBottom: spacing.sm },
  actionCol: { gap: spacing.sm },
  savedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.surfaceTint, borderRadius: radii.md, padding: 14 },
  savedText: { color: colors.primary, fontWeight: '700' },
});
