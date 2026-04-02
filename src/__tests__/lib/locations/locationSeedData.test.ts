import { describe, expect, it, vi } from "vitest";
import {
  backfillPlannerLocations,
  flattenSeedLocations,
} from "@/lib/locations/locationSeedData.js";

const dataset = {
  locations: {
    barangay: [
      {
        name: "Amandayehan",
        coordinates: { lat: 11.278823, lng: 125.001194 },
        address: "Amandayehan, Basey, Samar",
      },
    ],
    landmark: [
      {
        name: "Basey Church",
        coordinates: { lat: 11.282, lng: 125.07 },
        address: "Basey Church, Basey, Samar",
      },
    ],
    sitio: [
      {
        name: "Upper Sohoton",
        coordinates: { lat: 11.35, lng: 125.09 },
        address: "Upper Sohoton, Basey, Samar",
      },
    ],
  },
};

describe("location seed backfill", () => {
  it("maps JSON categories into planner location seed payloads", () => {
    const flattened = flattenSeedLocations(dataset);

    expect(flattened).toHaveLength(3);
    expect(flattened[0].type).toBe("BARANGAY");
    expect(flattened[1].type).toBe("LANDMARK");
    expect(flattened[2].type).toBe("SITIO");
  });

  it("can be rerun safely without duplicating existing locations", async () => {
    const existingNames = new Set<string>();
    const prismaMock = {
      location: {
        findUnique: vi.fn(async ({ where }: { where: { name: string } }) => {
          return existingNames.has(where.name) ? { id: where.name } : null;
        }),
        create: vi.fn(async ({ data }: { data: { name: string } }) => {
          existingNames.add(data.name);
          return { id: data.name };
        }),
      },
    };

    const firstRun = await backfillPlannerLocations(prismaMock, {
      dataset,
      creatorUserId: "admin-1",
      now: new Date("2026-04-02T00:00:00.000Z"),
    });

    const secondRun = await backfillPlannerLocations(prismaMock, {
      dataset,
      creatorUserId: "admin-1",
      now: new Date("2026-04-02T00:00:00.000Z"),
    });

    expect(firstRun.created).toBe(3);
    expect(firstRun.skipped).toBe(0);
    expect(secondRun.created).toBe(0);
    expect(secondRun.skipped).toBe(3);
    expect(prismaMock.location.create).toHaveBeenCalledTimes(3);
  });
});
