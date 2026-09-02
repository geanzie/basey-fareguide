import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from "@/lib/auth";
import { closeSessionsForSuspendedVehicleTypes } from "@/lib/driverSession";
import {
  DriverSessionSettingsMigrationRequiredError,
  getAdminDriverSessionSettings,
  parseVehicleTypes,
  updateDriverSessionSettings,
} from "@/lib/driverSessionSettings/settingsService";

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_ONLY]);
    const response = await getAdminDriverSessionSettings();
    return NextResponse.json(response);
  } catch (error) {
    return createAuthErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const adminUser = await requireRequestRole(request, [...ADMIN_ONLY]);
    const body = await request.json().catch(() => ({}));

    if (!Array.isArray(body.suspendedVehicleTypes)) {
      return NextResponse.json(
        { message: "suspendedVehicleTypes must be an array of vehicle types." },
        { status: 400 },
      );
    }

    const suspendedVehicleTypes = parseVehicleTypes(body.suspendedVehicleTypes);

    // Anything unrecognised is a client bug, not an empty selection: refuse
    // rather than silently resuming a flow the admin meant to keep suspended.
    if (suspendedVehicleTypes.length !== body.suspendedVehicleTypes.length) {
      return NextResponse.json(
        { message: "One or more values are not valid vehicle types." },
        { status: 400 },
      );
    }

    const result = await updateDriverSessionSettings({
      suspendedVehicleTypes,
      adminUserId: adminUser.id,
    });

    // A driver already online for a type just suspended can no longer act on
    // their queue, so close those sessions instead of stranding them.
    const closedSessions = result.newlySuspended.length
      ? await closeSessionsForSuspendedVehicleTypes(result.newlySuspended)
      : 0;

    return NextResponse.json({
      success: true,
      changed: result.changed,
      closedSessions,
      settings: result.settings,
      message: result.changed
        ? "Driver session suspension saved."
        : "Driver session suspension is already set to those vehicle types.",
    });
  } catch (error) {
    if (error instanceof DriverSessionSettingsMigrationRequiredError) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    return createAuthErrorResponse(error);
  }
}
