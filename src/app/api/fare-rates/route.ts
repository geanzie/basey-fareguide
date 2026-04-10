import { NextResponse } from "next/server";
import { getResolvedFareRates } from "@/lib/fare/rateService";

export async function GET() {
  try {
    const fareRates = await getResolvedFareRates();
    return NextResponse.json(fareRates, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error("[/api/fare-rates] failed to resolve fare rates", error);
    return NextResponse.json(
      { error: "Failed to load fare rates" },
      { status: 500 },
    );
  }
}
