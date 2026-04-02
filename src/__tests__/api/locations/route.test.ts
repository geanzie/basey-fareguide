import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaMock = vi.hoisted(() => ({
  location: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { GET } from "@/app/api/locations/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/locations", () => {
  it("returns planner-visible locations from validated database rows only", async () => {
    prismaMock.location.findMany.mockResolvedValueOnce([
      {
        id: "loc-1",
        name: "Amandayehan",
        type: "BARANGAY",
        coordinates: "11.278823,125.001194",
        barangay: "Amandayehan",
        description: null,
        googleFormattedAddress: "Amandayehan, Basey, Samar",
        updatedAt: new Date("2026-04-02T00:00:00.000Z"),
      },
      {
        id: "loc-2",
        name: "Upper Sohoton",
        type: "SITIO",
        coordinates: "11.35,125.09",
        barangay: null,
        description: "Sitio near Sohoton",
        googleFormattedAddress: "Upper Sohoton, Basey, Samar",
        updatedAt: new Date("2026-04-03T00:00:00.000Z"),
      },
    ]);

    const res = await GET(new NextRequest("http://localhost/api/locations"));
    const json = await res.json();

    expect(prismaMock.location.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          validationStatus: "VALIDATED",
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(json.count).toBe(2);
    expect(json.locations[0].category).toBe("barangay");
    expect(json.locations[1].category).toBe("sitio");
    expect(json.metadata.sources).toEqual(["database"]);
  });
});
