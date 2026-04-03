import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from "@/lib/auth";
import { createAnnouncementErrorResponse } from "@/lib/announcements/http";
import { archiveAnnouncement } from "@/lib/announcements/service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const adminUser = await requireRequestRole(request, [...ADMIN_ONLY]);
    const { id } = await context.params;
    const announcement = await archiveAnnouncement(id, adminUser.id);

    return NextResponse.json({
      success: true,
      announcement,
      message: "Traffic announcement archived successfully.",
    });
  } catch (error) {
    const authResponse = createAuthErrorResponse(error);
    if (authResponse.status !== 500) {
      return authResponse;
    }

    return createAnnouncementErrorResponse(error);
  }
}
