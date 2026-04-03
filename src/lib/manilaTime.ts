const MANILA_OFFSET_HOURS = 8;
const MANILA_OFFSET_MS = MANILA_OFFSET_HOURS * 60 * 60 * 1000;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function parseManilaDateTimeInput(value: string): Date | null {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute] = match;
  const utcMillis =
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      0,
      0,
    ) - MANILA_OFFSET_MS;

  const date = new Date(utcMillis);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatManilaDateTimeInput(value: Date | string | null | undefined): string {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const manilaDate = new Date(date.getTime() + MANILA_OFFSET_MS);
  return [
    `${manilaDate.getUTCFullYear()}-${pad(manilaDate.getUTCMonth() + 1)}-${pad(manilaDate.getUTCDate())}`,
    `${pad(manilaDate.getUTCHours())}:${pad(manilaDate.getUTCMinutes())}`,
  ].join("T");
}

export function formatManilaDateTimeLabel(value: Date | string | null | undefined): string {
  if (!value) {
    return "Not scheduled";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(date);
}
