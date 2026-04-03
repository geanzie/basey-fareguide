import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from "@/lib/auth";
import { createAnnouncementErrorResponse } from "@/lib/announcements/http";
import { updateAnnouncement } from "@/lib/announcements/service";
import { validateAnnouncementPayload } from "@/lib/announcements/validation";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const adminUser = await requireRequestRole(request, [...ADMIN_ONLY]);
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const validation = validateAnnouncementPayload(body);

    if (validation.error || !validation.data) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const announcement = await updateAnnouncement(id, {
      adminUserId: adminUser.id,
      ...validation.data,
    });

    return NextResponse.json({
      success: true,
      announcement,
      message: "Traffic announcement updated successfully.",
    });
  } catch (error) {
    const authResponse = createAuthErrorResponse(error);
    if (authResponse.status !== 500) {
      return authResponse;
    }

    return createAnnouncementErrorResponse(error);
  }
}
