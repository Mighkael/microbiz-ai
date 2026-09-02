// app/api/market/route.ts
// GET /api/market?location=Clarksville,+TN&industry=Retail
//
// Assembles a market profile for a location: who lives there, and how much
// business activity exists — at both ZIP and county level, because Census
// publishes different things at each.

import { NextRequest, NextResponse } from "next/server";
import { resolveGeography } from "@/lib/census/geography";
import { getBusinessActivity, getDemographics } from "@/lib/census/client";
import { naicsForIndustry, ALL_SECTORS } from "@/lib/census/naics";

export async function GET(req: NextRequest) {
  if (!process.env.CENSUS_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing CENSUS_API_KEY. Add it to .env.local and restart." },
      { status: 500 },
    );
  }

  const location = req.nextUrl.searchParams.get("location")?.trim();
  const industry = req.nextUrl.searchParams.get("industry")?.trim();

  if (!location || location.length < 3) {
    return NextResponse.json({ error: "A location is required (city and state, or a ZIP code)." }, { status: 400 });
  }

  try {
    const geo = await resolveGeography(location);
    if (!geo) {
      return NextResponse.json(
        { error: `Couldn't find "${location}". Try a city and state, or a 5-digit ZIP code.` },
        { status: 404 },
      );
    }

    const sector = industry ? naicsForIndustry(industry) : ALL_SECTORS;

    // Fetched together — each is independently cached, and a miss on one
    // shouldn't blank the whole profile.
    const [zipDemographics, countyDemographics, zipActivity, countyActivity, countyAllSectors] =
      await Promise.all([
        geo.zip ? getDemographics(geo, "zip") : Promise.resolve(null),
        getDemographics(geo, "county"),
        geo.zip ? getBusinessActivity(geo, sector, "zip") : Promise.resolve(null),
        getBusinessActivity(geo, sector, "county"),
        getBusinessActivity(geo, ALL_SECTORS, "county"),
      ]);

    return NextResponse.json({
      geography: {
        query: geo.query,
        displayName: geo.displayName,
        zip: geo.zip,
        county: geo.countyName,
        state: geo.stateName,
        lat: geo.lat,
        lon: geo.lon,
      },
      sector,
      demographics: { zip: zipDemographics, county: countyDemographics },
      activity: { zip: zipActivity, county: countyActivity, countyAllSectors },
    });
  } catch (err) {
    console.error("Market lookup failed:", err);
    return NextResponse.json(
      { error: "Market data lookup failed. Please try again." },
      { status: 502 },
    );
  }
}
