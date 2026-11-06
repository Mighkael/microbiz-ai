// app/api/prospects/demand/route.ts
// GET /api/prospects/demand?location=...&industry=Retail
//
// How much need there is for a service locally, and when it peaks. See
// lib/prospects/demand.ts for why this reports competition and seasonality
// rather than a search-volume figure nobody publishes for free.

import { NextRequest, NextResponse } from "next/server";
import { resolveGeography } from "@/lib/census/geography";
import { naicsForIndustry } from "@/lib/census/naics";
import { readDemand } from "@/lib/prospects/demand";
import { INDUSTRIES } from "@/lib/data";

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
  const industryRaw = p.get("industry")?.trim() ?? "";

  if (!location || location.length < 3) {
    return NextResponse.json({ error: "A location is required." }, { status: 400 });
  }
  if (!(industryRaw in INDUSTRIES)) {
    return NextResponse.json({ error: "Choose what your business does." }, { status: 400 });
  }

  try {
    const geo = await resolveGeography(location);
    if (!geo?.countyFips) {
      return NextResponse.json(
        { error: `Couldn't find "${location}" in the United States. Try a city and state, or a 5-digit ZIP code.` },
        { status: 404 },
      );
    }

    const demand = await readDemand(geo, naicsForIndustry(industryRaw));
    if (!demand) {
      return NextResponse.json({ error: "No published figures for that industry and area." }, { status: 404 });
    }

    return NextResponse.json({ ...demand, industry: industryRaw, resolved: geo.displayName });
  } catch (err) {
    console.error("Prospect demand failed:", err);
    return NextResponse.json({ error: "Something went wrong reading demand. Please try again." }, { status: 500 });
  }
}
