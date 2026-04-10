import type {
  SessionResponseDto,
  UserProfileResponseDto,
} from "@/lib/contracts";
import { AUTH_SESSION_BOOTSTRAP_TIMEOUT_MS } from "./authSession";

import { authenticatedFetch } from "./api";
import { SWR_KEYS } from "./swrKeys";

type TimedRequestResult<T> =
  | { type: "success"; value: T }
  | { type: "error"; error: unknown }
  | { type: "timeout" };

async function resolveWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const requestPromise: Promise<TimedRequestResult<T>> = promise.then(
    (value) => ({ type: "success", value }),
    (error) => ({ type: "error", error }),
  );

  const timeoutPromise = new Promise<TimedRequestResult<T>>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({ type: "timeout" });
    }, timeoutMs);
  });

  const result = await Promise.race([requestPromise, timeoutPromise]);

  if (timeoutId !== null) {
    clearTimeout(timeoutId);
  }

  if (result.type === "error") {
    throw result.error;
  }

  if (result.type === "timeout") {
    console.warn("[/api/auth/session] bootstrap timed out; falling back to unauthenticated state");
    return null;
  }

  return result.value;
}

export async function fetchSessionResponse(): Promise<SessionResponseDto | null> {
  return resolveWithTimeout(
    (async () => {
      const response = await authenticatedFetch(SWR_KEYS.authSession);
      const payload = await response.json().catch(() => undefined);

      if (response.status === 401) {
        return null;
      }

      if (!response.ok) {
        throw new Error(payload?.message || "Failed to fetch auth session");
      }

      return payload as SessionResponseDto;
    })(),
    AUTH_SESSION_BOOTSTRAP_TIMEOUT_MS,
  );
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
