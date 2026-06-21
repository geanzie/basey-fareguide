import { api } from './api';
import type { Incident, CreateIncidentRequest, IssueTicketRequest, DismissIncidentRequest } from '@/types/incidents';
import type { PaginatedResponse } from '@/types/common';

const EMPTY_PAGE = { total: 0, page: 1, pageSize: 100, hasMore: false };

export async function fetchMyIncidents(): Promise<PaginatedResponse<Incident>> {
  // No /api/incidents/my endpoint; /api/incidents filters to own for non-admin/enforcer
  const res = await api.get<{ incidents: Incident[] }>('/api/incidents');
  return { items: res.incidents ?? [], ...EMPTY_PAGE };
}

export async function fetchAllIncidents(status?: string): Promise<PaginatedResponse<Incident>> {
  const q = status ? `?status=${status}` : '';
  const res = await api.get<{ incidents: Incident[] }>(`/api/incidents${q}`);
  return { items: res.incidents ?? [], ...EMPTY_PAGE };
}

export async function fetchEnforcerIncidents(): Promise<PaginatedResponse<Incident>> {
  const res = await api.get<{ incidents: Incident[] }>('/api/incidents/enforcer');
  return { items: res.incidents ?? [], ...EMPTY_PAGE };
}

export async function createIncident(payload: CreateIncidentRequest): Promise<Incident> {
  return api.post<Incident>('/api/incidents', payload);
}

export async function takeIncident(id: string): Promise<Incident> {
  return api.post<Incident>(`/api/incidents/${id}/take`, {});
}

export async function issueTicket(id: string, payload: IssueTicketRequest): Promise<Incident> {
  return api.post<Incident>(`/api/incidents/${id}/issue-ticket`, payload);
}

export async function dismissIncident(id: string, payload: DismissIncidentRequest): Promise<Incident> {
  return api.post<Incident>(`/api/incidents/${id}/dismiss`, payload);
}
