import type { UserRole } from "@/lib/contracts";

export const LOGIN_ROUTE = "/login";
export const LEGACY_AUTH_ROUTE = "/auth";
export const POST_LOGOUT_ROUTE = "/";
export const AUTHENTICATED_ROLES = [
  "ADMIN",
  "DATA_ENCODER",
  "ENFORCER",
  "DRIVER",
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

export function getAuthenticatedHomeRoute(userType: UserRole | null | undefined): string {
  switch (userType) {
    case "ADMIN":
      return "/admin";
    case "DATA_ENCODER":
      return "/encoder";
    case "ENFORCER":
      return "/enforcer";
    case "DRIVER":
      return "/driver";
    case "PUBLIC":
    default:
      return "/dashboard";
  }
}
