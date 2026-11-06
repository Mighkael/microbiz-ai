// app/api/competitors/records/route.ts
// GET /api/competitors/records?location=...&industry=Healthcare
//
// Published ratings and complaints for the sectors where a federal body
// collects them. See lib/competitors/records.ts for why that is healthcare
// and financial services and not, say, barbers.

import { NextRequest, NextResponse } from "next/server";
import { resolveGeography } from "@/lib/census/geography";
import {
  getCmsRatings, getFinancialComplaints, coverageFor,
  NO_PUBLIC_RATINGS_NOTE, RECORD_LIMITATIONS,
} from "@/lib/competitors/records";
import { INDUSTRIES } from "@/lib/data";

export const maxDuration = 60;

/** CMS and the CFPB both key on the two-letter code, not the state's name. */
const STATE_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO",
  Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY",
  Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN",
  Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH",
  "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
  Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
  Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI",
  Wyoming: "WY", "Puerto Rico": "PR",
};

/** Two full years back — recent enough to be current, long enough to be stable. */
function twoYearsAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 2);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const location = p.get("location")?.trim();
  const industry = p.get("industry")?.trim() ?? "";

  if (!location || location.length < 3) {
    return NextResponse.json({ error: "A location is required." }, { status: 400 });
  }
  if (!(industry in INDUSTRIES)) {
    return NextResponse.json({ error: "Choose what your business does." }, { status: 400 });
  }

  try {
    const geo = await resolveGeography(location);
    if (!geo) {
      return NextResponse.json(
        { error: `Couldn't find "${location}" in the United States. Try a city and state, or a 5-digit ZIP code.` },
        { status: 404 },
      );
    }

    const abbr = STATE_ABBR[geo.stateName] ?? "";
    const coverage = coverageFor(industry);
    const area = geo.countyName ? `${geo.countyName}, ${geo.stateName}` : geo.stateName;

    if (!abbr || coverage === "none") {
      return NextResponse.json({
        area, industry, coverage: "none",
        note: NO_PUBLIC_RATINGS_NOTE,
        sectors: [], complaints: null, limitations: RECORD_LIMITATIONS,
      });
    }

    if (coverage === "cms") {
      const sectors = await getCmsRatings(abbr, geo.countyName ?? "", location.split(",")[0].trim());
      return NextResponse.json({
        area, industry, coverage: sectors.length ? "cms" : "none",
        note: sectors.length ? null : NO_PUBLIC_RATINGS_NOTE,
        sectors, complaints: null, limitations: RECORD_LIMITATIONS,
      });
    }

    const complaints = await getFinancialComplaints(geo.zip, abbr, twoYearsAgo());
    return NextResponse.json({
      area, industry, coverage: complaints ? "cfpb" : "none",
      note: complaints ? null : NO_PUBLIC_RATINGS_NOTE,
      sectors: [], complaints, limitations: RECORD_LIMITATIONS,
    });
  } catch (err) {
    console.error("Competitor records failed:", err);
    return NextResponse.json({ error: "Something went wrong loading those records. Please try again." }, { status: 500 });
  }
}
