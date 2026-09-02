// app/api/benchmark/route.ts
// GET /api/benchmark?location=...&industry=...&revenue=...&employees=...&level=county|state|us
//
// "Where your business really stands" — the business's own figures measured
// against published Economic Census figures for its sector and geography.
// The level parameter is what powers the geography dropdown in §3.

import { NextRequest, NextResponse } from "next/server";
import { resolveGeography } from "@/lib/census/geography";
import { getSectorEconomics, type GeoLevel } from "@/lib/census/economic";
import { naicsForIndustry } from "@/lib/census/naics";
import { buildComparisons, positionScore } from "@/lib/benchmarks";

const LEVELS: GeoLevel[] = ["county", "state", "us"];

export async function GET(req: NextRequest) {
  if (!process.env.CENSUS_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing CENSUS_API_KEY. Add it to .env.local and restart." },
      { status: 500 },
    );
  }

  const p = req.nextUrl.searchParams;
  const location = p.get("location")?.trim();
  const industry = p.get("industry")?.trim() ?? "Other";
  const revenue = Number(p.get("revenue") ?? 0);
  const employees = Number(p.get("employees") ?? 0);
  const level = (p.get("level") ?? "county") as GeoLevel;

  if (!location || location.length < 3) {
    return NextResponse.json({ error: "A location is required to benchmark against a market." }, { status: 400 });
  }
  if (!LEVELS.includes(level)) {
    return NextResponse.json({ error: "level must be county, state, or us." }, { status: 400 });
  }

  try {
    const geo = await resolveGeography(location);
    if (!geo) {
      return NextResponse.json(
        { error: `Couldn't find "${location}". Try a city and state, or a 5-digit ZIP code.` },
        { status: 404 },
      );
    }

    const sector = naicsForIndustry(industry);
    const market = await getSectorEconomics(geo, sector, level);
    if (!market) {
      return NextResponse.json({ error: "No market data available for that geography." }, { status: 404 });
    }

    const comparisons = buildComparisons(
      { annualRevenue: Number.isFinite(revenue) ? revenue : 0, employees: Number.isFinite(employees) ? employees : 0 },
      market,
    );

    return NextResponse.json({
      geography: {
        displayName: geo.displayName,
        county: geo.countyName,
        state: geo.stateName,
        zip: geo.zip,
      },
      level,
      sector,
      market,
      comparisons,
      position: positionScore(comparisons),
    });
  } catch (err) {
    console.error("Benchmark lookup failed:", err);
    return NextResponse.json({ error: "Benchmark lookup failed. Please try again." }, { status: 502 });
  }
}
