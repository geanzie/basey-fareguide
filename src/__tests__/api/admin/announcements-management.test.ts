import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status =
      message === "Unauthorized" ? 401 :
      message === "Forbidden" ? 403 :
      500;

    return new Response(JSON.stringify({ message }), { status });
  }),
}));

const announcementServiceMock = vi.hoisted(() => {
  class AnnouncementMigrationRequiredError extends Error {
    constructor() {
      super("migration required");
      this.name = "AnnouncementMigrationRequiredError";
    }
  }

  return {
    getAdminAnnouncements: vi.fn(),
    createAnnouncement: vi.fn(),
    updateAnnouncement: vi.fn(),
    archiveAnnouncement: vi.fn(),
    AnnouncementMigrationRequiredError,
    AnnouncementNotFoundError: class AnnouncementNotFoundError extends Error {},
    AnnouncementStateError: class AnnouncementStateError extends Error {},
    ANNOUNCEMENT_MIGRATION_REQUIRED_MESSAGE:
      "Traffic announcement management is waiting on database migrations. Run `npx prisma migrate deploy` against the active database to enable admin scheduling and public traffic notices.",
  };
});

vi.mock("@/lib/auth", () => ({
  ADMIN_ONLY: ["ADMIN"],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}));

vi.mock("@/lib/announcements/service", () => announcementServiceMock);

import { GET as listAnnouncements, POST as createAnnouncementRoute } from "@/app/api/admin/announcements/route";
import { PATCH as updateAnnouncementRoute } from "@/app/api/admin/announcements/[id]/route";
import { POST as archiveAnnouncementRoute } from "@/app/api/admin/announcements/[id]/archive/route";

function makeJsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body == null ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-03T00:00:00.000Z"));
  authMock.requireRequestRole.mockResolvedValue({ id: "admin-1", userType: "ADMIN" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("admin announcements routes", () => {
  it("enforces admin authentication for the list route", async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error("Unauthorized"));

    const response = await listAnnouncements(
      makeJsonRequest("http://localhost/api/admin/announcements", "GET") as never,
    );

    expect(response.status).toBe(401);
    expect(announcementServiceMock.getAdminAnnouncements).not.toHaveBeenCalled();
  });

  it("lists grouped admin announcement data", async () => {
    announcementServiceMock.getAdminAnnouncements.mockResolvedValueOnce({
      active: [],
      scheduled: [],
      history: [],
      warning: null,
    });

    const response = await listAnnouncements(
      makeJsonRequest("http://localhost/api/admin/announcements", "GET") as never,
    );

    expect(response.status).toBe(200);
    expect(announcementServiceMock.getAdminAnnouncements).toHaveBeenCalled();
  });

  it("validates create payloads before calling the service", async () => {
    const response = await createAnnouncementRoute(
      makeJsonRequest("http://localhost/api/admin/announcements", "POST", {
        title: "",
        body: "Road closure",
        category: "ROAD_CLOSURE",
        startsAt: "2026-04-03T08:00",
      }) as never,
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toMatch(/headline/i);
    expect(announcementServiceMock.createAnnouncement).not.toHaveBeenCalled();
  });

  it("creates announcements and converts Manila time input to UTC", async () => {
    announcementServiceMock.createAnnouncement.mockResolvedValueOnce({
      id: "announcement-1",
      title: "Road closure",
      body: "Main road is closed today.",
      category: "ROAD_CLOSURE",
      categoryLabel: "Road Closure",
      startsAt: "2026-04-05T01:30:00.000Z",
      endsAt: "2026-04-05T09:30:00.000Z",
      createdAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
      status: "scheduled",
      createdById: "admin-1",
      createdByName: "Admin User (@admin)",
      updatedById: "admin-1",
      updatedByName: "Admin User (@admin)",
      archivedAt: null,
      archivedById: null,
      archivedByName: null,
    });

    const response = await createAnnouncementRoute(
      makeJsonRequest("http://localhost/api/admin/announcements", "POST", {
        title: "Road closure",
        body: "Main road is closed today.",
        category: "ROAD_CLOSURE",
        startsAt: "2026-04-05T09:30",
        endsAt: "2026-04-05T17:30",
      }) as never,
    );

    expect(response.status).toBe(201);
    const createCall = announcementServiceMock.createAnnouncement.mock.calls[0]?.[0];
    expect(createCall.startsAt.toISOString()).toBe("2026-04-05T01:30:00.000Z");
    expect(createCall.endsAt.toISOString()).toBe("2026-04-05T09:30:00.000Z");
    expect(createCall.adminUserId).toBe("admin-1");
  });

  it("updates an existing active or scheduled announcement", async () => {
    announcementServiceMock.updateAnnouncement.mockResolvedValueOnce({
      id: "announcement-1",
      title: "Updated closure",
      body: "Updated message.",
      category: "ROAD_CLOSURE",
      categoryLabel: "Road Closure",
      startsAt: "2026-04-05T01:30:00.000Z",
      endsAt: null,
      createdAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T01:00:00.000Z",
      status: "active",
      createdById: "admin-1",
      createdByName: "Admin User (@admin)",
      updatedById: "admin-1",
      updatedByName: "Admin User (@admin)",
      archivedAt: null,
      archivedById: null,
      archivedByName: null,
    });

    const response = await updateAnnouncementRoute(
      makeJsonRequest("http://localhost/api/admin/announcements/announcement-1", "PATCH", {
        title: "Updated closure",
        body: "Updated message.",
        category: "ROAD_CLOSURE",
        startsAt: "2026-04-05T09:30",
        endsAt: null,
      }) as never,
      { params: Promise.resolve({ id: "announcement-1" }) },
    );

    expect(response.status).toBe(200);
    expect(announcementServiceMock.updateAnnouncement).toHaveBeenCalledWith(
      "announcement-1",
      expect.objectContaining({
        adminUserId: "admin-1",
      }),
    );
  });

  it("archives announcements through the explicit archive action route", async () => {
    announcementServiceMock.archiveAnnouncement.mockResolvedValueOnce({
      id: "announcement-1",
      title: "Archived closure",
      body: "Archived message.",
      category: "ROAD_CLOSURE",
      categoryLabel: "Road Closure",
      startsAt: "2026-04-03T00:00:00.000Z",
      endsAt: null,
      createdAt: "2026-04-02T00:00:00.000Z",
      updatedAt: "2026-04-03T01:00:00.000Z",
      status: "archived",
      createdById: "admin-1",
      createdByName: "Admin User (@admin)",
      updatedById: "admin-1",
      updatedByName: "Admin User (@admin)",
      archivedAt: "2026-04-03T01:00:00.000Z",
      archivedById: "admin-1",
      archivedByName: "Admin User (@admin)",
    });

    const response = await archiveAnnouncementRoute(
      makeJsonRequest("http://localhost/api/admin/announcements/announcement-1/archive", "POST") as never,
      { params: Promise.resolve({ id: "announcement-1" }) },
    );

    expect(response.status).toBe(200);
    expect(announcementServiceMock.archiveAnnouncement).toHaveBeenCalledWith(
      "announcement-1",
      "admin-1",
    );
  });

  it("returns a migration-required response for writes when the table is unavailable", async () => {
    announcementServiceMock.createAnnouncement.mockRejectedValueOnce(
      new announcementServiceMock.AnnouncementMigrationRequiredError(),
    );

    const response = await createAnnouncementRoute(
      makeJsonRequest("http://localhost/api/admin/announcements", "POST", {
        title: "Road closure",
        body: "Main road is closed today.",
        category: "ROAD_CLOSURE",
        startsAt: "2026-04-05T09:30",
      }) as never,
    );
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.message).toMatch(/database migrations/i);
  });
});
