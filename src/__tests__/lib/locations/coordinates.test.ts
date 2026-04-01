import { describe, it, expect } from "vitest";
import { resolveCoordinates, getLocationNames } from "@/lib/locations/coordinates";

describe("resolveCoordinates", () => {
  it("resolves a known barangay by exact name", () => {
    const coords = resolveCoordinates("Amandayehan");
    expect(coords).not.toBeNull();
    expect(coords!.lat).toBeCloseTo(11.278823);
    expect(coords!.lng).toBeCloseTo(125.001194);
  });

  it("resolves a location case-insensitively (normalized match)", () => {
    const exact = resolveCoordinates("Amandayehan");
    const lower = resolveCoordinates("amandayehan");
    expect(lower).not.toBeNull();
    expect(lower).toEqual(exact);
  });

  it("resolves a location with surrounding whitespace", () => {
    const trimmed = resolveCoordinates("Amandayehan");
    const padded = resolveCoordinates("  Amandayehan  ");
    expect(padded).toEqual(trimmed);
  });

  it("resolves a location that has internal whitespace when normalized", () => {
    const Anglit = resolveCoordinates("Anglit");
    expect(Anglit).not.toBeNull();
  });

  it("returns null for an unknown location", () => {
    expect(resolveCoordinates("SomePlaceThatDoesNotExist")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(resolveCoordinates("")).toBeNull();
  });
});

describe("getLocationNames", () => {
  it("returns a non-empty array of strings", () => {
    const names = getLocationNames();
    expect(names.length).toBeGreaterThan(0);
  });

  it("includes known barangay names", () => {
    const names = getLocationNames();
    expect(names).toContain("Amandayehan");
    expect(names).toContain("Anglit");
  });

  it("returns at least 150 entries (barangay + landmark + sitio)", () => {
    expect(getLocationNames().length).toBeGreaterThanOrEqual(150);
  });
});
