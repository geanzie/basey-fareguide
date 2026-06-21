import { api } from './api';
import type { Announcement, AnnouncementCategory } from '@/types/common';

export async function fetchActiveAnnouncements(): Promise<{ items: Announcement[] }> {
  const res = await api.get<{ announcements: Announcement[] }>('/api/announcements?isActive=true');
  return { items: res.announcements ?? [] };
}

export async function createAnnouncement(payload: {
  title: string;
  content: string;
  category: AnnouncementCategory;
}): Promise<Announcement> {
  return api.post<Announcement>('/api/admin/announcements', payload);
}

export async function archiveAnnouncement(id: string): Promise<Announcement> {
  return api.patch<Announcement>(`/api/admin/announcements/${id}`, { isActive: false });
}
