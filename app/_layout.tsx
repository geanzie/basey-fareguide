import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '@/store/authStore';
import { FeedbackProvider } from '@/ui/FeedbackProvider';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    restoreSession().finally(() => {
      void SplashScreen.hideAsync();
    });
  }, [restoreSession]);

  // Stamp the leave time on background; on return, log out if idle too long.
  // ponytail: if the OS kills the app while foregrounded, lastActive is the
  // prior background time, so a late reopen may log out slightly early — fine.
  useEffect(() => {
    const { noteBackground, enforceIdleTimeout } = useAuthStore.getState();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') void noteBackground();
      else if (state === 'active') void enforceIdleTimeout();
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <FeedbackProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0f172a' } }} />
      </FeedbackProvider>
    </SafeAreaProvider>
  );
}
