import type { UserRole } from "@/lib/contracts";

export const LOGIN_ROUTE = "/login";
export const LEGACY_AUTH_ROUTE = "/auth";
export const AUTHENTICATED_ROLES = [
  "ADMIN",
  "DATA_ENCODER",
  "ENFORCER",
  "PUBLIC",
] as const satisfies readonly UserRole[];

export function isAuthRoute(pathname: string | null | undefined): boolean {
  if (!pathname) {
    return false;
  }

  return (
    pathname === LOGIN_ROUTE ||
    pathname.startsWith(`${LOGIN_ROUTE}/`) ||
    pathname === LEGACY_AUTH_ROUTE ||
    pathname.startsWith(`${LEGACY_AUTH_ROUTE}/`)
  );
}
