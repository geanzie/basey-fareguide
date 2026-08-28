export type TrackerConfidence = "road_aware" | "gps_estimate" | "rejected";

export interface TrackerPointDto {
  lat: number;
  lng: number;
  accuracyM: number;
  timestampMs: number;
}

export interface TrackerSnappedPointDto {
  lat: number;
  lng: number;
  wasSnapped: boolean;
}

export interface TrackerSegmentRequestDto {
  trackerSessionId: string;
  from: TrackerPointDto;
  to: TrackerPointDto;
}

export interface TrackerSegmentResponseDto {
  accepted: boolean;
  reason: string | null;
  distanceKm: number;
  durationMin: number | null;
  confidence: TrackerConfidence;
  /**
   * Which engine measured the segment. "curated" cannot appear here: the
   * tracker follows a GPS trail and has no pair of saved places to look up.
   */
  method: "ors" | "gps" | "google_routes" | "valhalla";
  fallbackReason: string | null;
  polyline: string | null;
  snappedFrom: TrackerSnappedPointDto | null;
  snappedTo: TrackerSnappedPointDto | null;
}
