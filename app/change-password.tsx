import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { changePassword } from '@/services/auth';
import { useFeedback } from '@/ui/FeedbackProvider';
import PasswordInput from '@/ui/PasswordInput';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { showSuccess } = useFeedback();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!currentPassword) { setError('Enter your current password.'); return; }
    if (newPassword.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return; }

    setError('');
    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      showSuccess('Your password has been changed.', { title: 'Password Updated' });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <View style={s.logo}>
            <Text style={s.logoText}>BF</Text>
          </View>
          <Text style={s.title}>Change Password</Text>
          <Text style={s.sub}>Update the password you use to sign in.</Text>
        </View>

        <View style={s.card}>
          {error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={s.field}>
            <Text style={s.label}>Current Password</Text>
            <PasswordInput
              style={s.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              returnKeyType="next"
              editable={!loading}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>New Password</Text>
            <PasswordInput
              style={s.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Minimum 8 characters"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              returnKeyType="next"
              editable={!loading}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Confirm New Password</Text>
            <PasswordInput
              style={s.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter new password"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              editable={!loading}
            />
          </View>

          <Pressable style={[s.btn, loading && s.btnDisabled]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Change Password</Text>}
          </Pressable>
        </View>

        <Pressable style={s.backLink} onPress={() => router.back()} disabled={loading}>
          <Text style={s.backLinkText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0f172a' },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 72, height: 72, borderRadius: 20, backgroundColor: '#16a34a', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  logoText: { color: '#fff', fontSize: 26, fontWeight: '900' },
  title: { fontSize: 26, fontWeight: '800', color: '#fff' },
  sub: { fontSize: 12, color: '#64748b', marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, elevation: 8 },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: '#dc2626', fontSize: 13, fontWeight: '500' },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 15, color: '#0f172a', backgroundColor: '#f8fafc' },
  btn: { backgroundColor: '#16a34a', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  backLink: { alignItems: 'center', marginTop: 24 },
  backLinkText: { color: '#94a3b8', fontSize: 14 },
});
