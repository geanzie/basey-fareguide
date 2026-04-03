import { NextResponse } from "next/server";

import {
  ANNOUNCEMENT_MIGRATION_REQUIRED_MESSAGE,
  AnnouncementMigrationRequiredError,
  AnnouncementNotFoundError,
  AnnouncementStateError,
} from "@/lib/announcements/service";

export function createAnnouncementErrorResponse(error: unknown): NextResponse {
  if (error instanceof AnnouncementNotFoundError) {
    return NextResponse.json({ message: error.message }, { status: 404 });
  }

  if (error instanceof AnnouncementStateError) {
    return NextResponse.json({ message: error.message }, { status: 409 });
  }

  if (error instanceof AnnouncementMigrationRequiredError) {
    return NextResponse.json(
      { message: ANNOUNCEMENT_MIGRATION_REQUIRED_MESSAGE },
      { status: 503 },
    );
  }

  return NextResponse.json({ message: "Internal server error" }, { status: 500 });
}
