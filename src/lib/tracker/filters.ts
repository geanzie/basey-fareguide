import {
  MAX_CHECKPOINT_ACCURACY_M,
  MAX_RAW_SAMPLE_ACCURACY_M,
  MAX_TRACKER_SPEED_MPS,
  MIN_CHECKPOINT_DISTANCE_M,
  MIN_CHECKPOINT_INTERVAL_MS,
  MIN_RAW_MOVEMENT_M,
} from "./constants";
import { haversineMeters, speedMetersPerSecond } from "./calculations";
import type { TrackerDecision, TrackerPoint } from "./types";

export function evaluateRawSample(
  lastAcceptedRawPoint: TrackerPoint | null,
  candidate: TrackerPoint,
): TrackerDecision {
  if (candidate.accuracyM > MAX_RAW_SAMPLE_ACCURACY_M) {
    return { accepted: false, reason: "accuracy_too_low" };
  }

  if (!lastAcceptedRawPoint) {
    return { accepted: true, reason: null };
  }

  const movementM = haversineMeters(lastAcceptedRawPoint, candidate);
  if (movementM < MIN_RAW_MOVEMENT_M) {
    return { accepted: false, reason: "stationary_jitter" };
  }

  return { accepted: true, reason: null };
}

export function evaluateCheckpointCandidate(
  lastCheckpoint: TrackerPoint | null,
  candidate: TrackerPoint,
): TrackerDecision {
  if (candidate.accuracyM > MAX_CHECKPOINT_ACCURACY_M) {
    return { accepted: false, reason: "checkpoint_accuracy_too_low" };
  }

  if (!lastCheckpoint) {
    return { accepted: true, reason: null };
  }

  if (candidate.timestampMs <= lastCheckpoint.timestampMs) {
    return { accepted: false, reason: "non_monotonic_timestamp" };
  }

  const elapsedMs = candidate.timestampMs - lastCheckpoint.timestampMs;
  if (elapsedMs < MIN_CHECKPOINT_INTERVAL_MS) {
    return { accepted: false, reason: "checkpoint_too_soon" };
  }

  const distanceM = haversineMeters(lastCheckpoint, candidate);
  if (distanceM < MIN_CHECKPOINT_DISTANCE_M) {
    return { accepted: false, reason: "movement_below_threshold" };
  }

  if (speedMetersPerSecond(lastCheckpoint, candidate) > MAX_TRACKER_SPEED_MPS) {
    return { accepted: false, reason: "implausible_speed" };
  }

  return { accepted: true, reason: null };
}
