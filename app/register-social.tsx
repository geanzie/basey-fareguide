import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView,
  Platform, ActivityIndicator, ScrollView, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { completeSocialSignup } from '@/services/oauth';
import { ApiError, formatRetryCountdown } from '@/services/api';
import { useRetryCountdown } from '@/hooks/useRetryCountdown';
import { useAuthStore } from '@/store/authStore';
import { decodeTokenPayload } from '@/lib/jwt';
import { resolveOAuthErrorMessage } from '@/lib/oauthErrors';
import {
  BARANGAYS,
  ID_TYPES,
  ID_TYPE_LABELS,
  PRIVACY_NOTICE_VERSION,
} from '@/lib/registrationOptions';
import type { SessionUser, UserRole } from '@/types/auth';

const ROLE_ROUTES: Record<UserRole, string> = {
  PUBLIC: '/public',
  ADMIN: '/admin',
  DATA_ENCODER: '/encoder',
  ENFORCER: '/enforcer',
  DRIVER: '/driver',
};

interface FormState {
  phoneNumber: string;
  dateOfBirth: string;
  idType: string;
  governmentId: string;
  barangayResidence: string;
  privacyAcknowledged: boolean;
}

const EMPTY: FormState = {
  phoneNumber: '', dateOfBirth: '', idType: '', governmentId: '',
  barangayResidence: '', privacyAcknowledged: false,
};

/**
 * Second half of social sign-up: the provider gave us name and email, so we
 * only collect what it cannot supply, plus the Privacy Notice acknowledgment
 * that has to be recorded when the account is created.
 *
 * The `ticket` param is the signed sign-up ticket the OAuth callback deep-linked
 * back with. It is posted verbatim to the server, which is the only party that
 * can verify it; the copy decoded here is for the greeting alone.
 */
export default function RegisterSocialScreen() {
  const router = useRouter();
  const { ticket } = useLocalSearchParams<{ ticket?: string }>();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const retry = useRetryCountdown();
  const [barangaySearch, setBarangaySearch] = useState('');
  const [showBarangayModal, setShowBarangayModal] = useState(false);

  const setSession = useAuthStore((s) => s.setSession);

  const identity = useMemo(() => {
    const claims = ticket ? decodeTokenPayload(ticket) : null;
    const read = (key: string) => (typeof claims?.[key] === 'string' ? (claims[key] as string) : '');

    return {
      name: [read('firstName'), read('lastName')].filter(Boolean).join(' '),
      email: read('email'),
    };
  }, [ticket]);

  const set = (key: keyof FormState) => (val: string | boolean) =>
    setForm((f) => ({ ...f, [key]: val }));

  const validate = (): string | null => {
    const { phoneNumber, governmentId, privacyAcknowledged } = form;
    if (!phoneNumber.trim()) return 'Phone number required.';
    if (!/^(09|\+639)\d{9}$/.test(phoneNumber.trim().replace(/\s/g, '')))
      return 'Phone must be 09XXXXXXXXX or +639XXXXXXXXX.';
    if (governmentId.trim() && governmentId.trim().length < 8)
      return 'Government ID must be at least 8 characters.';
    if (!privacyAcknowledged) return 'You must acknowledge the Privacy Notice.';
    return null;
  };

  const handleSubmit = async () => {
    // The button is disabled while loading, but guard anyway: a duplicate
    // request would spend a second rate-limit attempt for nothing.
    if (loading || retry.isCountingDown) return;

    if (!ticket) {
      setError(resolveOAuthErrorMessage('oauth_ticket_expired'));
      return;
    }

    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setLoading(true);
    try {
      const { user, token } = await completeSocialSignup(
        {
          phoneNumber: form.phoneNumber.trim().replace(/\s/g, ''),
          dateOfBirth: form.dateOfBirth.trim() || null,
          barangayResidence: form.barangayResidence || null,
          idType: form.idType || null,
          governmentId: form.governmentId.trim() || null,
          privacyNoticeAcknowledged: true,
          privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
        },
        ticket,
      );

      await setSession(user as SessionUser, token);
      router.replace((ROLE_ROUTES[user.userType] ?? '/login') as never);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        retry.start(e.retryAfter);
        setError('');
        return;
      }
      if (e instanceof ApiError && e.code) {
        setError(resolveOAuthErrorMessage(e.code));
        return;
      }
      setError(e instanceof Error ? e.message : 'Could not finish creating your account.');
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
            <Pressable onPress={() => router.replace('/login')} style={s.backBtn} disabled={loading}>
              <Text style={s.backText}>← Back to sign in</Text>
            </Pressable>
          </View>

          <Text style={s.title}>Finish your account</Text>
          <Text style={s.sub}>Signed in with Google — just a few more details.</Text>

          {retry.isCountingDown ? (
            <View style={s.waitBox}>
              <Text style={s.waitText}>
                Too many attempts for this account. You can try again in{' '}
                {formatRetryCountdown(retry.secondsLeft)}. Your details are saved — stay on this
                screen.
              </Text>
            </View>
          ) : error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {identity.name || identity.email ? (
            <View style={s.identityCard}>
              {identity.name ? <Text style={s.identityName}>{identity.name}</Text> : null}
              {identity.email ? <Text style={s.identityEmail}>{identity.email}</Text> : null}
            </View>
          ) : null}

          <Text style={s.sectionLabel}>CONTACT DETAILS</Text>
          <View style={s.card}>
            <Text style={s.fieldLabel}>Mobile Number *</Text>
            <TextInput style={s.input} value={form.phoneNumber} onChangeText={set('phoneNumber')} placeholder="09XXXXXXXXX" placeholderTextColor="#94a3b8" keyboardType="phone-pad" editable={!loading} />
            <Text style={s.fieldLabel}>Date of Birth (optional)</Text>
            <TextInput style={s.input} value={form.dateOfBirth} onChangeText={set('dateOfBirth')} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" editable={!loading} />
          </View>

          <Text style={s.sectionLabel}>IDENTITY VERIFICATION (OPTIONAL)</Text>
          <View style={s.card}>
            <Text style={s.fieldLabel}>ID Type</Text>
            <View style={s.chipWrap}>
              {ID_TYPES.map((t) => (
                <Pressable
                  key={t}
                  style={[s.chip, form.idType === t && s.chipActive]}
                  onPress={() => set('idType')(form.idType === t ? '' : t)}
                  disabled={loading}
                >
                  <Text style={[s.chipText, form.idType === t && s.chipTextActive]}>
                    {ID_TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.fieldLabel}>Government ID Number</Text>
            <TextInput style={s.input} value={form.governmentId} onChangeText={set('governmentId')} placeholder="Min. 8 characters (if provided)" placeholderTextColor="#94a3b8" editable={!loading} />
            <Text style={s.fieldLabel}>Barangay of Residence</Text>
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
            style={[s.submitBtn, (loading || retry.isCountingDown) && s.submitDisabled]}
            onPress={handleSubmit}
            disabled={loading || retry.isCountingDown}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : (
                <Text style={s.submitText}>
                  {retry.isCountingDown
                    ? `Try again in ${formatRetryCountdown(retry.secondsLeft)}`
                    : 'Create Account'}
                </Text>
              )}
          </Pressable>
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
  waitBox: { backgroundColor: '#fffbeb', borderRadius: 12, padding: 14, marginBottom: 16 },
  waitText: { color: '#b45309', fontSize: 13, fontWeight: '500', lineHeight: 18 },
  identityCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  identityName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  identityEmail: { fontSize: 13, color: '#64748b', marginTop: 2 },
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
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  modalClose: { color: '#16a34a', fontSize: 15, fontWeight: '700' },
  searchInput: { margin: 12, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 15, color: '#0f172a', backgroundColor: '#fff' },
  barangayItem: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  barangayItemActive: { backgroundColor: '#f0fdf4' },
  barangayText: { fontSize: 15, color: '#374151' },
  barangayTextActive: { color: '#16a34a', fontWeight: '700' },
});
