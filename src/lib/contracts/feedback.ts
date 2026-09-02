import type { PaginationDto, UserRole } from "./common";

export type FeedbackCategoryDto =
  | "FARE_CALCULATOR"
  | "MAP_ROUTES"
  | "ACCOUNT"
  | "BUG"
  | "SUGGESTION"
  | "OTHER";

export type FeedbackStatusDto = "NEW" | "REVIEWED" | "RESOLVED";

export interface UserFeedbackDto {
  id: string;
  category: FeedbackCategoryDto;
  categoryLabel: string;
  rating: number;
  message: string;
  status: FeedbackStatusDto;
  statusLabel: string;
  createdAt: string;
}

export interface AdminUserFeedbackDto extends UserFeedbackDto {
  submittedById: string;
  submittedByName: string | null;
  submittedByRole: UserRole;
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  updatedAt: string;
}

export interface CreateUserFeedbackRequestDto {
  category: FeedbackCategoryDto;
  rating: number;
  message: string;
}

export interface CreateUserFeedbackResponseDto {
  feedback: UserFeedbackDto;
}

export type FeedbackStatusCountsDto = Record<FeedbackStatusDto | "all", number>;

export interface AdminUserFeedbackListResponseDto {
  feedback: AdminUserFeedbackDto[];
  pagination: PaginationDto;
  counts: FeedbackStatusCountsDto;
}

export interface UpdateUserFeedbackRequestDto {
  status: FeedbackStatusDto;
  reviewNotes?: string | null;
}

export interface AdminUserFeedbackResponseDto {
  feedback: AdminUserFeedbackDto;
}
