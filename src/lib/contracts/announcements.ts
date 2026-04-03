export type AnnouncementCategoryDto =
  | "EMERGENCY_NOTICE"
  | "ROAD_CLOSURE"
  | "ROAD_WORK"
  | "TRAFFIC_ADVISORY";

export type AnnouncementStatusDto = "scheduled" | "active" | "expired" | "archived";

export interface PublicAnnouncementDto {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategoryDto;
  categoryLabel: string;
  startsAt: string;
  endsAt: string | null;
}

export interface AnnouncementsResponseDto {
  announcements: PublicAnnouncementDto[];
}

export interface AdminAnnouncementDto extends PublicAnnouncementDto {
  createdAt: string;
  updatedAt: string;
  status: AnnouncementStatusDto;
  createdById: string;
  createdByName: string | null;
  updatedById: string;
  updatedByName: string | null;
  archivedAt: string | null;
  archivedById: string | null;
  archivedByName: string | null;
}

export interface AdminAnnouncementsResponseDto {
  active: AdminAnnouncementDto[];
  scheduled: AdminAnnouncementDto[];
  history: AdminAnnouncementDto[];
  warning?: string | null;
}

export interface AdminAnnouncementMutationResponseDto {
  success: boolean;
  announcement: AdminAnnouncementDto;
  message: string;
}
