import { beforeEach, describe, expect, it, vi } from "vitest";

const announcementServiceMock = vi.hoisted(() => ({
  getPublicAnnouncements: vi.fn(),
}));

vi.mock("@/lib/announcements/service", () => ({
  getPublicAnnouncements: announcementServiceMock.getPublicAnnouncements,
}));

import { GET } from "@/app/api/announcements/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/announcements", () => {
  it("returns active public announcements", async () => {
    announcementServiceMock.getPublicAnnouncements.mockResolvedValueOnce({
      announcements: [
        {
          id: "announcement-1",
          title: "Road closure",
          body: "Main road is closed today.",
          category: "ROAD_CLOSURE",
          categoryLabel: "Road Closure",
          startsAt: "2026-04-03T00:00:00.000Z",
          endsAt: null,
        },
      ],
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.announcements).toHaveLength(1);
    expect(json.announcements[0].title).toBe("Road closure");
  });
});
