import { beforeEach, describe, expect, it, vi } from "vitest";

const fareRateServiceMock = vi.hoisted(() => ({
  getResolvedFareRates: vi.fn(),
}));

vi.mock("@/lib/fare/rateService", () => ({
  getResolvedFareRates: fareRateServiceMock.getResolvedFareRates,
}));

import { GET } from "@/app/api/fare-rates/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/fare-rates", () => {
  it("returns the current and upcoming fare policies", async () => {
    fareRateServiceMock.getResolvedFareRates.mockResolvedValueOnce({
      current: {
        versionId: "fare-live",
        baseDistanceKm: 3,
        baseFare: 15,
        perKmRate: 3,
        effectiveAt: "2026-04-01T00:00:00.000Z",
      },
      upcoming: {
        versionId: "fare-next",
        baseDistanceKm: 3,
        baseFare: 18,
        perKmRate: 4,
        effectiveAt: "2026-04-10T00:00:00.000Z",
      },
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.current.baseFare).toBe(15);
    expect(json.upcoming.perKmRate).toBe(4);
  });

  it("returns 500 when fare rate resolution fails", async () => {
    fareRateServiceMock.getResolvedFareRates.mockRejectedValueOnce(new Error("db unavailable"));

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toMatch(/failed to load fare rates/i);
  });
});
