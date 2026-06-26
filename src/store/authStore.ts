import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import type { SessionUser, AuthStatus } from '@/types/auth';
import { isTokenExpired } from '@/lib/jwt';

const TOKEN_KEY = 'auth_token';
const LAST_ACTIVE_KEY = 'auth_last_active';
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const SESSION_TIMEOUT_MS = 5000;
/** Logout after this long away (backgrounded or killed). Default 15 min. */
const IDLE_TIMEOUT_MS =
  Number.parseInt(process.env.EXPO_PUBLIC_AUTH_IDLE_TIMEOUT_MS ?? '', 10) || 15 * 60 * 1000;

async function readLastActive(): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(LAST_ACTIVE_KEY);
  const ms = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(ms) ? ms : null;
}

interface AuthState {
  user: SessionUser | null;
  token: string | null;
  status: AuthStatus;
  setSession: (user: SessionUser, token: string) => Promise<void>;
  clearSession: () => Promise<void>;
  restoreSession: () => Promise<void>;
  noteBackground: () => Promise<void>;
  enforceIdleTimeout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  status: 'loading',

  setSession: async (user, token) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(LAST_ACTIVE_KEY, String(Date.now()));
    set({ user, token, status: 'authenticated' });
  },

  clearSession: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(LAST_ACTIVE_KEY);
    set({ user: null, token: null, status: 'unauthenticated' });
  },

  restoreSession: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) {
        set({ status: 'unauthenticated' });
        return;
      }

      // Expired token or idle too long → log out without a network round-trip.
      const lastActive = await readLastActive();
      if (isTokenExpired(token) || (lastActive != null && Date.now() - lastActive > IDLE_TIMEOUT_MS)) {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(LAST_ACTIVE_KEY);
        set({ user: null, token: null, status: 'unauthenticated' });
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SESSION_TIMEOUT_MS);

      try {
        const res = await fetch(`${API_BASE}/api/auth/session`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          await SecureStore.deleteItemAsync(LAST_ACTIVE_KEY);
          set({ user: null, token: null, status: 'unauthenticated' });
          return;
        }

        const data = await res.json() as { user: SessionUser };
        await SecureStore.setItemAsync(LAST_ACTIVE_KEY, String(Date.now()));
        set({ user: data.user, token, status: 'authenticated' });
      } catch {
        clearTimeout(timeoutId);
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(LAST_ACTIVE_KEY);
        set({ user: null, token: null, status: 'unauthenticated' });
      }
    } catch {
      set({ status: 'unauthenticated' });
    }
  },

  // Record when the user left so foreground/cold-start can measure idle time.
  noteBackground: async () => {
    if (!get().token) return;
    await SecureStore.setItemAsync(LAST_ACTIVE_KEY, String(Date.now()));
  },

  enforceIdleTimeout: async () => {
    const token = get().token;
    if (!token) return;
    const lastActive = await readLastActive();
    if (isTokenExpired(token) || (lastActive != null && Date.now() - lastActive > IDLE_TIMEOUT_MS)) {
      await get().clearSession();
    }
  },
}));
