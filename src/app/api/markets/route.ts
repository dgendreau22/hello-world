/**
 * Markets API Route
 *
 * GET /api/markets - Fetch active markets from Polymarket
 */

import { NextResponse } from "next/server";
import { getGammaClient } from "@/lib/polymarket";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const active = searchParams.get("active") !== "false";

    const gamma = getGammaClient();

    // Fetch markets using GammaSDK
    const markets = await gamma.getMarkets({
      limit,
      active,
    });

    return NextResponse.json({
      success: true,
      data: markets,
      count: markets.length,
    });
  } catch (error) {
    console.error("[API] Failed to fetch markets:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
