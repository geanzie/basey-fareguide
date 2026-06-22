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
} from 'react-native';
import { useRouter } from 'expo-router';
import { requestPasswordReset } from '@/services/auth';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim()) {
      setError('Enter your username.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(username.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset code.');
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
          <Text style={s.title}>Reset Password</Text>
          <Text style={s.sub}>Enter your username to receive a reset code via email.</Text>
        </View>

        <View style={s.card}>
          {sent ? (
            <View style={s.successBox}>
              <Text style={s.successTitle}>Code Sent</Text>
              <Text style={s.successText}>
                If an account exists for that username, a reset code was sent to the registered email address.
              </Text>
              <Pressable style={s.btn} onPress={() => router.push('/reset-password' as never)}>
                <Text style={s.btnText}>Enter Reset Code</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={s.cardTitle}>Forgot Password</Text>
              {error ? (
                <View style={s.errorBox}>
                  <Text style={s.errorText}>{error}</Text>
                </View>
              ) : null}
              <View style={s.field}>
                <Text style={s.label}>Username</Text>
                <TextInput
                  style={s.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter your username"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  autoCorrect={false}
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
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Send Reset Code</Text>}
              </Pressable>
            </>
          )}
        </View>

        <Pressable style={s.backLink} onPress={() => router.back()}>
          <Text style={s.backLinkText}>Back to Sign In</Text>
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
  successBox: { alignItems: 'center', gap: 12 },
  successTitle: { fontSize: 18, fontWeight: '700', color: '#16a34a' },
  successText: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  backLink: { alignItems: 'center', marginTop: 24 },
  backLinkText: { color: '#94a3b8', fontSize: 14 },
});
