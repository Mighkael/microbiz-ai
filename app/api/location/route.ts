// app/api/location/route.ts
// GET /api/location?q=City,%20State
//
// Two free, keyless, government/open-data lookups, chained server-side:
//  1. Geocode the free-text location with OpenStreetMap's Nominatim.
//  2. Point-in-polygon check against HUD's official Opportunity Zones
//     FeatureServer (U.S. Treasury-designated census tracts under the 2017
//     Tax Cuts and Jobs Act — the closest well-defined federal proxy for
//     "economically distressed / underinvested" communities).
//
// This is a real, sourced federal designation, not an invented score. It
// only tells you whether the tract was designated an Opportunity Zone as of
// the 2010 census boundaries used for that program — it is one data point,
// not a full picture of a neighborhood.

import { NextRequest, NextResponse } from "next/server";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OZ_LAYER_URL = "https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/Opportunity_Zones/FeatureServer/13/query";

type GeocodeResult = {
  lat: number;
  lon: number;
  displayName: string;
  boundingBox: [number, number, number, number]; // south, north, west, east
};

async function geocode(q: string): Promise<GeocodeResult | null> {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=0`;
  const res = await fetch(url, {
    headers: { "User-Agent": "MicroBizAI/0.1 (small-business dashboard prototype)" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const hit = Array.isArray(data) ? data[0] : null;
  if (!hit) return null;
  const [south, north, west, east] = hit.boundingbox.map((n: string) => parseFloat(n));
  return { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon), displayName: hit.display_name, boundingBox: [south, north, west, east] };
}

type OZResult = {
  designated: boolean;
  tract: string | null;
  county: string | null;
  state: string | null;
  rural: boolean | null;
};

async function checkOpportunityZone(lat: number, lon: number): Promise<OZResult> {
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "GEOID10,STATE_NAME,COUNTY,Rural",
    returnGeometry: "false",
    f: "json",
  });
  const res = await fetch(`${OZ_LAYER_URL}?${params.toString()}`);
  if (!res.ok) return { designated: false, tract: null, county: null, state: null, rural: null };
  const data = await res.json();
  const feature = data?.features?.[0]?.attributes;
  if (!feature) return { designated: false, tract: null, county: null, state: null, rural: null };
  return {
    designated: true,
    tract: feature.GEOID10 ?? null,
    county: feature.COUNTY ?? null,
    state: feature.STATE_NAME ?? null,
    rural: feature.Rural === "Y",
  };
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "Missing location query." }, { status: 400 });

  try {
    const place = await geocode(q);
    if (!place) return NextResponse.json({ error: "Location not found." }, { status: 404 });

    const oz = await checkOpportunityZone(place.lat, place.lon);

    return NextResponse.json({
      lat: place.lat,
      lon: place.lon,
      displayName: place.displayName,
      boundingBox: place.boundingBox,
      opportunityZone: oz,
    });
  } catch (err) {
    console.error("Location lookup failed:", err);
    return NextResponse.json({ error: "Location lookup failed. Try a more specific city and state." }, { status: 502 });
  }
}
