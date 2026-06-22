import { api } from './api';
import { useAuthStore } from '@/store/authStore';
import type { Permit, CreatePermitInput, UpdatePermitInput } from '@/types/permits';

interface PermitFilters {
  status?: string;
  vehicleType?: string;
  search?: string;
}

export async function fetchPermits(filters: PermitFilters = {}): Promise<Permit[]> {
  const q = new URLSearchParams();
  if (filters.status) q.set('status', filters.status);
  if (filters.vehicleType) q.set('vehicleType', filters.vehicleType);
  if (filters.search) q.set('search', filters.search);
  q.set('limit', '100');
  const res = await api.get<{ permits: Permit[] }>(`/api/permits?${q.toString()}`);
  return res.permits ?? [];
}

export async function createPermit(input: CreatePermitInput): Promise<Permit> {
  return api.post<Permit>('/api/permits', input);
}

export async function updatePermit(id: string, data: UpdatePermitInput): Promise<Permit> {
  const updatedBy = useAuthStore.getState().user?.id;
  return api.put<Permit>(`/api/permits/${id}`, { ...data, updatedBy });
}

export async function setPermitStatus(id: string, status: string): Promise<Permit> {
  return updatePermit(id, { status });
}

export async function renewPermit(id: string, notes?: string): Promise<Permit> {
  const renewedBy = useAuthStore.getState().user?.id;
  return api.post<Permit>(`/api/permits/${id}/renew`, { renewedBy, notes });
}

/** Issues a QR token if none exists, otherwise rotates it. */
export async function issuePermitQr(id: string): Promise<{ permit: Permit; action: string }> {
  return api.post<{ permit: Permit; action: string }>(`/api/permits/${id}/qr`, {});
}

export async function fetchPermitQr(id: string): Promise<Permit> {
  const res = await api.get<{ permit: Permit }>(`/api/permits/${id}/qr`);
  return res.permit;
}
