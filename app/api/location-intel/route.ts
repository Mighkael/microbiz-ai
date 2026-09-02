// app/api/location-intel/route.ts
// GET /api/location-intel?locations=Clarksville,+TN|Nashville,+TN&industry=Retail
//
// Location Intelligence (§5): profiles one to three markets, scores each on
// opportunity, and returns them side by side for comparison.

import { NextRequest, NextResponse } from "next/server";
import { getLocationProfile, getNationalReference } from "@/lib/census/location";
import { resolveGeography } from "@/lib/census/geography";
import { naicsForIndustry } from "@/lib/census/naics";
import { scoreLocation } from "@/lib/locationScore";

const MAX_LOCATIONS = 3;

export async function GET(req: NextRequest) {
  if (!process.env.CENSUS_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing CENSUS_API_KEY. Add it to .env.local and restart." },
      { status: 500 },
    );
  }

  const raw = req.nextUrl.searchParams.get("locations")?.trim();
  const industry = req.nextUrl.searchParams.get("industry")?.trim() ?? "Other";

  const queries = (raw ?? "")
    .split("|")
    .map((q) => q.trim())
    .filter((q) => q.length >= 3)
    .slice(0, MAX_LOCATIONS);

  if (queries.length === 0) {
    return NextResponse.json(
      { error: "Add at least one location — a city and state, or a ZIP code." },
      { status: 400 },
    );
  }

  const sector = naicsForIndustry(industry);

  try {
    // The national reference needs any resolved geography to build its
    // request, so resolve the first location before fanning out.
    const anchor = await resolveGeography(queries[0]);
    if (!anchor) {
      return NextResponse.json(
        { error: `Couldn't find "${queries[0]}". Try a city and state, or a 5-digit ZIP code.` },
        { status: 404 },
      );
    }

    const [national, ...profiles] = await Promise.all([
      getNationalReference(anchor, sector),
      ...queries.map((q) => getLocationProfile(q, sector)),
    ]);

    const results = queries.map((query, i) => {
      const profile = profiles[i];
      if (!profile) {
        return { query, error: `Couldn't find "${query}", or it has no county-level data.`, profile: null, score: null };
      }
      return { query, error: null, profile, score: scoreLocation(profile, national) };
    });

    return NextResponse.json({ sector, national, results });
  } catch (err) {
    console.error("Location intelligence lookup failed:", err);
    return NextResponse.json({ error: "Location lookup failed. Please try again." }, { status: 502 });
  }
}
