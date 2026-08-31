import { useEffect, useState } from 'react';
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
import { exchangeOAuthTicket, fetchOAuthProviders, startSocialSignIn } from '@/services/oauth';
import { ApiError, formatRetryCountdown } from '@/services/api';
import { useRetryCountdown } from '@/hooks/useRetryCountdown';
import { useAuthStore } from '@/store/authStore';
import { resolveOAuthErrorMessage } from '@/lib/oauthErrors';
import type { OAuthProvider, SessionUser, UserRole } from '@/types/auth';
import PasswordInput from '@/ui/PasswordInput';
import SocialIcon from '@/ui/SocialIcon';

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
  const [socialLoading, setSocialLoading] = useState('');
  const [error, setError] = useState('');
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  // Assumed true until the server says otherwise, so a slow or failed probe
  // never disables a button that would have worked.
  const [redirectSupported, setRedirectSupported] = useState(true);
  const retry = useRetryCountdown();

  const setSession = useAuthStore((s) => s.setSession);
  const router = useRouter();

  const busy = loading || socialLoading !== '';

  // A provider the server has no credentials for would render a button that
  // cannot work, so the list is asked for rather than assumed. A failure here
  // means no social button, which is the safe way to be wrong.
  useEffect(() => {
    let active = true;

    fetchOAuthProviders()
      .then((result) => {
        if (!active) return;
        setProviders(result.providers);
        setRedirectSupported(result.redirectSupported);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const enterSession = async (user: SessionUser, token: string) => {
    await setSession(user, token);
    const route = ROLE_ROUTES[user.userType] ?? '/login';
    router.replace(route as never);
  };

  const handleSocialSignIn = async (slug: string) => {
    if (busy || retry.isCountingDown) return;

    // The server already told us it will not return to this build's deep link.
    // Opening the browser would strand the user on a raw 400 it cannot parse.
    if (!redirectSupported) {
      setError(resolveOAuthErrorMessage('oauth_bad_redirect'));
      return;
    }

    setError('');
    setSocialLoading(slug);
    try {
      const result = await startSocialSignIn(slug);

      if (result.kind === 'cancelled') return;

      if (result.kind === 'error') {
        setError(resolveOAuthErrorMessage(result.code));
        return;
      }

      if (result.kind === 'signup') {
        // No account yet — the ticket carries the verified identity into the
        // details the provider could not give us.
        router.push({ pathname: '/register-social', params: { ticket: result.ticket } });
        return;
      }

      const { user, token } = await exchangeOAuthTicket(result.ticket);
      await enterSession(user, token);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        retry.start(err.retryAfter);
        setError('');
        return;
      }
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setSocialLoading('');
    }
  };

  const handleLogin = async () => {
    if (busy || retry.isCountingDown) return;

    if (!username.trim() || !password) {
      setError('Username and password required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { user, token } = await loginRequest({ username: username.trim(), password });
      await enterSession(user, token);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        retry.start(err.retryAfter);
        setError('');
        return;
      }
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

          {retry.isCountingDown ? (
            <View style={s.waitBox}>
              <Text style={s.waitText}>
                Too many sign-in attempts. You can try again in{' '}
                {formatRetryCountdown(retry.secondsLeft)}.
              </Text>
            </View>
          ) : error ? (
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
              editable={!busy}
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
              editable={!busy}
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              s.btn,
              pressed && s.btnPressed,
              (busy || retry.isCountingDown) && s.btnDisabled,
            ]}
            onPress={handleLogin}
            disabled={busy || retry.isCountingDown}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.btnText}>
                {retry.isCountingDown
                  ? `Try again in ${formatRetryCountdown(retry.secondsLeft)}`
                  : 'Sign In'}
              </Text>
            )}
          </Pressable>

          <Pressable
            style={s.forgotLink}
            onPress={() => router.push('/forgot-password')}
            disabled={busy}
          >
            <Text style={s.forgotText}>Forgot password?</Text>
          </Pressable>

          {providers.length > 0 ? (
            <View>
              <View style={s.orRow}>
                <View style={s.orLine} />
                <Text style={s.orText}>OR</Text>
                <View style={s.orLine} />
              </View>

              {providers.map((provider) => (
                <Pressable
                  key={provider.slug}
                  style={({ pressed }) => [
                    s.socialBtn,
                    pressed && s.btnPressed,
                    (busy || retry.isCountingDown || !redirectSupported) && s.btnDisabled,
                  ]}
                  onPress={() => handleSocialSignIn(provider.slug)}
                  disabled={busy || retry.isCountingDown || !redirectSupported}
                >
                  {socialLoading === provider.slug ? (
                    <ActivityIndicator color="#0f172a" />
                  ) : (
                    <>
                      <SocialIcon slug={provider.slug} />
                      <Text style={s.socialBtnText}>Continue with {provider.label}</Text>
                    </>
                  )}
                </Pressable>
              ))}

              <Text style={s.socialHint}>
                {redirectSupported
                  ? 'No password to remember.'
                  : resolveOAuthErrorMessage('oauth_bad_redirect')}
              </Text>
            </View>
          ) : null}

          <View style={s.divider} />

          <Pressable
            style={s.registerRow}
            onPress={() => router.push('/register')}
            disabled={busy}
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
  waitBox: { backgroundColor: '#fffbeb', borderRadius: 10, padding: 12, marginBottom: 16 },
  waitText: { color: '#b45309', fontSize: 13, fontWeight: '500', lineHeight: 18 },
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
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, marginBottom: 16 },
  orLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  orText: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 1 },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  socialBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 15 },
  socialHint: { color: '#94a3b8', fontSize: 12, textAlign: 'center' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 20 },
  registerRow: { alignItems: 'center' },
  registerText: { color: '#475569', fontSize: 14 },
  registerStrong: { color: '#16a34a', fontWeight: '700' },
  footer: { color: '#334155', fontSize: 11, textAlign: 'center', marginTop: 32 },
});
