import type {
  SessionResponseDto,
  SessionUserDto,
  UserProfileDto,
  UserProfileResponseDto,
} from "@/lib/contracts";

import { authenticatedFetch } from "./api";
import { SWR_KEYS } from "./swrKeys";

export async function fetchSessionResponse(): Promise<SessionResponseDto | null> {
  const response = await authenticatedFetch(SWR_KEYS.authSession);
  const payload = await response.json().catch(() => undefined);

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(payload?.message || "Failed to fetch auth session");
  }

  return payload as SessionResponseDto;
}

export async function fetchUserProfileResponse(): Promise<UserProfileResponseDto | null> {
  const response = await authenticatedFetch(SWR_KEYS.userProfile);
  const payload = await response.json().catch(() => undefined);

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(payload?.message || "Failed to fetch user profile");
  }

  return payload as UserProfileResponseDto;
}

export function buildOptimisticUserProfileResponse(
  user: SessionUserDto,
): UserProfileResponseDto {
  const optimisticUser: UserProfileDto = {
    ...user,
    email: null,
    phoneNumber: null,
    dateOfBirth: null,
    governmentId: null,
    idType: null,
    barangayResidence: null,
    employeeId: null,
    createdAt: new Date().toISOString(),
  };

  return {
    user: optimisticUser,
  };
}
