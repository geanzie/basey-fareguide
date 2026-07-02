import { NextResponse } from "next/server";

import { getPublicAnnouncements } from "@/lib/announcements/service";

export async function GET() {
  try {
    const response = await getPublicAnnouncements();
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
