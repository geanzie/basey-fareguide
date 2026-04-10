export interface PaginationConfig {
  defaultPage?: number;
  defaultLimit: number;
  maxLimit: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function coercePositiveInteger(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return parsedValue;
}

export function parsePaginationParams(
  searchParams: URLSearchParams,
  config: PaginationConfig,
): PaginationParams {
  const page = coercePositiveInteger(searchParams.get("page"), config.defaultPage ?? 1);
  const requestedLimit = coercePositiveInteger(searchParams.get("limit"), config.defaultLimit);
  const limit = Math.min(requestedLimit, config.maxLimit);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

export function buildPaginationMetadata(
  params: Pick<PaginationParams, "page" | "limit">,
  total: number,
): PaginationMetadata {
  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages: total > 0 ? Math.ceil(total / params.limit) : 0,
  };
}