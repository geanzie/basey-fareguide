import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const txMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
}));

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $transaction: vi.fn(async (callback: (tx: typeof txMock) => unknown) => callback(txMock)),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  ADMIN_ANNOUNCEMENT_BATCH_SIZE,
  ANNOUNCEMENT_MIGRATION_REQUIRED_MESSAGE,
  getAdminAnnouncements,
  getPublicAnnouncements,
  PUBLIC_ANNOUNCEMENT_LIMIT,
} from "@/lib/announcements/service";

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "announcement-1",
    title: "Road closure",
    body: "Main road is closed for repairs.",
    category: "ROAD_CLOSURE",
    startsAt: "2026-04-03T00:00:00.000Z",
    endsAt: null,
    createdAt: "2026-04-02T12:00:00.000Z",
    updatedAt: "2026-04-02T12:00:00.000Z",
    createdBy: "admin-1",
    updatedBy: "admin-1",
    archivedAt: null,
    archivedBy: null,
    createdByFirstName: "Admin",
    createdByLastName: "User",
    createdByUsername: "admin",
    updatedByFirstName: "Admin",
    updatedByLastName: "User",
    updatedByUsername: "admin",
    archivedByFirstName: null,
    archivedByLastName: null,
    archivedByUsername: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-03T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("announcement service", () => {
  it("returns the newest three active announcements for public users", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      makeRow({ id: "a2", title: "Second", startsAt: "2026-04-03T05:00:00.000Z" }),
      makeRow({ id: "a4", title: "Fourth", startsAt: "2026-04-03T09:00:00.000Z" }),
      makeRow({ id: "a1", title: "First", startsAt: "2026-04-02T10:00:00.000Z" }),
      makeRow({ id: "a3", title: "Third", startsAt: "2026-04-03T07:00:00.000Z" }),
    ]);

    const response = await getPublicAnnouncements();

    expect(response.announcements.map((announcement) => announcement.id)).toEqual([
      "a4",
      "a3",
      "a2",
    ]);
    expect(response.announcements).toHaveLength(3);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("groups admin announcements into active, scheduled, and history buckets", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      makeRow({ id: "scheduled-1", title: "Scheduled", startsAt: "2026-04-04T00:00:00.000Z" }),
      makeRow({ id: "active-1", title: "Active", startsAt: "2026-04-03T01:00:00.000Z" }),
      makeRow({
        id: "expired-1",
        title: "Expired",
        startsAt: "2026-04-01T00:00:00.000Z",
        endsAt: "2026-04-02T23:00:00.000Z",
      }),
      makeRow({
        id: "archived-1",
        title: "Archived",
        startsAt: "2026-04-01T02:00:00.000Z",
        archivedAt: "2026-04-03T10:00:00.000Z",
        archivedBy: "admin-2",
        archivedByFirstName: "Traffic",
        archivedByLastName: "Desk",
        archivedByUsername: "trafficdesk",
      }),
    ]);

    const response = await getAdminAnnouncements();

    expect(response.warning).toBeNull();
    expect(response.active.map((announcement) => announcement.id)).toEqual(["active-1"]);
    expect(response.scheduled.map((announcement) => announcement.id)).toEqual(["scheduled-1"]);
    expect(response.history.map((announcement) => announcement.id)).toEqual([
      "archived-1",
      "expired-1",
    ]);
  });

  it("loads admin announcements in bounded batches while preserving grouped output", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        makeRow({ id: "scheduled-1", title: "Scheduled", startsAt: "2026-04-04T00:00:00.000Z" }),
        makeRow({ id: "active-1", title: "Active", startsAt: "2026-04-03T01:00:00.000Z" }),
      ])
      .mockResolvedValueOnce([
        makeRow({
          id: "expired-1",
          title: "Expired",
          startsAt: "2026-04-01T00:00:00.000Z",
          endsAt: "2026-04-02T23:00:00.000Z",
        }),
        makeRow({
          id: "archived-1",
          title: "Archived",
          startsAt: "2026-04-01T02:00:00.000Z",
          archivedAt: "2026-04-03T10:00:00.000Z",
          archivedBy: "admin-2",
          archivedByFirstName: "Traffic",
          archivedByLastName: "Desk",
          archivedByUsername: "trafficdesk",
        }),
      ])
      .mockResolvedValueOnce([]);

    const response = await getAdminAnnouncements(new Date("2026-04-03T12:00:00.000Z"), {
      batchSize: 2,
    });

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(3);
    expect(response.active.map((announcement) => announcement.id)).toEqual(["active-1"]);
    expect(response.scheduled.map((announcement) => announcement.id)).toEqual(["scheduled-1"]);
    expect(response.history.map((announcement) => announcement.id)).toEqual([
      "archived-1",
      "expired-1",
    ]);
  });

  it("returns a migration warning shell when the announcements table is missing", async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error('relation "announcements" does not exist'));

    const response = await getAdminAnnouncements();

    expect(response).toEqual({
      active: [],
      scheduled: [],
      history: [],
      warning: ANNOUNCEMENT_MIGRATION_REQUIRED_MESSAGE,
    });
  });

  it("exports the raw-SQL safety limits for the announcement family", () => {
    expect(PUBLIC_ANNOUNCEMENT_LIMIT).toBe(3);
    expect(ADMIN_ANNOUNCEMENT_BATCH_SIZE).toBeGreaterThan(0);
  });
});
