import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from "@/lib/auth";
import { createAnnouncementErrorResponse } from "@/lib/announcements/http";
import { createAnnouncement, getAdminAnnouncements } from "@/lib/announcements/service";
import { validateAnnouncementPayload } from "@/lib/announcements/validation";

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_ONLY]);
    const response = await getAdminAnnouncements();
    return NextResponse.json(response);
  } catch (error) {
    return createAuthErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireRequestRole(request, [...ADMIN_ONLY]);
    const body = await request.json().catch(() => ({}));
    const validation = validateAnnouncementPayload(body);

    if (validation.error || !validation.data) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const announcement = await createAnnouncement({
      adminUserId: adminUser.id,
      ...validation.data,
    });

    return NextResponse.json(
      {
        success: true,
        announcement,
        message: "Traffic announcement published successfully.",
      },
      { status: 201 },
    );
  } catch (error) {
    const authResponse = createAuthErrorResponse(error);
    if (authResponse.status !== 500) {
      return authResponse;
    }

    return createAnnouncementErrorResponse(error);
  }
}
