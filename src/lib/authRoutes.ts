import type { UserRole } from "@/lib/contracts";

export const LOGIN_ROUTE = "/auth";
/** Old sign-in path; the page redirects to LOGIN_ROUTE so existing links keep working. */
export const LEGACY_LOGIN_ROUTE = "/login";
/** Where social sign-in sends a user who has no account yet. */
export const SOCIAL_SIGNUP_ROUTE = "/register/social";
export const POST_LOGOUT_ROUTE = LOGIN_ROUTE;
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
    pathname === LEGACY_LOGIN_ROUTE ||
    pathname.startsWith(`${LEGACY_LOGIN_ROUTE}/`) ||
    pathname === SOCIAL_SIGNUP_ROUTE
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
