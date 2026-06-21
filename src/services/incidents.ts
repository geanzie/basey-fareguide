import { api } from './api';
import type { Incident, CreateIncidentRequest, IssueTicketRequest, DismissIncidentRequest } from '@/types/incidents';
import type { PaginatedResponse } from '@/types/common';

export async function fetchMyIncidents(): Promise<PaginatedResponse<Incident>> {
  return api.get<PaginatedResponse<Incident>>('/api/incidents/my');
}

export async function fetchAllIncidents(status?: string): Promise<PaginatedResponse<Incident>> {
  const q = status ? `?status=${status}` : '';
  return api.get<PaginatedResponse<Incident>>(`/api/incidents${q}`);
}

export async function fetchEnforcerIncidents(): Promise<PaginatedResponse<Incident>> {
  return api.get<PaginatedResponse<Incident>>('/api/enforcer/incidents');
}

export async function createIncident(payload: CreateIncidentRequest): Promise<Incident> {
  return api.post<Incident>('/api/incidents', payload);
}

export async function takeIncident(id: string): Promise<Incident> {
  return api.post<Incident>(`/api/enforcer/incidents/${id}/take`, {});
}

export async function issueTicket(id: string, payload: IssueTicketRequest): Promise<Incident> {
  return api.post<Incident>(`/api/enforcer/incidents/${id}/ticket`, payload);
}

export async function dismissIncident(id: string, payload: DismissIncidentRequest): Promise<Incident> {
  return api.post<Incident>(`/api/enforcer/incidents/${id}/dismiss`, payload);
}
