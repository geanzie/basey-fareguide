import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  FlatList,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import GradientHeader from '@/ui/GradientHeader';
import { createIncident } from '@/services/incidents';
import { fetchFareHistory } from '@/services/fare';
import { useAuthStore } from '@/store/authStore';
import { useFeedback } from '@/ui/FeedbackProvider';
import type { IncidentType } from '@/types/incidents';
import type { FareCalculation } from '@/types/fare';

export const INCIDENT_TYPES: { label: string; value: IncidentType }[] = [
  { label: 'Fare Overcharge', value: 'FARE_OVERCHARGE' },
  { label: 'Fare Undercharge', value: 'FARE_UNDERCHARGE' },
  { label: 'Reckless Driving', value: 'RECKLESS_DRIVING' },
  { label: 'Vehicle Violation', value: 'VEHICLE_VIOLATION' },
  { label: 'Route Violation', value: 'ROUTE_VIOLATION' },
  { label: 'Other', value: 'OTHER' },
];

export default function ReportScreen() {
  const { token } = useAuthStore();
  const { showSuccess, showError, showWarning } = useFeedback();
  const [incidentType, setIncidentType] = useState<IncidentType | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [evidenceUri, setEvidenceUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [recentTrips, setRecentTrips] = useState<FareCalculation[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<FareCalculation | null>(null);
  const [showTripPicker, setShowTripPicker] = useState(false);
  const [loadingTrips, setLoadingTrips] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchFareHistory(1, 10);
        setRecentTrips(res.items);
      } catch {
        setRecentTrips([]);
      } finally {
        setLoadingTrips(false);
      }
    })();
  }, []);

  const pickEvidence = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showWarning('Allow access to photos to attach evidence.', { title: 'Permission Required' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setEvidenceUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!token) {
      showWarning('You must be logged in to submit a report.', { title: 'Authentication Required' });
      return;
    }
    if (!incidentType) { showWarning('Select an incident type.', { title: 'Required' }); return; }
    if (!description.trim()) { showWarning('Enter a description.', { title: 'Required' }); return; }
    if (!location.trim()) { showWarning('Enter the location.', { title: 'Required' }); return; }

    const tripVehicle = selectedTrip?.vehicle?.hasVehicleContext ? selectedTrip.vehicle : null;

    setSubmitting(true);
    try {
      await createIncident(
        {
          incidentType,
          description: description.trim(),
          location: location.trim(),
          plateNumber: tripVehicle?.plateNumber ?? undefined,
          vehicleId: tripVehicle?.id,
          fareCalculationId: selectedTrip?.id,
          incidentDate: new Date().toISOString(),
        },
        evidenceUri ?? undefined,
      );
      showSuccess('Report submitted. Thank you for helping keep Basey safe!', { title: 'Report Submitted' });
      setIncidentType(null);
      setDescription('');
      setLocation('');
      setEvidenceUri(null);
      setSelectedTrip(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.container}>
      <GradientHeader title="Report Incident" subtitle="Help enforce municipal fare standards" />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>Incident Type</Text>
        <View style={s.typeGrid}>
          {INCIDENT_TYPES.map((t) => (
            <Pressable
              key={t.value}
              style={[s.typeChip, incidentType === t.value && s.typeChipActive]}
              onPress={() => setIncidentType(t.value)}
            >
              <Text style={[s.typeChipText, incidentType === t.value && s.typeChipTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>Link to Recent Trip</Text>
        {loadingTrips ? (
          <ActivityIndicator color="#16a34a" style={s.tripsLoader} />
        ) : recentTrips.length === 0 ? (
          <View style={s.noTrips}>
            <Text style={s.noTripsText}>No recent trips found.</Text>
          </View>
        ) : (
          <>
            <Pressable style={s.tripSelector} onPress={() => setShowTripPicker(true)}>
              {selectedTrip ? (
                <View style={s.tripSelectorInner}>
                  <Text style={s.tripSelectorMain} numberOfLines={1}>
                    {selectedTrip.originLabel} → {selectedTrip.destinationLabel}
                  </Text>
                  <Text style={s.tripSelectorSub}>
                    ₱{selectedTrip.fare.toFixed(2)} · {new Date(selectedTrip.createdAt).toLocaleDateString('en-PH')}
                  </Text>
                </View>
              ) : (
                <Text style={s.tripSelectorPlaceholder}>Select trip (required if you have recent trips)</Text>
              )}
              <Text style={s.tripSelectorArrow}>›</Text>
            </Pressable>

            {selectedTrip && selectedTrip.vehicle?.hasVehicleContext && (
              <View style={s.vehicleCard}>
                <Text style={s.vehicleCardLabel}>Vehicle auto-tagged from trip</Text>
                <Text style={s.vehicleCardPlate}>
                  {selectedTrip.vehicle.plateNumber ?? selectedTrip.vehicle.permitPlateNumber ?? 'Unknown plate'}
                </Text>
                {selectedTrip.vehicle.vehicleType ? (
                  <Text style={s.vehicleCardType}>{selectedTrip.vehicle.vehicleType}</Text>
                ) : null}
              </View>
            )}

            {selectedTrip && (
              <Pressable style={s.clearTrip} onPress={() => setSelectedTrip(null)}>
                <Text style={s.clearTripText}>Clear trip selection</Text>
              </Pressable>
            )}
          </>
        )}

        <Text style={s.label}>Description</Text>
        <TextInput
          style={[s.input, s.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe what happened..."
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={s.label}>Location</Text>
        <TextInput
          style={s.input}
          value={location}
          onChangeText={setLocation}
          placeholder="Where did this happen?"
          placeholderTextColor="#94a3b8"
          returnKeyType="done"
        />

        <Text style={s.label}>Evidence Photo / Video (optional)</Text>
        {evidenceUri ? (
          <View style={s.evidencePreview}>
            <Image source={{ uri: evidenceUri }} style={s.evidenceThumb} resizeMode="cover" />
            <Pressable style={s.removeEvidence} onPress={() => setEvidenceUri(null)}>
              <Text style={s.removeEvidenceText}>Remove</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={s.evidencePickerBtn} onPress={pickEvidence}>
            <Text style={s.evidencePickerBtnText}>+ Add Photo / Video</Text>
          </Pressable>
        )}

        <Pressable
          style={[s.submitBtn, submitting && s.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.submitBtnText}>Submit Report</Text>
          )}
        </Pressable>
      </ScrollView>

      <Modal
        visible={showTripPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTripPicker(false)}
      >
        <SafeAreaView style={s.modalContainer}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Select Trip</Text>
            <Pressable onPress={() => setShowTripPicker(false)}>
              <Text style={s.modalCancel}>Cancel</Text>
            </Pressable>
          </View>
          <FlatList
            data={recentTrips}
            keyExtractor={(t) => t.id}
            contentContainerStyle={s.tripList}
            renderItem={({ item }) => (
              <Pressable
                style={[s.tripItem, selectedTrip?.id === item.id && s.tripItemSelected]}
                onPress={() => { setSelectedTrip(item); setShowTripPicker(false); }}
              >
                <Text style={s.tripItemMain} numberOfLines={1}>
                  {item.originLabel} → {item.destinationLabel}
                </Text>
                <Text style={s.tripItemSub}>
                  ₱{item.fare.toFixed(2)} · {(item.distanceKm ?? 0).toFixed(1)} km · {new Date(item.createdAt).toLocaleDateString('en-PH')}
                </Text>
                {item.vehicle?.hasVehicleContext && (
                  <Text style={s.tripItemVehicle}>
                    {item.vehicle.plateNumber ?? item.vehicle.permitPlateNumber ?? ''}{item.vehicle.vehicleType ? ` · ${item.vehicle.vehicleType}` : ''}
                  </Text>
                )}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingTop: 20, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#e2e8f0' },
  typeChipActive: { backgroundColor: '#dc2626' },
  typeChipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  typeChipTextActive: { color: '#fff' },
  tripsLoader: { marginBottom: 16 },
  noTrips: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  noTripsText: { color: '#94a3b8', fontSize: 13 },
  tripSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  tripSelectorInner: { flex: 1 },
  tripSelectorMain: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  tripSelectorSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  tripSelectorPlaceholder: { flex: 1, fontSize: 14, color: '#94a3b8' },
  tripSelectorArrow: { fontSize: 20, color: '#94a3b8', marginLeft: 8 },
  vehicleCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  vehicleCardLabel: { fontSize: 11, color: '#16a34a', fontWeight: '600', marginBottom: 4 },
  vehicleCardPlate: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  vehicleCardType: { fontSize: 12, color: '#64748b', marginTop: 2 },
  clearTrip: { marginBottom: 20 },
  clearTripText: { color: '#94a3b8', fontSize: 12, textDecorationLine: 'underline' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 15, color: '#0f172a', backgroundColor: '#fff', marginBottom: 16 },
  textArea: { height: 100, paddingTop: 14 },
  evidencePickerBtn: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  evidencePickerBtnText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  evidencePreview: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  evidenceThumb: { width: 80, height: 80, borderRadius: 10 },
  removeEvidence: { backgroundColor: '#fef2f2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#fecaca' },
  removeEvidenceText: { color: '#dc2626', fontWeight: '700', fontSize: 13 },
  submitBtn: { backgroundColor: '#dc2626', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalContainer: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  modalCancel: { color: '#3b82f6', fontSize: 15 },
  tripList: { padding: 12, gap: 8 },
  tripItem: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: '#e2e8f0' },
  tripItemSelected: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  tripItemMain: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  tripItemSub: { fontSize: 12, color: '#64748b', marginTop: 3 },
  tripItemVehicle: { fontSize: 11, color: '#16a34a', fontWeight: '600', marginTop: 4 },
});
