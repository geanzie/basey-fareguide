export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  requiresAuth?: boolean;
}

export interface Location {
  id: string;
  name: string;
  barangay?: string;
  coordinates: string;
  isActive: boolean;
}

export type AnnouncementCategory =
  | 'EMERGENCY_NOTICE'
  | 'ROAD_CLOSURE'
  | 'ROAD_WORK'
  | 'TRAFFIC_ADVISORY'
  | 'GENERAL_INFORMATION';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
