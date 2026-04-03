export const ANNOUNCEMENT_CATEGORIES = [
  "EMERGENCY_NOTICE",
  "ROAD_CLOSURE",
  "ROAD_WORK",
  "TRAFFIC_ADVISORY",
] as const;

export type AnnouncementCategoryValue = (typeof ANNOUNCEMENT_CATEGORIES)[number];

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategoryValue, string> = {
  EMERGENCY_NOTICE: "Emergency Notice",
  ROAD_CLOSURE: "Road Closure",
  ROAD_WORK: "Road Work",
  TRAFFIC_ADVISORY: "Traffic Advisory",
};

export const ANNOUNCEMENT_TITLE_MAX_LENGTH = 120;
export const ANNOUNCEMENT_BODY_MAX_LENGTH = 1000;

export function isAnnouncementCategory(value: unknown): value is AnnouncementCategoryValue {
  return (
    typeof value === "string" &&
    (ANNOUNCEMENT_CATEGORIES as readonly string[]).includes(value)
  );
}
