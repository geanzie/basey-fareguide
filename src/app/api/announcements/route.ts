import { NextResponse } from "next/server";

import { getPublicAnnouncements } from "@/lib/announcements/service";

export async function GET() {
  try {
    const response = await getPublicAnnouncements();
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
