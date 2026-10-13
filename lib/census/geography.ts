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
  boundingbox?: [string, string, string, string];
  address?: { postcode?: string; country_code?: string };
};

export type UsGeocode = {
  lat: number;
  lon: number;
  displayName: string;
  /** south, north, west, east — as Nominatim orders it. */
  boundingBox: [number, number, number, number] | null;
  postcode: string | null;
};

/**
 * Is this point actually in the United States?
 *
 * The last guard against a lookup landing abroad. Covers the lower 48,
 * Alaska (including the Aleutians, which cross the antimeridian into
 * positive longitudes), Hawaii, Puerto Rico and the Virgin Islands.
 */
function inUnitedStates(lat: number, lon: number): boolean {
  if (lat < 15 || lat > 72) return false;
  return (lon >= -180 && lon <= -64) || (lon >= 172 && lon <= 180);
}

/**
 * Free-text place to coordinates, restricted to the United States.
 *
 * Used by every map and every data lookup, because the alternative — each
 * caller writing its own Nominatim query — is how a bare ZIP code came to be
 * geocoded to a postcode in Ukraine and drawn on the map.
 *
 * A five-digit ZIP is sent as a postal-code lookup rather than free text:
 * "37040" as a search term matches postcodes all over the world, while
 * postalcode=37040&country=us can only match in the US.
 */
export async function geocodeUS(query: string): Promise<UsGeocode | null> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return null;

  const zip = trimmed.match(ZIP_RE)?.[1] ?? null;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  if (zip) {
    url.searchParams.set("postalcode", zip);
    url.searchParams.set("country", "us");
  } else {
    url.searchParams.set("q", trimmed);
    url.searchParams.set("countrycodes", "us");
  }
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url, {
    headers: { "User-Agent": "MicroBizAI/1.0 (https://www.microbiz-ai.com)" },
    next: { revalidate: DAY },
  });
  if (!res.ok) return null;

  const hits = (await res.json()) as NominatimHit[];
  const hit = hits[0];
  if (!hit) return null;

  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  // Belt and braces: the filters above should make this impossible.
  if (!inUnitedStates(lat, lon)) return null;

  const box = hit.boundingbox?.map(Number);
  return {
    lat,
    lon,
    displayName: hit.display_name,
    boundingBox: box && box.length === 4 && box.every(Number.isFinite)
      ? (box as [number, number, number, number])
      : null,
    postcode: zip ?? hit.address?.postcode?.slice(0, 5) ?? null,
  };
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

  const hit = await geocodeUS(trimmed);
  if (!hit) return null;

  const fips = await coordsToFips(hit.lat, hit.lon);
  if (!fips) return null;

  return {
    query: trimmed,
    displayName: hit.displayName,
    lat: hit.lat,
    lon: hit.lon,
    ...fips,
    zip: hit.postcode,
  };
}
