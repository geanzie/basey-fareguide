import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from "@/lib/auth";
import { clearRoutingCache } from "@/lib/routing";
import {
  getAdminRoutingSettings,
  RoutingSettingsMigrationRequiredError,
  updateRoutingSettings,
  type RoutingPrimaryProvider,
} from "@/lib/routing/settingsService";

function coerceRoutingPrimaryProvider(value: unknown): RoutingPrimaryProvider | null {
  if (typeof value !== "string") {
    return null;
  }

  return value === "ors" || value === "google_routes" ? value : null;
}

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_ONLY]);
    const response = await getAdminRoutingSettings();
    return NextResponse.json(response);
  } catch (error) {
    return createAuthErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const adminUser = await requireRequestRole(request, [...ADMIN_ONLY]);
    const body = await request.json().catch(() => ({}));
    const primaryProvider = coerceRoutingPrimaryProvider(body.primaryProvider);

    if (!primaryProvider) {
      return NextResponse.json(
        { error: "Primary routing provider must be either 'ors' or 'google_routes'." },
        { status: 400 },
      );
    }

    const result = await updateRoutingSettings({
      primaryProvider,
      adminUserId: adminUser.id,
    });

    clearRoutingCache();

    return NextResponse.json({
      success: true,
      changed: result.changed,
      settings: result.settings,
      message: result.changed
        ? "Routing provider setting saved successfully."
        : "Routing provider is already set to the selected value.",
    });
  } catch (error) {
    if (error instanceof RoutingSettingsMigrationRequiredError) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    return createAuthErrorResponse(error);
  }
}