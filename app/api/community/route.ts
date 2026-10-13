// app/api/community/route.ts
// GET /api/community?location=Clarksville, TN[&industry=Retail]
//
// The community a business would operate in: who lives there, community
// health, disaster history and climate — plus, when an industry is given,
// what those conditions might mean for that kind of business.

import { NextRequest, NextResponse } from "next/server";
import { resolveGeography } from "@/lib/census/geography";
import { getCommunityProfile } from "@/lib/community";
import { deriveImplications, IMPLICATION_CAVEAT } from "@/lib/community/implications";
import { scoreCommunity } from "@/lib/community/score";
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
  const industry = industryRaw in INDUSTRIES ? industryRaw : undefined;

  if (!location || location.length < 3) {
    return NextResponse.json({ error: "A location is required." }, { status: 400 });
  }

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
        { error: "Community figures are published by county, and that point didn't fall inside one. Try a nearby town." },
        { status: 404 },
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const profile = await getCommunityProfile(geo, today);
    if (!profile) {
      return NextResponse.json(
        { error: "No community figures are published for that county." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ...profile,
      industry: industry ?? null,
      score: scoreCommunity(profile, industry),
      implications: deriveImplications(profile, industry),
      implicationCaveat: IMPLICATION_CAVEAT,
    });
  } catch (err) {
    console.error("Community profile failed:", err);
    return NextResponse.json({ error: "Something went wrong loading that community. Please try again." }, { status: 500 });
  }
}
