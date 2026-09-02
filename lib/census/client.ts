/**
 * Census API client — County Business Patterns (business activity) and the
 * American Community Survey (people and income).
 *
 * Server-only: the API key must never reach the browser.
 *
 * Cached for a day. Both datasets are annual, so this costs nothing in
 * freshness and keeps us far inside the API's rate limits.
 */
import { observed, suppressed, unavailable, type DataPoint } from "./types";
import type { ResolvedGeography } from "./geography";
import type { NaicsSector } from "./naics";

const DAY = 86400;
const BASE = "https://api.census.gov/data";

/** Latest vintages verified available. Bump when Census publishes a new year. */
export const CBP_VINTAGE = "2023";
export const ACS_VINTAGE = "2023";

export const CBP_SOURCE = "US Census Bureau — County Business Patterns";
export const ACS_SOURCE = "US Census Bureau — American Community Survey (5-year)";

function key(): string {
  const k = process.env.CENSUS_API_KEY;
  if (!k) throw new Error("CENSUS_API_KEY is not set. Add it to .env.local and restart.");
  return k;
}

/**
 * Census returns a header row followed by data rows. Returns the first data
 * row as an object, or null when the query matched nothing.
 */
async function queryCensus(path: string, params: Record<string, string>) {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key());

  const res = await fetch(url, { next: { revalidate: DAY } });
  if (!res.ok) return null;

  const text = await res.text();
  // A miss can come back as an HTML error page rather than JSON.
  if (!text.trim().startsWith("[")) return null;

  const rows = JSON.parse(text) as string[][];
  if (rows.length < 2) return null;

  const [header, ...data] = rows;
  return Object.fromEntries(header.map((h, i) => [h, data[0][i]])) as Record<string, string>;
}

const num = (v: string | undefined): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export type BusinessActivity = {
  establishments: DataPoint;
  employees: DataPoint;
  annualPayroll: DataPoint;
  sector: NaicsSector;
  geography: string;
};

/**
 * Business activity for a geography and sector.
 *
 * Census suppresses employment and payroll at ZIP level to protect individual
 * businesses — establishment counts are published, the rest come back as zero.
 * We report that as `suppressed` rather than showing a misleading 0.
 */
export async function getBusinessActivity(
  geo: ResolvedGeography,
  sector: NaicsSector,
  level: "zip" | "county",
): Promise<BusinessActivity | null> {
  const isZip = level === "zip";
  if (isZip && !geo.zip) return null;
  if (!isZip && !geo.countyFips) return null;

  const label = isZip
    ? `ZIP ${geo.zip}`
    : `${geo.countyName ?? "county"}, ${geo.stateName}`;

  const params: Record<string, string> = {
    get: "ESTAB,EMP,PAYANN",
    NAICS2017: sector.code,
  };
  if (isZip) {
    params.for = `zip code:${geo.zip}`;
  } else {
    params.for = `county:${geo.countyFips}`;
    params.in = `state:${geo.stateFips}`;
  }

  const row = await queryCensus(`${CBP_VINTAGE}/cbp`, params);
  if (!row) return null;

  const estab = num(row.ESTAB);
  const emp = num(row.EMP);
  const pay = num(row.PAYANN);

  const suppressionNote =
    "Census withholds employment and payroll at ZIP level to protect individual business confidentiality. County figures are published.";

  return {
    sector,
    geography: label,
    establishments:
      estab === null
        ? unavailable(CBP_SOURCE, CBP_VINTAGE, label, "No published figure for this area and sector.")
        : observed(estab, CBP_SOURCE, CBP_VINTAGE, label),
    employees:
      emp === null || (isZip && emp === 0)
        ? suppressed(CBP_SOURCE, CBP_VINTAGE, label, isZip ? suppressionNote : "Withheld for this area and sector.")
        : observed(emp, CBP_SOURCE, CBP_VINTAGE, label),
    annualPayroll:
      pay === null || (isZip && pay === 0)
        ? suppressed(CBP_SOURCE, CBP_VINTAGE, label, isZip ? suppressionNote : "Withheld for this area and sector.")
        : // CBP reports payroll in thousands of dollars.
          observed(pay * 1000, CBP_SOURCE, CBP_VINTAGE, label),
  };
}

export type Demographics = {
  population: DataPoint;
  medianHouseholdIncome: DataPoint;
  geography: string;
};

/** Population and median household income for a ZIP or county. */
export async function getDemographics(
  geo: ResolvedGeography,
  level: "zip" | "county",
): Promise<Demographics | null> {
  const isZip = level === "zip";
  if (isZip && !geo.zip) return null;
  if (!isZip && !geo.countyFips) return null;

  const label = isZip ? `ZIP ${geo.zip}` : `${geo.countyName ?? "county"}, ${geo.stateName}`;

  const params: Record<string, string> = {
    // B01003_001E = total population, B19013_001E = median household income
    get: "NAME,B01003_001E,B19013_001E",
  };
  if (isZip) {
    params.for = `zip code tabulation area:${geo.zip}`;
  } else {
    params.for = `county:${geo.countyFips}`;
    params.in = `state:${geo.stateFips}`;
  }

  const row = await queryCensus(`${ACS_VINTAGE}/acs/acs5`, params);
  if (!row) return null;

  const pop = num(row.B01003_001E);
  const income = num(row.B19013_001E);
  // ACS uses large negative sentinels for withheld values.
  const clean = (n: number | null) => (n === null || n < 0 ? null : n);

  return {
    geography: label,
    population:
      clean(pop) === null
        ? unavailable(ACS_SOURCE, ACS_VINTAGE, label, "No published estimate for this area.")
        : observed(clean(pop)!, ACS_SOURCE, ACS_VINTAGE, label),
    medianHouseholdIncome:
      clean(income) === null
        ? unavailable(ACS_SOURCE, ACS_VINTAGE, label, "Estimate withheld or unavailable for this area.")
        : observed(clean(income)!, ACS_SOURCE, ACS_VINTAGE, label),
  };
}
