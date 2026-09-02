/**
 * Resolves a free-text location ("Clarksville, TN", "37040") into the FIPS
 * codes the Census API needs.
 *
 * Two hops, both free and keyless:
 *   1. Nominatim (OpenStreetMap) — text to coordinates
 *   2. Census Geocoder — coordinates to state + county FIPS
 *
 * Cached for a day: these mappings essentially never change, and it keeps us
 * well inside Nominatim's usage policy.
 */

const DAY = 86400;

export type ResolvedGeography = {
  query: string;
  displayName: string;
  lat: number;
  lon: number;
  /** 2-digit state FIPS, e.g. "47". */
  stateFips: string;
  stateName: string;
  /** 3-digit county FIPS, e.g. "125". Null if the point fell outside a county. */
  countyFips: string | null;
  countyName: string | null;
  /** 5-digit ZIP, when the query itself was a ZIP or the geocoder returned one. */
  zip: string | null;
};

const ZIP_RE = /^\s*(\d{5})\s*$/;

type NominatimHit = {
  lat: string;
  lon: string;
  display_name: string;
  address?: { postcode?: string };
};

async function geocode(query: string): Promise<NominatimHit | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "us");

  const res = await fetch(url, {
    headers: { "User-Agent": "MicroBizAI/1.0 (https://www.microbiz-ai.com)" },
    next: { revalidate: DAY },
  });
  if (!res.ok) return null;
  const hits = (await res.json()) as NominatimHit[];
  return hits[0] ?? null;
}

type CensusGeoLayer = { NAME?: string; STATE?: string; COUNTY?: string; BASENAME?: string };

async function coordsToFips(lat: number, lon: number) {
  const url = new URL("https://geocoding.geo.census.gov/geocoder/geographies/coordinates");
  url.searchParams.set("x", String(lon));
  url.searchParams.set("y", String(lat));
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("vintage", "Current_Current");
  url.searchParams.set("layers", "Counties,States");
  url.searchParams.set("format", "json");

  const res = await fetch(url, { next: { revalidate: DAY } });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    result?: { geographies?: Record<string, CensusGeoLayer[]> };
  };
  const geo = data.result?.geographies;
  if (!geo) return null;

  const state = geo["States"]?.[0];
  const county = geo["Counties"]?.[0];
  if (!state?.STATE) return null;

  return {
    stateFips: state.STATE,
    stateName: state.NAME ?? "",
    countyFips: county?.COUNTY ?? null,
    countyName: county?.NAME ?? null,
  };
}

export async function resolveGeography(query: string): Promise<ResolvedGeography | null> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return null;

  const zipMatch = trimmed.match(ZIP_RE);
  // Nominatim resolves a bare ZIP more reliably when told it's a postal code.
  const hit = await geocode(zipMatch ? `${zipMatch[1]}, USA` : trimmed);
  if (!hit) return null;

  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const fips = await coordsToFips(lat, lon);
  if (!fips) return null;

  return {
    query: trimmed,
    displayName: hit.display_name,
    lat,
    lon,
    ...fips,
    zip: zipMatch ? zipMatch[1] : hit.address?.postcode?.slice(0, 5) ?? null,
  };
}
