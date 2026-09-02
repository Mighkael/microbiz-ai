/**
 * Assembles everything known about a location for Location Intelligence (§5):
 * who lives there, whether it's growing, and how the chosen sector performs.
 *
 * National figures are fetched alongside so every local number can be read
 * against the US average — a median income means little without one.
 *
 * Server-only.
 */
import { observed, unavailable, type DataPoint } from "./types";
import { resolveGeography, type ResolvedGeography } from "./geography";
import { getSectorEconomics, type SectorEconomics } from "./economic";
import type { NaicsSector } from "./naics";

const DAY = 86400;
const BASE = "https://api.census.gov/data";

export const ACS_NOW = "2023";
/** 2014–2018 vs 2019–2023: non-overlapping windows, so comparable. */
export const ACS_THEN = "2018";
export const ACS_SOURCE = "US Census Bureau — American Community Survey (5-year)";

async function acs(
  vintage: string, forClause: string, inClause?: string,
): Promise<{ population: number | null; medianIncome: number | null } | null> {
  const url = new URL(`${BASE}/${vintage}/acs/acs5`);
  url.searchParams.set("get", "B01003_001E,B19013_001E");
  url.searchParams.set("for", forClause);
  if (inClause) url.searchParams.set("in", inClause);
  url.searchParams.set("key", process.env.CENSUS_API_KEY ?? "");

  const res = await fetch(url, { next: { revalidate: DAY } });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim().startsWith("[")) return null;
  const rows = JSON.parse(text) as string[][];
  if (rows.length < 2) return null;

  const clean = (v: string) => {
    const n = Number(v);
    // ACS uses large negative sentinels for withheld values.
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  return { population: clean(rows[1][0]), medianIncome: clean(rows[1][1]) };
}

export type LocationProfile = {
  geography: {
    query: string;
    displayName: string;
    label: string;
    county: string | null;
    state: string;
    lat: number;
    lon: number;
  };
  sector: NaicsSector;
  population: DataPoint;
  medianIncome: DataPoint;
  /** Fractional change over five years, e.g. 0.16 for +16%. */
  populationGrowth: DataPoint;
  incomeGrowth: DataPoint;
  economics: SectorEconomics | null;
  /** Residents per establishment in this sector — headroom, not saturation. */
  residentsPerBusiness: DataPoint;
};

export type NationalReference = {
  population: number | null;
  medianIncome: number | null;
  economics: SectorEconomics | null;
};

export async function getNationalReference(
  geo: ResolvedGeography, sector: NaicsSector,
): Promise<NationalReference> {
  const [now, economics] = await Promise.all([
    acs(ACS_NOW, "us:1"),
    getSectorEconomics(geo, sector, "us"),
  ]);
  return {
    population: now?.population ?? null,
    medianIncome: now?.medianIncome ?? null,
    economics,
  };
}

export async function getLocationProfile(
  query: string, sector: NaicsSector,
): Promise<LocationProfile | null> {
  const geo = await resolveGeography(query);
  if (!geo || !geo.countyFips) return null;

  const label = `${geo.countyName ?? "county"}, ${geo.stateName}`;
  const forCounty = `county:${geo.countyFips}`;
  const inState = `state:${geo.stateFips}`;

  const [now, then, economics] = await Promise.all([
    acs(ACS_NOW, forCounty, inState),
    acs(ACS_THEN, forCounty, inState),
    getSectorEconomics(geo, sector, "county"),
  ]);

  const miss = (why: string) => unavailable(ACS_SOURCE, ACS_NOW, label, why);
  const noData = "Not published for this area.";

  const growth = (
    current: number | null, past: number | null, what: string,
  ): DataPoint =>
    current === null || past === null || past === 0
      ? miss(`Five-year ${what} change unavailable for this area.`)
      : {
          value: (current - past) / past,
          status: "calculated",
          source: ACS_SOURCE,
          vintage: `${ACS_THEN}–${ACS_NOW}`,
          geography: label,
          note: `Change in ${what} between the ${ACS_THEN} and ${ACS_NOW} five-year estimates.`,
        };

  const estab = economics?.establishments.value ?? null;
  const pop = now?.population ?? null;

  return {
    geography: {
      query,
      displayName: geo.displayName,
      label,
      county: geo.countyName,
      state: geo.stateName,
      lat: geo.lat,
      lon: geo.lon,
    },
    sector,
    population: pop === null ? miss(noData) : observed(pop, ACS_SOURCE, ACS_NOW, label),
    medianIncome:
      now?.medianIncome == null ? miss(noData) : observed(now.medianIncome, ACS_SOURCE, ACS_NOW, label),
    populationGrowth: growth(now?.population ?? null, then?.population ?? null, "population"),
    incomeGrowth: growth(now?.medianIncome ?? null, then?.medianIncome ?? null, "median household income"),
    economics,
    residentsPerBusiness:
      pop === null || estab === null || estab === 0
        ? miss("Needs both population and business counts, and one is unavailable here.")
        : {
            value: pop / estab,
            status: "calculated",
            source: "US Census Bureau — ACS and Economic Census",
            vintage: `${ACS_NOW} / 2022`,
            geography: label,
            note: "Population divided by the number of businesses in this sector.",
          },
  };
}
