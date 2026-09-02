/**
 * Sourcing intelligence (§8, §9) — the reframed version.
 *
 * What this is NOT, and says so plainly: a price list. No free federal source
 * publishes what a given input costs in a given place. BLS producer price
 * indexes are national commodity indexes, not local prices, and supplier
 * directories with real quotes are commercial products.
 *
 * What it IS: where the supplier industry actually clusters (County Business
 * Patterns counts every establishment with paid employees), how far each
 * cluster is from you, and a freight estimate derived from distance and a
 * published per-mile rate — an estimate, labelled as one everywhere it
 * appears.
 */
import { COUNTY_CENTROIDS } from "./geo/countyCentroids";
import type { ResolvedGeography } from "./census/geography";

const DAY = 86400;
const EARTH_RADIUS_MILES = 3958.8;

/**
 * Supplier industries a small business plausibly buys from, with the NAICS
 * code that counts them. Kept deliberately short and concrete — a long NAICS
 * tree would be worse than useless to a non-specialist.
 */
export const SUPPLY_CATEGORIES = [
  { key: "food_mfg", label: "Food manufacturing", naics: "311", note: "Bakeries, dairies, meat and produce processors." },
  { key: "beverage", label: "Beverage manufacturing", naics: "312", note: "Bottlers, breweries, roasters." },
  { key: "textiles", label: "Textiles & apparel", naics: "313", note: "Mills, fabric and garment makers." },
  { key: "wood_paper", label: "Wood & paper products", naics: "321", note: "Lumber, millwork, packaging stock." },
  { key: "printing", label: "Printing", naics: "323", note: "Commercial printers, packaging and labels." },
  { key: "plastics", label: "Plastics & rubber", naics: "326", note: "Containers, moulded parts, packaging." },
  { key: "metal", label: "Fabricated metal", naics: "332", note: "Sheet metal, hardware, machine shops." },
  { key: "machinery", label: "Machinery", naics: "333", note: "Equipment manufacturers." },
  { key: "furniture", label: "Furniture & fixtures", naics: "337", note: "Shelving, seating, commercial fit-out." },
  { key: "wholesale_durable", label: "Wholesale — durable goods", naics: "423", note: "Equipment, hardware, supplies distributors." },
  { key: "wholesale_nondurable", label: "Wholesale — food & consumables", naics: "424", note: "Food, paper, cleaning and consumable distributors." },
  { key: "warehousing", label: "Warehousing & storage", naics: "493", note: "Third-party storage and fulfilment." },
] as const;

export type SupplyCategoryKey = (typeof SUPPLY_CATEGORIES)[number]["key"];

/**
 * Per-mile freight cost used for the estimate. Sourced from published
 * national average truckload rates; a single national figure, not a quote
 * for any lane. Exposed so the UI can state it rather than hide it.
 */
export const FREIGHT = {
  dollarsPerMile: 2.5,
  /**
   * Below this, a per-mile figure is meaningless: short-haul cost is
   * dominated by loading, driver time and minimum charges, not distance.
   * A "2 miles = $6" estimate would be actively misleading, so within this
   * radius we report proximity and say freight is a local-delivery question
   * instead of inventing a number.
   */
  localRadiusMiles: 50,
  basis: "National average dry-van truckload rate, rounded. A real quote depends on lane, weight, fuel and carrier.",
};

export type SupplierCluster = {
  fips: string;
  county: string;
  state: string;
  establishments: number;
  distanceMiles: number;
  /**
   * One-way truckload freight estimate. Null inside the local radius, where
   * a mileage-based figure would understate the real cost.
   */
  estimatedFreightOneWay: number | null;
  isLocal: boolean;
  lat: number;
  lon: number;
};

/** Great-circle distance. Road distance is longer; noted in the UI. */
function haversineMiles(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(s));
}

/**
 * Every US county with at least one establishment in the category, in a
 * single Census call.
 */
async function fetchCountyCounts(naics: string): Promise<Map<string, number>> {
  const url = new URL("https://api.census.gov/data/2023/cbp");
  url.searchParams.set("get", "ESTAB");
  url.searchParams.set("for", "county:*");
  url.searchParams.set("NAICS2017", naics);
  url.searchParams.set("key", process.env.CENSUS_API_KEY ?? "");

  const res = await fetch(url, { next: { revalidate: DAY } });
  if (!res.ok) return new Map();

  const text = await res.text();
  if (!text.trim().startsWith("[")) return new Map();

  const rows = JSON.parse(text) as string[][];
  const header = rows[0];
  const iEstab = header.indexOf("ESTAB");
  const iState = header.indexOf("state");
  const iCounty = header.indexOf("county");

  const out = new Map<string, number>();
  for (const r of rows.slice(1)) {
    const n = Number(r[iEstab]);
    if (!Number.isFinite(n) || n <= 0) continue;
    out.set(`${r[iState].padStart(2, "0")}${r[iCounty].padStart(3, "0")}`, n);
  }
  return out;
}

export type SourcingResult = {
  category: { key: string; label: string; naics: string; note: string };
  origin: { label: string; lat: number; lon: number };
  /** Nearest clusters, ranked by the chosen criterion. */
  clusters: SupplierCluster[];
  totalCountiesWithSuppliers: number;
  freight: typeof FREIGHT;
};

export type RankBy = "distance" | "density";

export async function findSuppliers(
  geo: ResolvedGeography,
  categoryKey: SupplyCategoryKey,
  rankBy: RankBy = "distance",
  limit = 8,
): Promise<SourcingResult | null> {
  const category = SUPPLY_CATEGORIES.find((c) => c.key === categoryKey);
  if (!category) return null;

  const counts = await fetchCountyCounts(category.naics);
  if (counts.size === 0) return null;

  const clusters: SupplierCluster[] = [];
  for (const [fips, establishments] of counts) {
    const centroid = COUNTY_CENTROIDS[fips];
    if (!centroid) continue;

    const distanceMiles = haversineMiles(geo.lat, geo.lon, centroid.lat, centroid.lon);
    const isLocal = distanceMiles < FREIGHT.localRadiusMiles;
    clusters.push({
      fips,
      county: centroid.n,
      state: centroid.s,
      establishments,
      distanceMiles,
      estimatedFreightOneWay: isLocal ? null : distanceMiles * FREIGHT.dollarsPerMile,
      isLocal,
      lat: centroid.lat,
      lon: centroid.lon,
    });
  }

  // Distance ranking still respects supply: a county 20 miles away with one
  // establishment is rarely more useful than 60 miles away with forty. So
  // distance ranking is filtered to counties with meaningful supply first.
  const ranked =
    rankBy === "density"
      ? clusters.sort((a, b) => b.establishments - a.establishments)
      : clusters
          .filter((c) => c.establishments >= 3)
          .sort((a, b) => a.distanceMiles - b.distanceMiles);

  // If nothing nearby clears the supply threshold, fall back to pure distance
  // rather than returning an empty list.
  const list = ranked.length > 0 ? ranked : clusters.sort((a, b) => a.distanceMiles - b.distanceMiles);

  return {
    category,
    origin: {
      label: geo.countyName ? `${geo.countyName}, ${geo.stateName}` : geo.stateName,
      lat: geo.lat,
      lon: geo.lon,
    },
    clusters: list.slice(0, limit),
    totalCountiesWithSuppliers: counts.size,
    freight: FREIGHT,
  };
}
