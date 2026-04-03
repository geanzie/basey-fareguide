import { parseManilaDateTimeInput } from "@/lib/manilaTime";
import {
  ANNOUNCEMENT_BODY_MAX_LENGTH,
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
  isAnnouncementCategory,
  type AnnouncementCategoryValue,
} from "@/lib/announcements/categories";

export interface AnnouncementInputPayload {
  title: string;
  body: string;
  category: AnnouncementCategoryValue;
  startsAt: Date;
  endsAt: Date | null;
}

export function validateAnnouncementPayload(
  input: unknown,
): { data: AnnouncementInputPayload | null; error: string | null } {
  const body = typeof input === "object" && input !== null ? input as Record<string, unknown> : {};
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const announcementBody = typeof body.body === "string" ? body.body.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const startsAtInput = typeof body.startsAt === "string" ? body.startsAt.trim() : "";
  const endsAtInput = typeof body.endsAt === "string" ? body.endsAt.trim() : "";

  if (!title) {
    return { data: null, error: "A headline is required." };
  }

  if (title.length > ANNOUNCEMENT_TITLE_MAX_LENGTH) {
    return {
      data: null,
      error: `Headlines must be ${ANNOUNCEMENT_TITLE_MAX_LENGTH} characters or fewer.`,
    };
  }

  if (!announcementBody) {
    return { data: null, error: "Announcement body text is required." };
  }

  if (announcementBody.length > ANNOUNCEMENT_BODY_MAX_LENGTH) {
    return {
      data: null,
      error: `Announcement body text must be ${ANNOUNCEMENT_BODY_MAX_LENGTH} characters or fewer.`,
    };
  }

  if (!isAnnouncementCategory(category)) {
    return { data: null, error: "A valid announcement category is required." };
  }

  if (!startsAtInput) {
    return { data: null, error: "A start date and time is required." };
  }

  const startsAt = parseManilaDateTimeInput(startsAtInput);
  if (!startsAt) {
    return { data: null, error: "Invalid start date and time." };
  }

  const endsAt = endsAtInput ? parseManilaDateTimeInput(endsAtInput) : null;
  if (endsAtInput && !endsAt) {
    return { data: null, error: "Invalid end date and time." };
  }

  if (endsAt && endsAt <= startsAt) {
    return {
      data: null,
      error: "End date and time must be later than the start date and time.",
    };
  }

  return {
    data: {
      title,
      body: announcementBody,
      category,
      startsAt,
      endsAt,
    },
    error: null,
  };
}
