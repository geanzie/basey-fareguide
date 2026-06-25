import { api } from './api';
import { useAuthStore } from '@/store/authStore';
import type { Incident, IncidentType, CreateIncidentRequest, IssueTicketRequest, DismissIncidentRequest, EvidenceFile, TicketPenaltyPreview, EnforcerStats, DashboardStats, DashboardActivityItem } from '@/types/incidents';
import type { PaginatedResponse } from '@/types/common';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const EMPTY_PAGE = { total: 0, page: 1, pageSize: 100, hasMore: false };

function normalizeIncident(raw: Record<string, unknown>): Incident {
  return {
    ...(raw as unknown as Incident),
    incidentType: ((raw.type ?? raw.incidentType) as IncidentType),
    incidentDate: (raw.date ?? raw.incidentDate) as string,
  };
}

export async function fetchMyIncidents(): Promise<PaginatedResponse<Incident>> {
  const res = await api.get<{ incidents: Record<string, unknown>[] }>('/api/incidents');
  return { items: (res.incidents ?? []).map(normalizeIncident), ...EMPTY_PAGE };
}

export async function fetchAllIncidents(status?: string): Promise<PaginatedResponse<Incident>> {
  const q = status ? `?status=${status}` : '';
  const res = await api.get<{ incidents: Record<string, unknown>[] }>(`/api/incidents${q}`);
  return { items: (res.incidents ?? []).map(normalizeIncident), ...EMPTY_PAGE };
}

export async function fetchEnforcerIncidents(scope: 'all' | 'unresolved' = 'unresolved'): Promise<PaginatedResponse<Incident>> {
  const res = await api.get<{ incidents: Record<string, unknown>[] }>(`/api/incidents/enforcer?scope=${scope}`);
  return { items: (res.incidents ?? []).map(normalizeIncident), ...EMPTY_PAGE };
}

export async function getTicketPreview(id: string): Promise<{ plateNumber: string; penalty: TicketPenaltyPreview }> {
  return api.get(`/api/incidents/${id}/issue-ticket`);
}

export async function getIncidentEvidence(id: string): Promise<{ evidence: EvidenceFile[] }> {
  return api.get(`/api/incidents/${id}/evidence`);
}

export async function fetchEnforcerStats(): Promise<EnforcerStats> {
  const res = await api.get<{
    total: number;
    pending: number;
    resolved: number;
    dismissed: number;
    byStatus: Record<string, number>;
  }>('/api/admin/incidents/stats');
  return {
    total: res.total,
    pending: res.pending,
    ticketIssued: res.byStatus['ticket_issued'] ?? 0,
    resolved: res.resolved,
    dismissed: res.dismissed,
  };
}

export async function createIncident(
  payload: CreateIncidentRequest,
  evidenceUri?: string,
): Promise<{ referenceNumber?: string; message?: string }> {
  const { token } = useAuthStore.getState();

  const form = new FormData();
  form.append('incidentType', payload.incidentType);
  form.append('description', payload.description);
  // backend expects YYYY-MM-DD, not full ISO datetime
  form.append('incidentDate', payload.incidentDate.split('T')[0]);

  const now = new Date();
  form.append(
    'incidentTime',
    `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
  );

  if (payload.location) form.append('location', payload.location);
  if (payload.plateNumber) form.append('plateNumber', payload.plateNumber);
  if (payload.vehicleId) form.append('vehicleId', payload.vehicleId);
  if (payload.fareCalculationId) form.append('fareCalculationId', payload.fareCalculationId);

  if (evidenceUri) {
    const fileName = evidenceUri.split('/').pop() ?? 'evidence.jpg';
    const ext = fileName.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mimeType =
      ext === 'mp4' || ext === 'mov' ? 'video/mp4' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    form.append('evidence', { uri: evidenceUri, name: fileName, type: mimeType } as unknown as Blob);
  }

  const res = await fetch(`${API_BASE}/api/incidents/report`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    if (text) json = JSON.parse(text) as Record<string, unknown>;
  } catch { /* non-JSON body — ignore */ }

  if (!res.ok) {
    throw new Error((json.message as string | undefined) ?? `HTTP ${res.status}`);
  }

  return json as { referenceNumber?: string; message?: string };
}

export async function issueTicket(id: string, payload: IssueTicketRequest): Promise<Incident> {
  return api.patch<Incident>(`/api/incidents/${id}/issue-ticket`, payload);
}

export async function dismissIncident(id: string, payload: DismissIncidentRequest): Promise<Incident> {
  return api.patch<Incident>(`/api/incidents/${id}/dismiss`, payload);
}

export async function verifyEvidence(id: string): Promise<Incident> {
  return api.patch<Incident>(`/api/incidents/${id}/verify-evidence`, {});
}

export async function getEvidenceDownloadUrl(evidenceId: string): Promise<string> {
  const { token } = useAuthStore.getState();
  const requestUrl = `${API_BASE}/api/evidence/${evidenceId}/download`;
  const res = await fetch(requestUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error('Access denied to this evidence file.');
  }
  // For all other statuses (including S3 errors after redirect), return the
  // resolved URL. Image.onError handles load failure inline without a toast.
  return res.url || requestUrl;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await api.get<{ stats: DashboardStats }>('/api/dashboard/stats');
  return res.stats;
}

export async function fetchDashboardActivity(limit = 3): Promise<DashboardActivityItem[]> {
  const res = await api.get<{ activity: DashboardActivityItem[] }>(`/api/dashboard/activity?limit=${limit}`);
  return res.activity ?? [];
}
