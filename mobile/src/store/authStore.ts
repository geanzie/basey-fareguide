import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import type { SessionUser, AuthStatus } from '@/types/auth';

const TOKEN_KEY = 'auth_token';
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const SESSION_TIMEOUT_MS = 5000;

interface AuthState {
  user: SessionUser | null;
  token: string | null;
  status: AuthStatus;
  setSession: (user: SessionUser, token: string) => Promise<void>;
  clearSession: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  status: 'loading',

  setSession: async (user, token) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    set({ user, token, status: 'authenticated' });
  },

  clearSession: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ user: null, token: null, status: 'unauthenticated' });
  },

  restoreSession: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) {
        set({ status: 'unauthenticated' });
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
          set({ user: null, token: null, status: 'unauthenticated' });
          return;
        }

        const data = await res.json() as { user: SessionUser };
        set({ user: data.user, token, status: 'authenticated' });
      } catch {
        clearTimeout(timeoutId);
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        set({ user: null, token: null, status: 'unauthenticated' });
      }
    } catch {
      set({ status: 'unauthenticated' });
    }
  },
}));
