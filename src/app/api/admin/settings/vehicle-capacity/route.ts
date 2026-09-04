import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from "@/lib/auth";
import {
  VehicleCapacitySettingsMigrationRequiredError,
  getAdminVehicleCapacitySettings,
  parseSeatCapacities,
  updateVehicleCapacitySettings,
} from "@/lib/vehicleCapacitySettings/settingsService";

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_ONLY]);
    const response = await getAdminVehicleCapacitySettings();
    return NextResponse.json(response);
  } catch (error) {
    return createAuthErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const adminUser = await requireRequestRole(request, [...ADMIN_ONLY]);
    const body = await request.json().catch(() => ({}));

    if (!body.seatCapacities || typeof body.seatCapacities !== "object") {
      return NextResponse.json(
        { message: "seatCapacities must be an object keyed by vehicle type." },
        { status: 400 },
      );
    }

    const seatCapacities = parseSeatCapacities(body.seatCapacities);

    // Anything dropped is a client bug or an out-of-range seat count. Refusing
    // is safer than saving a partial update: capacity is the charter price
    // multiplier, and silently keeping the old number for one type would let an
    // admin believe they had lowered a ceiling they had not.
    if (
      Object.keys(seatCapacities).length !==
      Object.keys(body.seatCapacities).length
    ) {
      return NextResponse.json(
        {
          message:
            "One or more values are not seat-managed vehicle types, or fall outside the allowed seat range.",
        },
        { status: 400 },
      );
    }

    const result = await updateVehicleCapacitySettings({
      seatCapacities,
      adminUserId: adminUser.id,
    });

    // Sessions already running are deliberately untouched: each snapshots its
    // ceiling when it opens, so lowering the standard cannot strand riders who
    // are already aboard and have already paid.
    return NextResponse.json({
      success: true,
      changed: result.changed,
      settings: result.settings,
      message: result.changed
        ? "Vehicle seat capacity saved. Trips already running keep the capacity they opened with."
        : "Vehicle seat capacity is already set to those values.",
    });
  } catch (error) {
    if (error instanceof VehicleCapacitySettingsMigrationRequiredError) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    return createAuthErrorResponse(error);
  }
}
