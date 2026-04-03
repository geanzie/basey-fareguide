import { describe, expect, it } from "vitest";
import {
  evaluateCheckpointCandidate,
  evaluateRawSample,
} from "@/lib/tracker";

const BASE_POINT = {
  lat: 11.2754,
  lng: 125.0689,
  accuracyM: 12,
  timestampMs: 1_700_000_000_000,
} as const;

describe("tracker sample filters", () => {
  it("rejects stationary jitter as a raw sample", () => {
    const result = evaluateRawSample(BASE_POINT, {
      ...BASE_POINT,
      lat: BASE_POINT.lat + 0.00001,
      lng: BASE_POINT.lng + 0.00001,
      timestampMs: BASE_POINT.timestampMs + 5_000,
    });

    expect(result).toEqual({
      accepted: false,
      reason: "stationary_jitter",
    });
  });

  it("rejects poor-accuracy raw samples", () => {
    const result = evaluateRawSample(null, {
      ...BASE_POINT,
      accuracyM: 65,
    });

    expect(result).toEqual({
      accepted: false,
      reason: "accuracy_too_low",
    });
  });

  it("promotes only meaningful checkpoint movement", () => {
    const result = evaluateCheckpointCandidate(BASE_POINT, {
      ...BASE_POINT,
      lat: 11.2758,
      lng: 125.0691,
      accuracyM: 18,
      timestampMs: BASE_POINT.timestampMs + 15_000,
    });

    expect(result).toEqual({
      accepted: true,
      reason: null,
    });
  });

  it("rejects checkpoint candidates that are too soon", () => {
    const result = evaluateCheckpointCandidate(BASE_POINT, {
      ...BASE_POINT,
      lat: 11.2759,
      lng: 125.0693,
      accuracyM: 18,
      timestampMs: BASE_POINT.timestampMs + 7_000,
    });

    expect(result).toEqual({
      accepted: false,
      reason: "checkpoint_too_soon",
    });
  });

  it("rejects checkpoint candidates that imply implausible speed", () => {
    const result = evaluateCheckpointCandidate(BASE_POINT, {
      ...BASE_POINT,
      lat: 11.3204,
      lng: 125.1201,
      accuracyM: 12,
      timestampMs: BASE_POINT.timestampMs + 12_000,
    });

    expect(result).toEqual({
      accepted: false,
      reason: "implausible_speed",
    });
  });
});
