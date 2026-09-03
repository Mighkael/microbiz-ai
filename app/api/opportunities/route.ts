// app/api/opportunities/route.ts
// GET /api/opportunities?location=...&capital=50000
//
// Ranks sectors for a county on what the Economic Census and ACS publish
// there (§16). Four Census calls total, all cached for a day: the county
// sector scan, the national scan, and population for each.

import { NextRequest, NextResponse } from "next/server";
import { resolveGeography } from "@/lib/census/geography";
import { scanSectors, EC_VINTAGE, EC_SOURCE } from "@/lib/census/sectorScan";
import { findOpportunities, OPPORTUNITY_LIMITATIONS } from "@/lib/opportunity";

export const maxDuration = 60;

const DAY = 86400;

/** Population only — the sector scan carries everything else. */
async function population(forClause: string, inClause?: string): Promise<number | null> {
  const url = new URL("https://api.census.gov/data/2023/acs/acs5");
  url.searchParams.set("get", "B01003_001E");
  url.searchParams.set("for", forClause);
  if (inClause) url.searchParams.set("in", inClause);
  url.searchParams.set("key", process.env.CENSUS_API_KEY ?? "");

  const res = await fetch(url, { next: { revalidate: DAY } });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim().startsWith("[")) return null;
  const rows = JSON.parse(text) as string[][];
  if (rows.length < 2) return null;
  const n = Number(rows[1][0]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function GET(req: NextRequest) {
  if (!process.env.CENSUS_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing CENSUS_API_KEY. Add it to .env.local and restart." },
      { status: 500 },
    );
  }

  const p = req.nextUrl.searchParams;
  const location = p.get("location")?.trim();
  const rawCapital = p.get("capital")?.trim();

  if (!location || location.length < 3) {
    return NextResponse.json({ error: "A location is required." }, { status: 400 });
  }

  // Capital is optional: without it the ranking simply drops that factor
  // rather than guessing a budget.
  const parsed = rawCapital ? Number(rawCapital.replace(/[^0-9.]/g, "")) : NaN;
  const capital = Number.isFinite(parsed) && parsed > 0 ? parsed : null;

  try {
    const geo = await resolveGeography(location);
    if (!geo) {
      return NextResponse.json(
        { error: `Couldn't find "${location}". Try a city and state, or a 5-digit ZIP code.` },
        { status: 404 },
      );
    }
    if (!geo.countyFips) {
      return NextResponse.json(
        { error: "Business figures are published by county, and that point didn't fall inside one. Try a nearby town." },
        { status: 404 },
      );
    }

    const [local, national, localPop, nationalPop] = await Promise.all([
      scanSectors(geo, "county"),
      scanSectors(geo, "us"),
      population(`county:${geo.countyFips}`, `state:${geo.stateFips}`),
      population("us:1"),
    ]);

    if (!local || !national) {
      return NextResponse.json(
        { error: "The Census Economic Census service didn't respond. Please try again in a moment." },
        { status: 502 },
      );
    }

    const { ranked, outOfReach, unranked } = findOpportunities(local, national, localPop, nationalPop, capital);

    if (ranked.length === 0 && outOfReach.length === 0) {
      return NextResponse.json(
        {
          error: `The Economic Census withholds sector figures for ${geo.countyName ?? "this county"}, so nothing can be ranked here. This usually happens in counties with few businesses. Try a larger nearby county.`,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      geography: {
        label: geo.countyName ? `${geo.countyName}, ${geo.stateName}` : geo.stateName,
        displayName: geo.displayName,
        population: localPop,
      },
      capital,
      ranked,
      outOfReach,
      unranked,
      source: `${EC_SOURCE} ${EC_VINTAGE}; US Census Bureau — American Community Survey (5-year) 2023.`,
      limitations: OPPORTUNITY_LIMITATIONS,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong ranking opportunities. Please try again." },
      { status: 500 },
    );
  }
}
