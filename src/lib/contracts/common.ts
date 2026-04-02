export type UserRole = "ADMIN" | "DATA_ENCODER" | "ENFORCER" | "PUBLIC";

export interface PaginationDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
