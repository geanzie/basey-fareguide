import { api } from './api';
import type { TerminalLookupResult } from '@/types/terminal';

export async function terminalLookup(token: string): Promise<TerminalLookupResult> {
  return api.post<TerminalLookupResult>('/api/terminal/lookup', {
    token,
    scanSource: 'CAMERA',
  });
}
