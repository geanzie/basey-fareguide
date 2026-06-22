import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { resetPasswordWithOtp } from '@/services/auth';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { setError('Enter a valid email address.'); return; }
    if (!otp.trim()) { setError('Enter the reset code from your email.'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }

    setError('');
    setLoading(true);
    try {
      await resetPasswordWithOtp(trimmedEmail, otp.trim(), newPassword);
      Alert.alert(
        'Password Updated',
        'Your password has been reset. Please sign in with your new password.',
        [{ text: 'Sign In', onPress: () => router.replace('/login' as never) }],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed. Check the code and try again.');
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
          <Text style={s.title}>New Password</Text>
          <Text style={s.sub}>Enter the code from your email and choose a new password.</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Reset Password</Text>

          {error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={s.field}>
            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Reset Code</Text>
            <TextInput
              style={s.input}
              value={otp}
              onChangeText={setOtp}
              placeholder="6-digit code from email"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              keyboardType="number-pad"
              maxLength={8}
              editable={!loading}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>New Password</Text>
            <TextInput
              style={s.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Minimum 8 characters"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              returnKeyType="next"
              editable={!loading}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Confirm New Password</Text>
            <TextInput
              style={s.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter new password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              editable={!loading}
            />
          </View>

          <Pressable
            style={[s.btn, loading && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Set New Password</Text>}
          </Pressable>
        </View>

        <Pressable style={s.backLink} onPress={() => router.push('/forgot-password' as never)}>
          <Text style={s.backLinkText}>Resend code</Text>
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
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 20 },
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
