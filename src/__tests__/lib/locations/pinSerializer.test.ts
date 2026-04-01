import { describe, it, expect } from "vitest";
import { serializePinLabel, parsePinLabel } from "@/lib/locations/pinSerializer";

describe("serializePinLabel", () => {
  it("formats coordinates with prefix 'pin:'", () => {
    expect(serializePinLabel(11.278823, 125.001194)).toBe(
      "pin:11.278823,125.001194"
    );
  });

  it("always uses 6 decimal places", () => {
    expect(serializePinLabel(11.0, 125.0)).toBe("pin:11.000000,125.000000");
  });

  it("truncates extra decimals to 6 places", () => {
    const result = serializePinLabel(11.1234567, 125.9876543);
    const [latStr, lngStr] = result.replace("pin:", "").split(",");
    expect(latStr.split(".")[1].length).toBe(6);
    expect(lngStr.split(".")[1].length).toBe(6);
  });

  it("handles negative coordinates", () => {
    expect(serializePinLabel(-11.278823, -125.001194)).toBe(
      "pin:-11.278823,-125.001194"
    );
  });
});

describe("parsePinLabel", () => {
  it("parses a valid pin label", () => {
    const result = parsePinLabel("pin:11.278823,125.001194");
    expect(result).toEqual({ lat: 11.278823, lng: 125.001194 });
  });

  it("parses a round-trip with serializePinLabel", () => {
    const lat = 11.278823;
    const lng = 125.001194;
    const serialized = serializePinLabel(lat, lng);
    const parsed = parsePinLabel(serialized);
    expect(parsed).not.toBeNull();
    expect(parsed!.lat).toBeCloseTo(lat, 6);
    expect(parsed!.lng).toBeCloseTo(lng, 6);
  });

  it("returns null for a plain location name", () => {
    expect(parsePinLabel("Amandayehan")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parsePinLabel("")).toBeNull();
  });

  it("returns null when prefix is wrong case", () => {
    expect(parsePinLabel("PIN:11.278823,125.001194")).toBeNull();
  });

  it("returns null when only one coordinate is given", () => {
    expect(parsePinLabel("pin:11.278823")).toBeNull();
  });

  it("returns null when coordinates are not numbers", () => {
    expect(parsePinLabel("pin:abc,def")).toBeNull();
  });

  it("returns null when value is just the prefix", () => {
    expect(parsePinLabel("pin:")).toBeNull();
  });
});
