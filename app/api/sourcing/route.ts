// app/api/sourcing/route.ts
// GET /api/sourcing?location=...&category=food_mfg&rankBy=distance
//
// Where a supplier industry clusters, how far it is, and an estimated
// freight cost (§8, §9). Not a price list — see lib/sourcing.ts.

import { NextRequest, NextResponse } from "next/server";
import { resolveGeography } from "@/lib/census/geography";
import { findSuppliers, SUPPLY_CATEGORIES, type SupplyCategoryKey, type RankBy } from "@/lib/sourcing";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!process.env.CENSUS_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing CENSUS_API_KEY. Add it to .env.local and restart." },
      { status: 500 },
    );
  }

  const p = req.nextUrl.searchParams;
  const location = p.get("location")?.trim();
  const category = p.get("category")?.trim() as SupplyCategoryKey | undefined;
  const rankBy = (p.get("rankBy") ?? "distance") as RankBy;

  if (!location || location.length < 3) {
    return NextResponse.json({ error: "A location is required." }, { status: 400 });
  }
  if (!category || !SUPPLY_CATEGORIES.some((c) => c.key === category)) {
    return NextResponse.json({ error: "Choose what you need to source." }, { status: 400 });
  }

  try {
    const geo = await resolveGeography(location);
    if (!geo) {
      return NextResponse.json(
        { error: `Couldn't find "${location}". Try a city and state, or a 5-digit ZIP code.` },
        { status: 404 },
      );
    }

    const result = await findSuppliers(geo, category, rankBy === "density" ? "density" : "distance");
    if (!result) {
      return NextResponse.json({ error: "No supplier data available for that category." }, { status: 404 });
    }

    return NextResponse.json({
      ...result,
      source: "US Census Bureau — County Business Patterns 2023 (establishment counts); distances computed from Census county centroids.",
      limitations: [
        "Counts are establishments in the supplier industry, not named companies — Census does not publish business names.",
        "Distances are straight-line between county centres. Road distance is longer, typically by 15-25%.",
        "Freight figures are estimates from a national average per-mile rate, not quotes. Actual cost depends on lane, weight, fuel and carrier.",
        "Within 50 miles no freight figure is shown: short-haul cost is driven by loading, driver time and minimum charges rather than distance, so a per-mile estimate would understate it.",
        "No free federal source publishes what an input costs in a given place, so no prices are shown.",
      ],
    });
  } catch (err) {
    console.error("Sourcing lookup failed:", err);
    return NextResponse.json({ error: "Sourcing lookup failed. Please try again." }, { status: 502 });
  }
}
