// app/api/prospects/search/route.ts
// GET /api/prospects/search?location=...&radius=10&targets=food,offices&contactOnly=1
//
// Businesses near a point, from OpenStreetMap, with the contact details they
// published themselves. Business listings only — see lib/prospects/osm.ts.

import { NextRequest, NextResponse } from "next/server";
import { resolveGeography } from "@/lib/census/geography";
import { findProspects, MAX_RADIUS_MILES, MAX_TARGETS, OSM_SOURCE, OSM_LIMITATIONS } from "@/lib/prospects/osm";
import { TARGET_CATEGORIES } from "@/lib/prospects/categories";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const location = p.get("location")?.trim();
  const radius = Number(p.get("radius") ?? "10");
  const targets = (p.get("targets") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => TARGET_CATEGORIES.some((c) => c.key === t));
  const contactOnly = p.get("contactOnly") === "1";

  if (!location || location.length < 3) {
    return NextResponse.json({ error: "A location is required." }, { status: 400 });
  }
  if (targets.length === 0) {
    return NextResponse.json({ error: "Choose at least one kind of business to look for." }, { status: 400 });
  }
  if (targets.length > MAX_TARGETS) {
    return NextResponse.json(
      { error: `Search up to ${MAX_TARGETS} kinds of business at a time — broader searches time out.` },
      { status: 400 },
    );
  }

  try {
    const geo = await resolveGeography(location);
    if (!geo) {
      return NextResponse.json(
        { error: `Couldn't find "${location}" in the United States. Try a city and state, or a 5-digit ZIP code.` },
        { status: 404 },
      );
    }

    const result = await findProspects({
      lat: geo.lat,
      lon: geo.lon,
      radiusMiles: Number.isFinite(radius) ? radius : 10,
      targets,
      needsContact: contactOnly,
    });

    if (!result) {
      return NextResponse.json(
        { error: "The OpenStreetMap search service is overloaded right now, so the search came back incomplete. Wait a minute and try again — or narrow it to fewer kinds of business, or a smaller radius." },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ...result,
      origin: { label: geo.countyName ? `${geo.countyName}, ${geo.stateName}` : geo.stateName, query: location },
      maxRadiusMiles: MAX_RADIUS_MILES,
      source: OSM_SOURCE,
      limitations: OSM_LIMITATIONS,
    });
  } catch (err) {
    console.error("Prospect search failed:", err);
    return NextResponse.json({ error: "Something went wrong finding businesses. Please try again." }, { status: 500 });
  }
}
