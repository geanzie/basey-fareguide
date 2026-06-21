import { api } from './api';
import type { Incident, IncidentType, CreateIncidentRequest, IssueTicketRequest, DismissIncidentRequest } from '@/types/incidents';
import type { PaginatedResponse } from '@/types/common';

const EMPTY_PAGE = { total: 0, page: 1, pageSize: 100, hasMore: false };

function normalizeIncident(raw: Record<string, unknown>): Incident {
  return {
    ...(raw as Incident),
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

export async function fetchEnforcerIncidents(): Promise<PaginatedResponse<Incident>> {
  const res = await api.get<{ incidents: Record<string, unknown>[] }>('/api/incidents/enforcer');
  return { items: (res.incidents ?? []).map(normalizeIncident), ...EMPTY_PAGE };
}

export async function createIncident(payload: CreateIncidentRequest): Promise<Incident> {
  return api.post<Incident>('/api/incidents', payload);
}

export async function issueTicket(id: string, payload: IssueTicketRequest): Promise<Incident> {
  return api.patch<Incident>(`/api/incidents/${id}/issue-ticket`, payload);
}

export async function dismissIncident(id: string, payload: DismissIncidentRequest): Promise<Incident> {
  return api.patch<Incident>(`/api/incidents/${id}/dismiss`, payload);
}
