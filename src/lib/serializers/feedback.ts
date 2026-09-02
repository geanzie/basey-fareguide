import type {
  AdminUserFeedbackDto,
  FeedbackCategoryDto,
  FeedbackStatusDto,
  UserFeedbackDto,
  UserRole,
} from "@/lib/contracts";
import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_STATUS_LABELS,
} from "@/lib/feedback/categories";

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatActorName(
  actor:
    | {
        firstName?: string | null;
        lastName?: string | null;
        username?: string | null;
      }
    | null
    | undefined,
): string | null {
  if (!actor) {
    return null;
  }

  const fullName = [actor.firstName, actor.lastName].filter(Boolean).join(" ").trim();
  if (fullName) {
    return actor.username ? `${fullName} (@${actor.username})` : fullName;
  }

  return actor.username ? `@${actor.username}` : null;
}

interface FeedbackRecord {
  id: string;
  category: FeedbackCategoryDto;
  rating: number;
  message: string;
  status: FeedbackStatusDto;
  createdAt: Date | string;
}

interface AdminFeedbackRecord extends FeedbackRecord {
  userId: string;
  user?: {
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    userType: UserRole;
  } | null;
  reviewedById?: string | null;
  reviewedBy?: {
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
  } | null;
  reviewedAt?: Date | string | null;
  reviewNotes?: string | null;
  updatedAt: Date | string;
}

export function serializeUserFeedback(input: FeedbackRecord): UserFeedbackDto {
  return {
    id: input.id,
    category: input.category,
    categoryLabel: FEEDBACK_CATEGORY_LABELS[input.category],
    rating: input.rating,
    message: input.message,
    status: input.status,
    statusLabel: FEEDBACK_STATUS_LABELS[input.status],
    createdAt: toIsoString(input.createdAt) ?? new Date(0).toISOString(),
  };
}

export function serializeAdminUserFeedback(
  input: AdminFeedbackRecord,
): AdminUserFeedbackDto {
  return {
    ...serializeUserFeedback(input),
    submittedById: input.userId,
    submittedByName: formatActorName(input.user),
    submittedByRole: input.user?.userType ?? "PUBLIC",
    reviewedById: input.reviewedById ?? null,
    reviewedByName: formatActorName(input.reviewedBy),
    reviewedAt: toIsoString(input.reviewedAt),
    reviewNotes: input.reviewNotes ?? null,
    updatedAt: toIsoString(input.updatedAt) ?? new Date(0).toISOString(),
  };
}
