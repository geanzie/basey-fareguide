import { create } from 'zustand';

/**
 * In-memory unlock token for the QR compliance terminal. Mirrors the web's
 * cookie-based unlock session, but held in memory only — it is intentionally
 * lost on app restart and relies on the server's idle/max-age expiry.
 */
interface TerminalUnlockState {
  unlockToken: string | null;
  expiresAt: string | null;
  setUnlock: (unlockToken: string, expiresAt: string | null) => void;
  clearUnlock: () => void;
  /** Token is present and not past its server-reported expiry. */
  isUnlocked: () => boolean;
}

export const useTerminalUnlockStore = create<TerminalUnlockState>((set, get) => ({
  unlockToken: null,
  expiresAt: null,

  setUnlock: (unlockToken, expiresAt) => set({ unlockToken, expiresAt }),

  clearUnlock: () => set({ unlockToken: null, expiresAt: null }),

  isUnlocked: () => {
    const { unlockToken, expiresAt } = get();
    if (!unlockToken) return false;
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return false;
    return true;
  },
}));
