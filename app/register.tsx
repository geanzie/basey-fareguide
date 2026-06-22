import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView,
  Platform, ActivityIndicator, ScrollView, Modal, FlatList, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { registerRequest } from '@/services/auth';

const ID_TYPES = [
  'NATIONAL_ID', 'DRIVERS_LICENSE', 'PASSPORT', 'VOTERS_ID',
  'SSS_ID', 'PHILHEALTH_ID', 'TIN_ID', 'POSTAL_ID', 'STUDENT_ID',
] as const;

const ID_TYPE_LABELS: Record<typeof ID_TYPES[number], string> = {
  NATIONAL_ID: 'National ID',
  DRIVERS_LICENSE: "Driver's License",
  PASSPORT: 'Passport',
  VOTERS_ID: "Voter's ID",
  SSS_ID: 'SSS ID',
  PHILHEALTH_ID: 'PhilHealth ID',
  TIN_ID: 'TIN ID',
  POSTAL_ID: 'Postal ID',
  STUDENT_ID: 'Student ID',
};

const BARANGAYS = [
  'Amandayehan', 'Anglit', 'Bacubac', 'Baloog', 'Basiao', 'Buenavista', 'Burgos',
  'Cambayan', 'Can-abay', 'Cancaiyas', 'Canmanila', 'Catadman', 'Cogon', 'Dolongan',
  'Guintigui-an', 'Guirang', 'Balante', 'Iba', 'Inuntan', 'Loog', 'Mabini',
  'Magallanes', 'Manlilinab', 'Del Pilar', 'May-it', 'Mongabong', 'New San Agustin',
  'Nouvelas Occidental', 'Old San Agustin', 'Panugmonon', 'Pelit',
  'Baybay (Poblacion)', 'Buscada (Poblacion)', 'Lawa-an (Poblacion)',
  'Loyo (Poblacion)', 'Mercado (Poblacion)', 'Palaypay (Poblacion)', 'Sulod (Poblacion)',
  'Roxas', 'Salvacion', 'San Antonio', 'San Fernando', 'Sawa', 'Serum',
  'Sugca', 'Sugponon', 'Tinaogan', 'Tingib', 'Villa Aurora', 'Binongtu-an', 'Bulao',
];

const PRIVACY_NOTICE_VERSION = '2026-04-21' as const;

interface FormState {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  dateOfBirth: string;
  idType: string;
  governmentId: string;
  barangayResidence: string;
  username: string;
  password: string;
  confirmPassword: string;
  privacyAcknowledged: boolean;
}

const EMPTY: FormState = {
  firstName: '', lastName: '', phoneNumber: '', email: '', dateOfBirth: '',
  idType: '', governmentId: '', barangayResidence: '', username: '',
  password: '', confirmPassword: '', privacyAcknowledged: false,
};

export default function RegisterScreen() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [barangaySearch, setBarangaySearch] = useState('');
  const [showBarangayModal, setShowBarangayModal] = useState(false);

  const set = (key: keyof FormState) => (val: string | boolean) =>
    setForm((f) => ({ ...f, [key]: val }));

  const validate = (): string | null => {
    const { firstName, lastName, phoneNumber, email, idType, governmentId,
      barangayResidence, username, password, confirmPassword, privacyAcknowledged } = form;
    if (!firstName.trim() || !lastName.trim()) return 'First and last name required.';
    if (!phoneNumber.trim()) return 'Phone number required.';
    if (!/^(09|\+639)\d{9}$/.test(phoneNumber.trim())) return 'Phone must be 09XXXXXXXXX or +639XXXXXXXXX.';
    if (!email.trim() || !email.includes('@')) return 'Valid email required.';
    if (!idType) return 'Select an ID type.';
    if (governmentId.trim().length < 8) return 'Government ID must be at least 8 characters.';
    if (!barangayResidence) return 'Select barangay of residence.';
    if (!username.trim()) return 'Username required.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    if (!privacyAcknowledged) return 'You must acknowledge the Privacy Notice.';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setLoading(true);
    try {
      await registerRequest({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        email: form.email.trim().toLowerCase(),
        dateOfBirth: form.dateOfBirth.trim() || null,
        governmentId: form.governmentId.trim(),
        idType: form.idType,
        barangayResidence: form.barangayResidence,
        username: form.username.trim().toLowerCase(),
        password: form.password,
        userType: 'PUBLIC',
        privacyNoticeAcknowledged: true,
        privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
      });
      Alert.alert(
        'Registration Successful',
        'Your account has been created. You can now log in.',
        [{ text: 'Sign In', onPress: () => router.replace('/login') }],
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredBarangays = BARANGAYS.filter((b) =>
    b.toLowerCase().includes(barangaySearch.toLowerCase()),
  );

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <SafeAreaView style={s.flex}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.topBar}>
            <Pressable onPress={() => router.back()} style={s.backBtn}>
              <Text style={s.backText}>← Back</Text>
            </Pressable>
          </View>

          <Text style={s.title}>Create Account</Text>
          <Text style={s.sub}>Public user registration · Basey FareCheck</Text>

          {error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Personal Information */}
          <Text style={s.sectionLabel}>PERSONAL INFORMATION</Text>
          <View style={s.card}>
            <Text style={s.fieldLabel}>First Name *</Text>
            <TextInput style={s.input} value={form.firstName} onChangeText={set('firstName')} placeholder="First name" placeholderTextColor="#94a3b8" editable={!loading} />
            <Text style={s.fieldLabel}>Last Name *</Text>
            <TextInput style={s.input} value={form.lastName} onChangeText={set('lastName')} placeholder="Last name" placeholderTextColor="#94a3b8" editable={!loading} />
            <Text style={s.fieldLabel}>Phone Number *</Text>
            <TextInput style={s.input} value={form.phoneNumber} onChangeText={set('phoneNumber')} placeholder="09XXXXXXXXX" placeholderTextColor="#94a3b8" keyboardType="phone-pad" editable={!loading} />
            <Text style={s.fieldLabel}>Email Address *</Text>
            <TextInput style={s.input} value={form.email} onChangeText={set('email')} placeholder="you@example.com" placeholderTextColor="#94a3b8" keyboardType="email-address" autoCapitalize="none" editable={!loading} />
            <Text style={s.fieldLabel}>Date of Birth (optional)</Text>
            <TextInput style={s.input} value={form.dateOfBirth} onChangeText={set('dateOfBirth')} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" editable={!loading} />
          </View>

          {/* Identity Verification */}
          <Text style={s.sectionLabel}>IDENTITY VERIFICATION</Text>
          <View style={s.card}>
            <Text style={s.fieldLabel}>ID Type *</Text>
            <View style={s.chipWrap}>
              {ID_TYPES.map((t) => (
                <Pressable
                  key={t}
                  style={[s.chip, form.idType === t && s.chipActive]}
                  onPress={() => set('idType')(t)}
                  disabled={loading}
                >
                  <Text style={[s.chipText, form.idType === t && s.chipTextActive]}>
                    {ID_TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.fieldLabel}>Government ID Number *</Text>
            <TextInput style={s.input} value={form.governmentId} onChangeText={set('governmentId')} placeholder="Min. 8 characters" placeholderTextColor="#94a3b8" editable={!loading} />
            <Text style={s.fieldLabel}>Barangay of Residence *</Text>
            <Pressable
              style={[s.input, s.pickerBtn, loading && s.inputDisabled]}
              onPress={() => { setBarangaySearch(''); setShowBarangayModal(true); }}
              disabled={loading}
            >
              <Text style={[s.pickerBtnText, !form.barangayResidence && s.pickerBtnPlaceholder]}>
                {form.barangayResidence || 'Select barangay'}
              </Text>
            </Pressable>
          </View>

          {/* Account Credentials */}
          <Text style={s.sectionLabel}>ACCOUNT CREDENTIALS</Text>
          <View style={s.card}>
            <Text style={s.fieldLabel}>Username *</Text>
            <TextInput style={s.input} value={form.username} onChangeText={(v) => set('username')(v.toLowerCase().replace(/\s/g, ''))} placeholder="username" placeholderTextColor="#94a3b8" autoCapitalize="none" autoCorrect={false} editable={!loading} />
            <Text style={s.fieldLabel}>Password *</Text>
            <TextInput style={s.input} value={form.password} onChangeText={set('password')} placeholder="Min. 8 characters" placeholderTextColor="#94a3b8" secureTextEntry editable={!loading} />
            <Text style={s.fieldLabel}>Confirm Password *</Text>
            <TextInput style={s.input} value={form.confirmPassword} onChangeText={set('confirmPassword')} placeholder="Repeat password" placeholderTextColor="#94a3b8" secureTextEntry editable={!loading} />
          </View>

          {/* Privacy Notice */}
          <Text style={s.sectionLabel}>PRIVACY & CONSENT</Text>
          <View style={s.card}>
            <Pressable
              style={s.checkRow}
              onPress={() => set('privacyAcknowledged')(!form.privacyAcknowledged)}
              disabled={loading}
            >
              <View style={[s.checkbox, form.privacyAcknowledged && s.checkboxChecked]}>
                {form.privacyAcknowledged && <Text style={s.checkmark}>✓</Text>}
              </View>
              <Text style={s.checkLabel}>
                I acknowledge the Privacy Notice of Basey FareCheck (version {PRIVACY_NOTICE_VERSION}).
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={[s.submitBtn, loading && s.submitDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.submitText}>Create Account</Text>}
          </Pressable>

          <Text style={s.loginHint}>
            Already have an account?{' '}
            <Text style={s.loginHintLink} onPress={() => router.replace('/login')}>Sign In</Text>
          </Text>
        </ScrollView>
      </SafeAreaView>

      {/* Barangay Picker Modal */}
      <Modal visible={showBarangayModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.flex}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Select Barangay</Text>
            <Pressable onPress={() => setShowBarangayModal(false)}>
              <Text style={s.modalClose}>Done</Text>
            </Pressable>
          </View>
          <TextInput
            style={s.searchInput}
            value={barangaySearch}
            onChangeText={setBarangaySearch}
            placeholder="Search barangay…"
            placeholderTextColor="#94a3b8"
            autoFocus
          />
          <FlatList
            data={filteredBarangays}
            keyExtractor={(b) => b}
            renderItem={({ item }) => (
              <Pressable
                style={[s.barangayItem, form.barangayResidence === item && s.barangayItemActive]}
                onPress={() => {
                  set('barangayResidence')(item);
                  setShowBarangayModal(false);
                }}
              >
                <Text style={[s.barangayText, form.barangayResidence === item && s.barangayTextActive]}>
                  {item}
                </Text>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 20, paddingBottom: 48 },
  topBar: { marginBottom: 8 },
  backBtn: { alignSelf: 'flex-start' },
  backText: { color: '#16a34a', fontSize: 15, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  sub: { fontSize: 12, color: '#64748b', marginBottom: 20 },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 14, marginBottom: 16 },
  errorText: { color: '#dc2626', fontSize: 13, fontWeight: '500', lineHeight: 18 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 13, fontSize: 15, color: '#0f172a', backgroundColor: '#f8fafc' },
  inputDisabled: { opacity: 0.6 },
  pickerBtn: { justifyContent: 'center' },
  pickerBtnText: { fontSize: 15, color: '#0f172a' },
  pickerBtnPlaceholder: { color: '#94a3b8' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#f0fdf4', borderColor: '#16a34a' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  chipTextActive: { color: '#16a34a' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  checkboxChecked: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '900' },
  checkLabel: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 20 },
  submitBtn: { backgroundColor: '#16a34a', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24 },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  loginHint: { textAlign: 'center', color: '#94a3b8', fontSize: 14, marginTop: 20 },
  loginHintLink: { color: '#16a34a', fontWeight: '700' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  modalClose: { color: '#16a34a', fontSize: 15, fontWeight: '700' },
  searchInput: { margin: 12, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 15, color: '#0f172a', backgroundColor: '#fff' },
  barangayItem: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  barangayItemActive: { backgroundColor: '#f0fdf4' },
  barangayText: { fontSize: 15, color: '#374151' },
  barangayTextActive: { color: '#16a34a', fontWeight: '700' },
});
