import type { FarePolicySnapshotDto, TrackerPointDto } from "@/lib/contracts";

export type TrackerUiState =
  | "waiting_permission"
  | "calibrating"
  | "tracking_road_aware"
  | "tracking_estimated"
  | "poor_signal"
  | "paused"
  | "completed";

export interface TrackerPoint extends TrackerPointDto {}

export interface TrackerSegmentRecord {
  id: string;
  from: TrackerPoint;
  to: TrackerPoint;
  distanceKm: number;
  durationMin: number | null;
  confidence: "road_aware" | "gps_estimate";
  method: "ors" | "gps";
  fallbackReason: string | null;
  polyline: string | null;
}

export interface TrackerTripState {
  trackerSessionId: string;
  uiState: TrackerUiState;
  isTracking: boolean;
  startedAtMs: number | null;
  endedAtMs: number | null;
  startPoint: TrackerPoint | null;
  endPoint: TrackerPoint | null;
  currentPosition: TrackerPoint | null;
  lastAcceptedRawPoint: TrackerPoint | null;
  confirmedCheckpoints: TrackerPoint[];
  segments: TrackerSegmentRecord[];
  totalDistanceKm: number;
  durationMin: number;
  fare: number;
  farePolicy: FarePolicySnapshotDto | null;
  hasFallbackSegments: boolean;
  lastSegmentRequestAtMs: number | null;
  rateLimitedUntilMs: number | null;
  consecutiveRejectedSamples: number;
  lastRejectionReason: string | null;
  gpsError: string | null;
}

export interface TrackerDecision {
  accepted: boolean;
  reason: string | null;
}
