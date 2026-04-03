import type { SessionUserDto, UserProfileDto, UserProfileResponseDto } from "@/lib/contracts";

import { authenticatedFetch } from "./api";
import { SWR_KEYS } from "./swrKeys";

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
    barangayResidence: null,
    createdAt: new Date().toISOString(),
  };

  return {
    user: optimisticUser,
  };
}
