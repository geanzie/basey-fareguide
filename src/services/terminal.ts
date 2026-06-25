import { api } from './api';
import { useTerminalUnlockStore } from '@/store/terminalUnlockStore';
import type { TerminalLookupResult, TerminalUnlockResult } from '@/types/terminal';

export async function terminalUnlock(password: string): Promise<TerminalUnlockResult> {
  const res = await api.post<TerminalUnlockResult>('/api/terminal/unlock', { password });
  if (res.unlockToken) {
    useTerminalUnlockStore.getState().setUnlock(res.unlockToken, res.expiresAt);
  }
  return res;
}

export async function terminalLock(): Promise<void> {
  try {
    await api.delete('/api/terminal/unlock');
  } finally {
    useTerminalUnlockStore.getState().clearUnlock();
  }
}

export async function terminalLookup(token: string): Promise<TerminalLookupResult> {
  return api.post<TerminalLookupResult>('/api/terminal/lookup', {
    token,
    scanSource: 'CAMERA',
  });
}
