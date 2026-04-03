export const TRACKER_SESSION_STORAGE_KEY = "trip-tracker-session";

export const MAX_RAW_SAMPLE_ACCURACY_M = 50;
export const MAX_CHECKPOINT_ACCURACY_M = 30;
export const MAX_CONSECUTIVE_REJECTIONS_FOR_POOR_SIGNAL = 3;
export const MIN_RAW_MOVEMENT_M = 8;
export const MIN_CHECKPOINT_DISTANCE_M = 30;
export const MIN_CHECKPOINT_INTERVAL_MS = 10_000;
export const MAX_TRACKER_SPEED_MPS = 25;
export const MAX_TRACKER_SNAP_DISTANCE_M = 60;
export const CLIENT_SEGMENT_REQUEST_INTERVAL_MS = 10_000;

export const PH_BOUNDS = { latMin: 4, latMax: 22, lngMin: 114, lngMax: 128 } as const;
export const BASEY_SERVICE_AREA = {
  latMin: 11.1,
  latMax: 11.5,
  lngMin: 124.8,
  lngMax: 125.3,
} as const;

export const TRACKER_RATE_LIMITS = {
  minute: {
    windowMs: 60_000,
    maxAttempts: 6,
  },
  hour: {
    windowMs: 60 * 60_000,
    maxAttempts: 240,
  },
} as const;
