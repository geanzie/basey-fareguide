import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCalculateWalking = vi.hoisted(() => vi.fn());
const orsConstructor = vi.hoisted(() => vi.fn());
const mockResolveNearestRoad = vi.hoisted(() => vi.fn());

vi.mock("@/lib/routing/providers/googleRoads", () => ({
  resolveNearestRoad: mockResolveNearestRoad,
}));

vi.mock("@/lib/routing/providers/ors", () => ({
  OrsProvider: class {
    constructor(timeoutMs?: number) {
      orsConstructor(timeoutMs);
    }
    calculateWalking = mockCalculateWalking;
  },
}));

import { RoutingServiceError } from "@/lib/routing/types";
import {
  clearVehicleAccessCache,
  verifyVehicleAccess,
  VEHICLE_ACCESS_LIMIT_M,
} from "@/lib/routing/vehicleAccess";

/** Pin inside a school campus, reachable from the road only by stairs. */
const PIN = { lat: 11.28185, lng: 125.06835 };

/** Moves a coordinate north by roughly `meters`. */
function metersNorth(meters: number) {
  return { lat: PIN.lat + meters / 111_000, lng: PIN.lng, wasSnapped: true };
}

function walkRoute(distanceMeters: number) {
  return { distanceMeters };
}

function args(overrides: Partial<Parameters<typeof verifyVehicleAccess>[0]> = {}) {
  return {
    field: "destination" as const,
    policy: "doorstep" as const,
    requested: PIN,
    label: "Basey 1 Central Elementary School",
    snapped: metersNorth(130),
    curated: null,
    ...overrides,
  };
}

beforeEach(() => {
  clearVehicleAccessCache();
  mockCalculateWalking.mockReset();
  orsConstructor.mockReset();
  mockResolveNearestRoad.mockReset();
  // The Roads snap is off by default, so unless a test says otherwise the
  // guard behaves exactly as it did before Roads existed.
  mockResolveNearestRoad.mockResolvedValue(null);
});

describe("verifyVehicleAccess", () => {
  it("accepts a point sitting on the road network", async () => {
    const verdict = await verifyVehicleAccess(
      args({ snapped: metersNorth(VEHICLE_ACCESS_LIMIT_M - 20) }),
    );

    expect(verdict.status).toBe("reachable");
    expect(mockCalculateWalking).not.toHaveBeenCalled();
  });

  it("reports a walking tail when a footpath covers the gap", async () => {
    mockCalculateWalking.mockResolvedValue(walkRoute(148));

    const verdict = await verifyVehicleAccess(args());

    expect(verdict).toMatchObject({
      status: "walk_only",
      field: "destination",
      dropoff: { walkMeters: 148, source: "foot_probe" },
    });
  });

  it("keeps blocking when the foot probe is unavailable", async () => {
    mockCalculateWalking.mockRejectedValue(
      new RoutingServiceError("ROUTING_SERVICE_UNAVAILABLE", "timed out", {
        reason: "timeout",
      }),
    );

    const verdict = await verifyVehicleAccess(args());

    // A probe failure sharpens the wording; it must never re-open the gate.
    expect(verdict).toMatchObject({
      status: "walk_only",
      dropoff: { source: "road_snap", walkMeters: 130 },
    });
  });

  it("treats a point with no footpath either as having no road", async () => {
    mockCalculateWalking.mockRejectedValue(
      new RoutingServiceError("NO_ROAD_ROUTE_FOUND", "no route", {
        reason: "no_route_found",
      }),
    );

    const verdict = await verifyVehicleAccess(args());

    expect(verdict.status).toBe("no_road");
  });

  it("ignores an implausibly long foot route and falls back to the snap distance", async () => {
    mockCalculateWalking.mockResolvedValue(walkRoute(9_000));

    const verdict = await verifyVehicleAccess(args());

    expect(verdict).toMatchObject({
      status: "walk_only",
      dropoff: { source: "road_snap", walkMeters: 130 },
    });
  });

  it("reports no road when nothing is within reach", async () => {
    const verdict = await verifyVehicleAccess(args({ snapped: metersNorth(400) }));

    expect(verdict).toMatchObject({ status: "no_road", snapMeters: 400 });
    expect(mockCalculateWalking).not.toHaveBeenCalled();
  });

  it("fails closed when the provider returned no snapped point", async () => {
    const verdict = await verifyVehicleAccess(args({ snapped: null }));

    expect(verdict.status).toBe("no_road");
    expect(mockCalculateWalking).not.toHaveBeenCalled();
  });

  it("trusts a vetted place without probing", async () => {
    const verdict = await verifyVehicleAccess(
      args({
        snapped: metersNorth(130),
        curated: {
          vehicleAccess: "VEHICLE_ACCESSIBLE",
          dropoff: null,
          label: "Basey 1 Central Elementary School",
        },
      }),
    );

    expect(verdict.status).toBe("reachable");
    expect(mockCalculateWalking).not.toHaveBeenCalled();
  });

  it("uses a curated drop-off without probing", async () => {
    const gate = { lat: PIN.lat, lng: PIN.lng - 0.0008 };

    const verdict = await verifyVehicleAccess(
      args({
        curated: {
          vehicleAccess: "WALK_ONLY",
          dropoff: gate,
          label: "Basey 1 Central Elementary School",
        },
      }),
    );

    expect(verdict).toMatchObject({
      status: "walk_only",
      dropoff: {
        lat: gate.lat,
        lng: gate.lng,
        label: "Basey 1 Central Elementary School drop-off",
        source: "curated",
      },
    });
    expect(mockCalculateWalking).not.toHaveBeenCalled();
  });

  it("probes a place marked walk-only that has no drop-off recorded yet", async () => {
    mockCalculateWalking.mockResolvedValue(walkRoute(120));

    const verdict = await verifyVehicleAccess(
      args({
        curated: {
          vehicleAccess: "WALK_ONLY",
          dropoff: null,
          label: "Basey 1 Central Elementary School",
        },
      }),
    );

    expect(verdict).toMatchObject({
      status: "walk_only",
      dropoff: { source: "foot_probe" },
    });
  });

  it("reuses a cached verdict for a repeated pin drop", async () => {
    mockCalculateWalking.mockResolvedValue(walkRoute(148));

    await verifyVehicleAccess(args());
    const second = await verifyVehicleAccess(args({ field: "origin" }));

    expect(mockCalculateWalking).toHaveBeenCalledTimes(1);
    // The cached verdict is re-stamped with the end it now applies to.
    expect(second).toMatchObject({ status: "walk_only", field: "origin" });
  });
});

describe("verifyVehicleAccess — area policy", () => {
  it("reports the walk instead of probing, for an area centroid", async () => {
    const verdict = await verifyVehicleAccess(
      args({ policy: "area", snapped: metersNorth(130) }),
    );

    expect(verdict).toMatchObject({
      status: "walk_only",
      snapMeters: 130,
      dropoff: { source: "road_snap", walkMeters: 130 },
    });
    // 36 barangays would otherwise double the provider calls on every quote.
    expect(mockCalculateWalking).not.toHaveBeenCalled();
  });

  it("never reports no_road for an area centroid, however far out it sits", async () => {
    // Anglit's centroid is 819 m from the nearest mapped road; Manlilinab 3.4 km.
    const verdict = await verifyVehicleAccess(
      args({ policy: "area", snapped: metersNorth(3400) }),
    );

    expect(verdict).toMatchObject({ status: "walk_only", snapMeters: 3400 });
    expect(mockCalculateWalking).not.toHaveBeenCalled();
  });

  it("still accepts an area centroid that sits on a road", async () => {
    const verdict = await verifyVehicleAccess(
      args({ policy: "area", snapped: metersNorth(20) }),
    );

    expect(verdict.status).toBe("reachable");
  });
});

describe("verifyVehicleAccess — Roads snap", () => {
  it("rescues a place the routing provider snapped away from", async () => {
    // The providers snap within 5 km because barangay coordinates are polygon
    // centroids, so a snap can jump to an unrelated through road. Roads finding
    // a road 40 m away means the place is reachable after all.
    mockResolveNearestRoad.mockResolvedValue({
      coordinate: { lat: PIN.lat + 40 / 111_000, lng: PIN.lng },
      meters: 40,
    });

    const verdict = await verifyVehicleAccess(args({ snapped: metersNorth(3000) }));

    expect(verdict.status).toBe("reachable");
    expect(mockCalculateWalking).not.toHaveBeenCalled();
  });

  it("is never consulted for a point already on the road network", async () => {
    // No point paying for a call that cannot change the answer.
    await verifyVehicleAccess(args({ snapped: metersNorth(VEHICLE_ACCESS_LIMIT_M - 20) }));

    expect(mockResolveNearestRoad).not.toHaveBeenCalled();
  });

  it("offers the nearer road as the drop-off when it is still a walk away", async () => {
    mockResolveNearestRoad.mockResolvedValue({
      coordinate: { lat: PIN.lat + 120 / 111_000, lng: PIN.lng },
      meters: 120,
    });
    mockCalculateWalking.mockResolvedValue(walkRoute(140));

    const verdict = await verifyVehicleAccess(args({ snapped: metersNorth(3000) }));

    expect(verdict.status).toBe("walk_only");
    if (verdict.status !== "walk_only") return;
    expect(verdict.snapMeters).toBe(120);
    // The foot probe must walk from the road Roads found, not the far snap.
    expect(mockCalculateWalking.mock.calls[0][0].lat).toBeCloseTo(PIN.lat + 120 / 111_000, 5);
  });

  it("leaves the verdict untouched when Roads has nothing better", async () => {
    mockResolveNearestRoad.mockResolvedValue(null);
    mockCalculateWalking.mockResolvedValue(walkRoute(150));

    const verdict = await verifyVehicleAccess(args({ snapped: metersNorth(130) }));

    expect(verdict.status).toBe("walk_only");
    if (verdict.status !== "walk_only") return;
    expect(verdict.snapMeters).toBe(130);
  });

  it("still refuses a doorstep with no road anywhere near it", async () => {
    // Roads failing to help must not turn into Roads granting access.
    mockResolveNearestRoad.mockResolvedValue(null);

    const verdict = await verifyVehicleAccess(args({ snapped: metersNorth(3000) }));

    expect(verdict.status).toBe("no_road");
  });
});
