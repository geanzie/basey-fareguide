import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createIncident } from '@/services/incidents';
import type { IncidentType } from '@/types/incidents';

const INCIDENT_TYPES: { label: string; value: IncidentType }[] = [
  { label: 'Overcharging', value: 'OVERCHARGING' },
  { label: 'Reckless Driving', value: 'RECKLESS_DRIVING' },
  { label: 'Refusal of Service', value: 'REFUSAL_OF_SERVICE' },
  { label: 'Colorum', value: 'COLORUM' },
  { label: 'Overloading', value: 'OVERLOADING' },
  { label: 'Other', value: 'OTHER' },
];

export default function ReportScreen() {
  const [incidentType, setIncidentType] = useState<IncidentType | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!incidentType) { Alert.alert('Required', 'Select an incident type.'); return; }
    if (!description.trim()) { Alert.alert('Required', 'Enter a description.'); return; }
    if (!location.trim()) { Alert.alert('Required', 'Enter the location.'); return; }

    setSubmitting(true);
    try {
      await createIncident({
        incidentType,
        description: description.trim(),
        location: location.trim(),
        plateNumber: plateNumber.trim() || undefined,
        incidentDate: new Date().toISOString(),
      });
      Alert.alert('Submitted', 'Report submitted. Thank you for helping keep Basey safe!');
      setIncidentType(null);
      setDescription('');
      setLocation('');
      setPlateNumber('');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Report Incident</Text>
        <Text style={s.sub}>Help enforce municipal fare standards.</Text>

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
          returnKeyType="next"
        />

        <Text style={s.label}>Plate Number (optional)</Text>
        <TextInput
          style={s.input}
          value={plateNumber}
          onChangeText={(t) => setPlateNumber(t.toUpperCase())}
          placeholder="e.g. ABC 123"
          placeholderTextColor="#94a3b8"
          autoCapitalize="characters"
          returnKeyType="done"
        />

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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  sub: { fontSize: 13, color: '#64748b', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#e2e8f0' },
  typeChipActive: { backgroundColor: '#dc2626' },
  typeChipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  typeChipTextActive: { color: '#fff' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 15, color: '#0f172a', backgroundColor: '#fff', marginBottom: 16 },
  textArea: { height: 100, paddingTop: 14 },
  submitBtn: { backgroundColor: '#dc2626', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
