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
  method: "ors" | "gps";
  fallbackReason: string | null;
  polyline: string | null;
  snappedFrom: TrackerSnappedPointDto | null;
  snappedTo: TrackerSnappedPointDto | null;
}
