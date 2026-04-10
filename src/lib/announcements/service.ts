import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";

import type {
  AdminAnnouncementDto,
  AdminAnnouncementsResponseDto,
  AnnouncementsResponseDto,
  AnnouncementStatusDto,
} from "@/lib/contracts";
import { prisma } from "@/lib/prisma";
import { serializeAdminAnnouncement, serializePublicAnnouncement } from "@/lib/serializers";
import type { AnnouncementCategoryValue } from "@/lib/announcements/categories";

export const ANNOUNCEMENT_MIGRATION_REQUIRED_MESSAGE =
  "Traffic announcement management is waiting on database migrations. Run `npx prisma migrate deploy` against the active database to enable admin scheduling and public traffic notices.";

export const PUBLIC_ANNOUNCEMENT_LIMIT = 3;
export const ADMIN_ANNOUNCEMENT_BATCH_SIZE = 200;

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategoryValue;
  startsAt: Date | string;
  endsAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  createdBy: string;
  updatedBy: string;
  archivedAt: Date | string | null;
  archivedBy: string | null;
  createdByFirstName: string | null;
  createdByLastName: string | null;
  createdByUsername: string | null;
  updatedByFirstName: string | null;
  updatedByLastName: string | null;
  updatedByUsername: string | null;
  archivedByFirstName: string | null;
  archivedByLastName: string | null;
  archivedByUsername: string | null;
}

interface SqlRunner {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
  $executeRaw(query: Prisma.Sql): Promise<number>;
}

interface AdminAnnouncementQueryOptions {
  batchSize?: number;
}

export class AnnouncementNotFoundError extends Error {
  constructor() {
    super("Announcement not found.");
    this.name = "AnnouncementNotFoundError";
  }
}

export class AnnouncementStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnnouncementStateError";
  }
}

export class AnnouncementMigrationRequiredError extends Error {
  constructor() {
    super(ANNOUNCEMENT_MIGRATION_REQUIRED_MESSAGE);
    this.name = "AnnouncementMigrationRequiredError";
  }
}

const announcementRowSelect = Prisma.sql`
  SELECT
    a."id",
    a."title",
    a."body",
    a."category"::text AS "category",
    a."startsAt",
    a."endsAt",
    a."createdAt",
    a."updatedAt",
    a."createdBy",
    a."updatedBy",
    a."archivedAt",
    a."archivedBy",
    created_user."firstName" AS "createdByFirstName",
    created_user."lastName" AS "createdByLastName",
    created_user."username" AS "createdByUsername",
    updated_user."firstName" AS "updatedByFirstName",
    updated_user."lastName" AS "updatedByLastName",
    updated_user."username" AS "updatedByUsername",
    archived_user."firstName" AS "archivedByFirstName",
    archived_user."lastName" AS "archivedByLastName",
    archived_user."username" AS "archivedByUsername"
  FROM "announcements" a
  LEFT JOIN "users" created_user ON created_user."id" = a."createdBy"
  LEFT JOIN "users" updated_user ON updated_user."id" = a."updatedBy"
  LEFT JOIN "users" archived_user ON archived_user."id" = a."archivedBy"
`;

const announcementNewestFirstOrder = Prisma.sql`
  ORDER BY a."startsAt" DESC, a."createdAt" DESC, a."id" DESC
`;

function isAnnouncementTableMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = `${error.name} ${error.message}`.toLowerCase();
  return (
    message.includes("p2021") ||
    message.includes("42p01") ||
    message.includes("announcements") ||
    message.includes("announcementcategory")
  );
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getAnnouncementStatus(
  announcement: Pick<AnnouncementRow, "startsAt" | "endsAt" | "archivedAt">,
  now: Date = new Date(),
): AnnouncementStatusDto {
  if (announcement.archivedAt) {
    return "archived";
  }

  const startsAt = toDate(announcement.startsAt);
  const endsAt = toDate(announcement.endsAt);

  if (startsAt && startsAt > now) {
    return "scheduled";
  }

  if (endsAt && endsAt <= now) {
    return "expired";
  }

  return "active";
}

function sortRowsNewestFirst(rows: AnnouncementRow[]): AnnouncementRow[] {
  return [...rows].sort((left, right) => {
    const leftStartsAt = toDate(left.startsAt)?.getTime() ?? 0;
    const rightStartsAt = toDate(right.startsAt)?.getTime() ?? 0;
    if (rightStartsAt !== leftStartsAt) {
      return rightStartsAt - leftStartsAt;
    }

    const leftCreatedAt = toDate(left.createdAt)?.getTime() ?? 0;
    const rightCreatedAt = toDate(right.createdAt)?.getTime() ?? 0;
    if (rightCreatedAt !== leftCreatedAt) {
      return rightCreatedAt - leftCreatedAt;
    }

    return right.id.localeCompare(left.id);
  });
}

async function queryAnnouncementRows(
  runner: SqlRunner,
  options?: {
    where?: Prisma.Sql;
    limit?: number;
    offset?: number;
  },
): Promise<AnnouncementRow[]> {
  const whereClause = options?.where ?? Prisma.empty;
  const paginationClause =
    typeof options?.limit === "number"
      ? Prisma.sql`LIMIT ${options.limit} OFFSET ${options.offset ?? 0}`
      : Prisma.empty;

  return runner.$queryRaw<AnnouncementRow[]>(Prisma.sql`
    ${announcementRowSelect}
    ${whereClause}
    ${announcementNewestFirstOrder}
    ${paginationClause}
  `);
}

async function queryAdminAnnouncementRowsInBatches(
  runner: SqlRunner,
  batchSize: number,
): Promise<AnnouncementRow[]> {
  const rows: AnnouncementRow[] = [];
  let offset = 0;

  while (true) {
    const batch = await queryAnnouncementRows(runner, {
      limit: batchSize,
      offset,
    });

    rows.push(...batch);

    if (batch.length < batchSize) {
      return rows;
    }

    offset += batchSize;
  }
}

function serializeAnnouncementRow(
  row: AnnouncementRow,
  status: AnnouncementStatusDto,
): AdminAnnouncementDto {
  return serializeAdminAnnouncement({
    ...row,
    status,
    createdByUser: {
      firstName: row.createdByFirstName,
      lastName: row.createdByLastName,
      username: row.createdByUsername,
    },
    updatedByUser: {
      firstName: row.updatedByFirstName,
      lastName: row.updatedByLastName,
      username: row.updatedByUsername,
    },
    archivedByUser: row.archivedBy
      ? {
          firstName: row.archivedByFirstName,
          lastName: row.archivedByLastName,
          username: row.archivedByUsername,
        }
      : null,
  });
}

async function fetchAnnouncementById(
  id: string,
  runner: SqlRunner = prisma,
): Promise<AnnouncementRow | null> {
  const rows = await runner.$queryRaw<AnnouncementRow[]>(Prisma.sql`
    ${announcementRowSelect}
    WHERE a."id" = ${id}
    LIMIT 1
  `);

  return rows[0] ?? null;
}

export async function getPublicAnnouncements(now: Date = new Date()): Promise<AnnouncementsResponseDto> {
  let rows: AnnouncementRow[];

  try {
    rows = await queryAnnouncementRows(prisma, {
      where: Prisma.sql`
        WHERE a."archivedAt" IS NULL
          AND a."startsAt" <= ${now}
          AND (a."endsAt" IS NULL OR a."endsAt" > ${now})
      `,
      limit: PUBLIC_ANNOUNCEMENT_LIMIT,
    });
  } catch (error) {
    if (isAnnouncementTableMissingError(error)) {
      return { announcements: [] };
    }

    throw error;
  }

  return {
    announcements: sortRowsNewestFirst(rows)
      .slice(0, PUBLIC_ANNOUNCEMENT_LIMIT)
      .map((row) =>
        serializePublicAnnouncement({
          id: row.id,
          title: row.title,
          body: row.body,
          category: row.category,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
        }),
      ),
  };
}

export async function getAdminAnnouncements(
  now: Date = new Date(),
  options?: AdminAnnouncementQueryOptions,
): Promise<AdminAnnouncementsResponseDto> {
  let rows: AnnouncementRow[];
  const batchSize = Math.max(1, options?.batchSize ?? ADMIN_ANNOUNCEMENT_BATCH_SIZE);

  try {
    rows = await queryAdminAnnouncementRowsInBatches(prisma, batchSize);
  } catch (error) {
    if (isAnnouncementTableMissingError(error)) {
      return {
        active: [],
        scheduled: [],
        history: [],
        warning: ANNOUNCEMENT_MIGRATION_REQUIRED_MESSAGE,
      };
    }

    throw error;
  }

  const active: AdminAnnouncementDto[] = [];
  const scheduled: AdminAnnouncementDto[] = [];
  const history: AdminAnnouncementDto[] = [];

  for (const row of sortRowsNewestFirst(rows)) {
    const status = getAnnouncementStatus(row, now);
    const serialized = serializeAnnouncementRow(row, status);

    if (status === "active") {
      active.push(serialized);
      continue;
    }

    if (status === "scheduled") {
      scheduled.push(serialized);
      continue;
    }

    history.push(serialized);
  }

  return {
    active,
    scheduled,
    history,
    warning: null,
  };
}

interface AnnouncementWriteInput {
  adminUserId: string;
  title: string;
  body: string;
  category: AnnouncementCategoryValue;
  startsAt: Date;
  endsAt: Date | null;
}

export async function createAnnouncement(input: AnnouncementWriteInput): Promise<AdminAnnouncementDto> {
  const now = new Date();
  const id = randomUUID();
  let announcement: AnnouncementRow | null;

  try {
    announcement = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "announcements" (
          "id",
          "title",
          "body",
          "category",
          "startsAt",
          "endsAt",
          "createdAt",
          "updatedAt",
          "createdBy",
          "updatedBy"
        ) VALUES (
          ${id},
          ${input.title},
          ${input.body},
          CAST(${input.category} AS "AnnouncementCategory"),
          ${input.startsAt},
          ${input.endsAt},
          ${now},
          ${now},
          ${input.adminUserId},
          ${input.adminUserId}
        )
      `);

      return fetchAnnouncementById(id, tx);
    });
  } catch (error) {
    if (isAnnouncementTableMissingError(error)) {
      throw new AnnouncementMigrationRequiredError();
    }

    throw error;
  }

  if (!announcement) {
    throw new AnnouncementNotFoundError();
  }

  return serializeAnnouncementRow(announcement, getAnnouncementStatus(announcement, now));
}

export async function updateAnnouncement(
  id: string,
  input: AnnouncementWriteInput,
): Promise<AdminAnnouncementDto> {
  const now = new Date();
  let updated: AnnouncementRow | null;

  try {
    updated = await prisma.$transaction(async (tx) => {
      const existing = await fetchAnnouncementById(id, tx);
      if (!existing) {
        throw new AnnouncementNotFoundError();
      }

      const status = getAnnouncementStatus(existing, now);
      if (status !== "active" && status !== "scheduled") {
        throw new AnnouncementStateError("Only active and scheduled announcements can be edited.");
      }

      await tx.$executeRaw(Prisma.sql`
        UPDATE "announcements"
        SET
          "title" = ${input.title},
          "body" = ${input.body},
          "category" = CAST(${input.category} AS "AnnouncementCategory"),
          "startsAt" = ${input.startsAt},
          "endsAt" = ${input.endsAt},
          "updatedAt" = ${now},
          "updatedBy" = ${input.adminUserId}
        WHERE "id" = ${id}
      `);

      return fetchAnnouncementById(id, tx);
    });
  } catch (error) {
    if (isAnnouncementTableMissingError(error)) {
      throw new AnnouncementMigrationRequiredError();
    }

    throw error;
  }

  if (!updated) {
    throw new AnnouncementNotFoundError();
  }

  return serializeAnnouncementRow(updated, getAnnouncementStatus(updated, now));
}

export async function archiveAnnouncement(
  id: string,
  adminUserId: string,
): Promise<AdminAnnouncementDto> {
  const now = new Date();
  let archived: AnnouncementRow | null;

  try {
    archived = await prisma.$transaction(async (tx) => {
      const existing = await fetchAnnouncementById(id, tx);
      if (!existing) {
        throw new AnnouncementNotFoundError();
      }

      const status = getAnnouncementStatus(existing, now);
      if (status !== "active" && status !== "scheduled") {
        throw new AnnouncementStateError("Only active and scheduled announcements can be archived.");
      }

      await tx.$executeRaw(Prisma.sql`
        UPDATE "announcements"
        SET
          "archivedAt" = ${now},
          "archivedBy" = ${adminUserId},
          "updatedAt" = ${now},
          "updatedBy" = ${adminUserId}
        WHERE "id" = ${id}
      `);

      return fetchAnnouncementById(id, tx);
    });
  } catch (error) {
    if (isAnnouncementTableMissingError(error)) {
      throw new AnnouncementMigrationRequiredError();
    }

    throw error;
  }

  if (!archived) {
    throw new AnnouncementNotFoundError();
  }

  return serializeAnnouncementRow(archived, getAnnouncementStatus(archived, now));
}
