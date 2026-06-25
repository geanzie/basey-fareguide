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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { loginRequest } from '@/services/auth';
import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/types/auth';
import PasswordInput from '@/ui/PasswordInput';

const ROLE_ROUTES: Record<UserRole, string> = {
  PUBLIC: '/public',
  ADMIN: '/admin',
  DATA_ENCODER: '/encoder',
  ENFORCER: '/enforcer',
  DRIVER: '/driver',
};

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setSession = useAuthStore((s) => s.setSession);
  const router = useRouter();

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError('Username and password required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { user, token } = await loginRequest({ username: username.trim(), password });
      await setSession(user, token);
      const route = ROLE_ROUTES[user.userType] ?? '/login';
      router.replace(route as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Image source={require('../assets/logo.png')} style={s.logo} resizeMode="contain" />
          <Text style={s.title}>Basey FareCheck</Text>
          <Text style={s.sub}>Municipal Ordinance 105, Series of 2023</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Sign In</Text>

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
              placeholder="Enter username"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              editable={!loading}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Password</Text>
            <PasswordInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor="#94a3b8"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              editable={!loading}
            />
          </View>

          <Pressable
            style={({ pressed }) => [s.btn, pressed && s.btnPressed, loading && s.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.btnText}>Sign In</Text>
            )}
          </Pressable>

          <Pressable
            style={s.forgotLink}
            onPress={() => router.push('/forgot-password')}
            disabled={loading}
          >
            <Text style={s.forgotText}>Forgot password?</Text>
          </Pressable>

          <View style={s.divider} />

          <Pressable
            style={s.registerRow}
            onPress={() => router.push('/register')}
            disabled={loading}
          >
            <Text style={s.registerText}>
              Don&apos;t have an account? <Text style={s.registerStrong}>Register</Text>
            </Text>
          </Pressable>
        </View>

        <Text style={s.footer}>Basey Municipality, Samar · Philippines</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0f172a' },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#fff' },
  sub: { fontSize: 12, color: '#64748b', marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    elevation: 8,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 20 },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: '#dc2626', fontSize: 13, fontWeight: '500' },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  btn: {
    backgroundColor: '#16a34a',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  forgotLink: { alignItems: 'center', marginTop: 16 },
  forgotText: { color: '#16a34a', fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 20 },
  registerRow: { alignItems: 'center' },
  registerText: { color: '#475569', fontSize: 14 },
  registerStrong: { color: '#16a34a', fontWeight: '700' },
  footer: { color: '#334155', fontSize: 11, textAlign: 'center', marginTop: 32 },
});
