export type UserRole = "ADMIN" | "DATA_ENCODER" | "ENFORCER" | "DRIVER" | "PUBLIC";

export interface PaginationDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
