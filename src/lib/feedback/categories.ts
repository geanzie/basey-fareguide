import type { FeedbackCategoryDto, FeedbackStatusDto } from "@/lib/contracts";

/** Display order for the picker on the form and the admin filter chips. */
export const FEEDBACK_CATEGORIES = [
  "FARE_CALCULATOR",
  "MAP_ROUTES",
  "ACCOUNT",
  "BUG",
  "SUGGESTION",
  "OTHER",
] as const;

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategoryDto, string> = {
  FARE_CALCULATOR: "Fare Calculator",
  MAP_ROUTES: "Map & Routes",
  ACCOUNT: "My Account",
  BUG: "Something Broken",
  SUGGESTION: "Suggestion",
  OTHER: "Other",
};

export const FEEDBACK_STATUSES = ["NEW", "REVIEWED", "RESOLVED"] as const;

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatusDto, string> = {
  NEW: "New",
  REVIEWED: "Reviewed",
  RESOLVED: "Resolved",
};

export const FEEDBACK_MESSAGE_MIN_LENGTH = 10;
export const FEEDBACK_MESSAGE_MAX_LENGTH = 1000;
export const FEEDBACK_REVIEW_NOTES_MAX_LENGTH = 1000;
/** Submissions one account may send in a rolling 24 hours. */
export const FEEDBACK_DAILY_LIMIT = 5;

export function isFeedbackCategory(value: unknown): value is FeedbackCategoryDto {
  return (
    typeof value === "string" &&
    (FEEDBACK_CATEGORIES as readonly string[]).includes(value)
  );
}

export function isFeedbackStatus(value: unknown): value is FeedbackStatusDto {
  return (
    typeof value === "string" &&
    (FEEDBACK_STATUSES as readonly string[]).includes(value)
  );
}

export function isFeedbackRating(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}
