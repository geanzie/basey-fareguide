import { describe, it, expect } from "vitest";
import { GpsProvider } from "@/lib/routing/providers/gps";

const provider = new GpsProvider();

describe("GpsProvider", () => {
  it("returns method=gps and polyline=null always", async () => {
    const origin = { lat: 11.278823, lng: 125.001194 };
    const dest   = { lat: 11.304796, lng: 125.108990 };
    const result = await provider.calculate(origin, dest);

    expect(result.method).toBe("gps");
    expect(result.polyline).toBeNull();
    expect(result.fallbackReason).toBeNull();
  });

  it("returns durationMin=null (GPS has no travel-time estimate)", async () => {
    const origin = { lat: 11.278823, lng: 125.001194 };
    const dest   = { lat: 11.304796, lng: 125.108990 };
    const result = await provider.calculate(origin, dest);
    expect(result.durationMin).toBeNull();
  });

  it("returns zero distance for identical coordinates", async () => {
    const pt = { lat: 11.278823, lng: 125.001194 };
    const result = await provider.calculate(pt, pt);
    expect(result.distanceKm).toBe(0);
  });

  it("applies the 1.4× road factor over straight-line Haversine distance", async () => {
    // Amandayehan → Anglit: known straight-line ≈ 10.57 km
    // road estimate should be > straight-line distance
    const origin = { lat: 11.278823, lng: 125.001194 };
    const dest   = { lat: 11.304796, lng: 125.108990 };
    const result = await provider.calculate(origin, dest);

    // straight-line Haversine ≈ 10.57 km; road factor 1.4 → ~14.8 km
    expect(result.distanceKm).toBeGreaterThan(10);
    expect(result.distanceKm).toBeLessThan(20);
  });

  it("is symmetric (A→B distance equals B→A distance)", async () => {
    const a = { lat: 11.278823, lng: 125.001194 };
    const b = { lat: 11.304796, lng: 125.108990 };

    const ab = await provider.calculate(a, b);
    const ba = await provider.calculate(b, a);

    expect(ab.distanceKm).toBeCloseTo(ba.distanceKm, 5);
  });
});
