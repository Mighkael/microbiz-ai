// app/api/timeseries/route.ts
// GET /api/timeseries?location=...&level=county&industry=Retail&indicators=establishments,population
//
// Data Lab (§13, §14): multi-year series for selected indicators, geography
// and sector.

import { NextRequest, NextResponse } from "next/server";
import { resolveGeography } from "@/lib/census/geography";
import { naicsForIndustry } from "@/lib/census/naics";
import {
  getSeries, geoLabel, INDICATORS, ACS_OVERLAP_NOTE,
  type IndicatorKey, type GeoLevel,
} from "@/lib/census/timeseries";

export const maxDuration = 60;

const LEVELS: GeoLevel[] = ["zip", "county", "state"];

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
  const level = (p.get("level") ?? "county") as GeoLevel;
  const requested = (p.get("indicators") ?? "establishments")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is IndicatorKey => INDICATORS.some((i) => i.key === s));

  if (!location || location.length < 3) {
    return NextResponse.json({ error: "A location is required." }, { status: 400 });
  }
  if (!LEVELS.includes(level)) {
    return NextResponse.json({ error: "level must be zip, county, or state." }, { status: 400 });
  }
  if (requested.length === 0) {
    return NextResponse.json({ error: "Select at least one indicator." }, { status: 400 });
  }

  try {
    const geo = await resolveGeography(location);
    if (!geo) {
      return NextResponse.json(
        { error: `Couldn't find "${location}". Try a city and state, or a 5-digit ZIP code.` },
        { status: 404 },
      );
    }
    if (level === "zip" && !geo.zip) {
      return NextResponse.json(
        { error: "Enter a 5-digit ZIP code to explore at ZIP level, or switch to county." },
        { status: 400 },
      );
    }

    const sector = naicsForIndustry(industry);
    const series = await Promise.all(requested.map((key) => getSeries(key, geo, level, sector)));

    const usesAcs = requested.some((k) => INDICATORS.find((i) => i.key === k)?.dataset === "acs");

    return NextResponse.json({
      geography: { label: geoLabel(geo, level), level, county: geo.countyName, state: geo.stateName, zip: geo.zip },
      sector,
      series: series.filter(Boolean),
      methodology: [
        "Business figures come from County Business Patterns, an annual census of establishments with paid employees.",
        "Population and income come from the American Community Survey 5-year estimates.",
        ...(usesAcs ? [ACS_OVERLAP_NOTE] : []),
        "Census withholds employment and payroll for small geographies to protect individual business confidentiality; withheld years appear as gaps rather than zeros.",
      ],
    });
  } catch (err) {
    console.error("Time series lookup failed:", err);
    return NextResponse.json({ error: "Data lookup failed. Please try again." }, { status: 502 });
  }
}
