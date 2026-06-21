import { api } from './api';
import type { Location } from '@/types/common';

export async function fetchActiveLocations(): Promise<Location[]> {
  const res = await api.get<{ items: Location[] }>('/api/locations?isActive=true');
  return res.items;
}
