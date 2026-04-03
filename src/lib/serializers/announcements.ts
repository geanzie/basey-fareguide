import type {
  AdminAnnouncementDto,
  AnnouncementCategoryDto,
  AnnouncementStatusDto,
  PublicAnnouncementDto,
} from "@/lib/contracts";
import { ANNOUNCEMENT_CATEGORY_LABELS } from "@/lib/announcements/categories";

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatActorName(actor: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
} | null | undefined): string | null {
  if (!actor) {
    return null;
  }

  const fullName = [actor.firstName, actor.lastName].filter(Boolean).join(" ").trim();
  if (fullName) {
    return actor.username ? `${fullName} (@${actor.username})` : fullName;
  }

  return actor.username ? `@${actor.username}` : null;
}

export function serializePublicAnnouncement(input: {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategoryDto;
  startsAt: Date | string;
  endsAt?: Date | string | null;
}): PublicAnnouncementDto {
  return {
    id: input.id,
    title: input.title,
    body: input.body,
    category: input.category,
    categoryLabel: ANNOUNCEMENT_CATEGORY_LABELS[input.category],
    startsAt: toIsoString(input.startsAt) ?? new Date(0).toISOString(),
    endsAt: toIsoString(input.endsAt),
  };
}

export function serializeAdminAnnouncement(input: {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategoryDto;
  startsAt: Date | string;
  endsAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  createdBy: string;
  updatedBy: string;
  archivedAt?: Date | string | null;
  archivedBy?: string | null;
  createdByUser?: {
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
  } | null;
  updatedByUser?: {
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
  } | null;
  archivedByUser?: {
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
  } | null;
  status: AnnouncementStatusDto;
}): AdminAnnouncementDto {
  return {
    ...serializePublicAnnouncement(input),
    createdAt: toIsoString(input.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(input.updatedAt) ?? new Date(0).toISOString(),
    status: input.status,
    createdById: input.createdBy,
    createdByName: formatActorName(input.createdByUser),
    updatedById: input.updatedBy,
    updatedByName: formatActorName(input.updatedByUser),
    archivedAt: toIsoString(input.archivedAt),
    archivedById: input.archivedBy ?? null,
    archivedByName: formatActorName(input.archivedByUser),
  };
}
