/**
 * Multi-year series for the Data Lab (§13, §14).
 *
 * Everything before this queried a single vintage. This walks several, so a
 * researcher can see whether a market is growing or shrinking rather than
 * only where it stands today.
 *
 * Ranges are set by what each dataset actually publishes, verified against
 * the API — County Business Patterns back to 2017, ACS back to 2018.
 *
 * Server-only.
 */
import type { ResolvedGeography } from "./geography";
import type { NaicsSector } from "./naics";

const DAY = 86400;
const BASE = "https://api.census.gov/data";

export const CBP_YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023] as const;
export const ACS_YEARS = [2018, 2019, 2020, 2021, 2022, 2023] as const;

/**
 * Consecutive ACS 5-year estimates share four years of sample — 2022 covers
 * 2018–2022 and 2023 covers 2019–2023. The trend line is meaningful, but
 * year-over-year moves are not independent observations and shouldn't be
 * read as annual change. Surfaced in the UI rather than buried here.
 */
export const ACS_OVERLAP_NOTE =
  "ACS 5-year estimates overlap: each year shares four years of sample with the one before it. The trend is sound, but consecutive years are not independent measurements.";

export type IndicatorKey =
  | "establishments"
  | "employment"
  | "annual_payroll"
  | "population"
  | "median_income";

export type IndicatorMeta = {
  key: IndicatorKey;
  label: string;
  unit: "count" | "currency";
  dataset: "cbp" | "acs";
  source: string;
  /** ZIP-level availability — Census suppresses some measures there. */
  zipAvailable: boolean;
  description: string;
};

export const INDICATORS: IndicatorMeta[] = [
  {
    key: "establishments", label: "Businesses", unit: "count", dataset: "cbp",
    source: "US Census Bureau — County Business Patterns",
    zipAvailable: true,
    description: "Number of business establishments in the sector.",
  },
  {
    key: "employment", label: "Employment", unit: "count", dataset: "cbp",
    source: "US Census Bureau — County Business Patterns",
    zipAvailable: false,
    description: "People employed in the sector. Withheld at ZIP level.",
  },
  {
    key: "annual_payroll", label: "Annual payroll", unit: "currency", dataset: "cbp",
    source: "US Census Bureau — County Business Patterns",
    zipAvailable: false,
    description: "Total wages paid in the sector. Withheld at ZIP level.",
  },
  {
    key: "population", label: "Population", unit: "count", dataset: "acs",
    source: "US Census Bureau — American Community Survey (5-year)",
    zipAvailable: true,
    description: "Total residents. Not sector-specific.",
  },
  {
    key: "median_income", label: "Median household income", unit: "currency", dataset: "acs",
    source: "US Census Bureau — American Community Survey (5-year)",
    zipAvailable: true,
    description: "Median household income. Not sector-specific.",
  },
];

const CBP_FIELD: Record<string, string> = {
  establishments: "ESTAB",
  employment: "EMP",
  annual_payroll: "PAYANN",
};
const ACS_FIELD: Record<string, string> = {
  population: "B01003_001E",
  median_income: "B19013_001E",
};

export type SeriesPoint = { year: number; value: number | null; note?: string };
export type Series = {
  indicator: IndicatorKey;
  label: string;
  unit: "count" | "currency";
  source: string;
  geography: string;
  points: SeriesPoint[];
  /** Fractional change first-to-last where both ends have data. */
  change: number | null;
};

export type GeoLevel = "zip" | "county" | "state";

function forClause(geo: ResolvedGeography, level: GeoLevel, dataset: "cbp" | "acs") {
  if (level === "zip") {
    return dataset === "cbp"
      ? { for: `zip code:${geo.zip}` }
      : { for: `zip code tabulation area:${geo.zip}` };
  }
  if (level === "state") return { for: `state:${geo.stateFips}` };
  return { for: `county:${geo.countyFips}`, in: `state:${geo.stateFips}` };
}

export function geoLabel(geo: ResolvedGeography, level: GeoLevel) {
  if (level === "zip") return `ZIP ${geo.zip}`;
  if (level === "state") return geo.stateName;
  return `${geo.countyName ?? "county"}, ${geo.stateName}`;
}

async function fetchYear(
  year: number, indicator: IndicatorMeta, geo: ResolvedGeography, level: GeoLevel, sector: NaicsSector,
): Promise<number | null> {
  const params = new URLSearchParams();
  const clause = forClause(geo, level, indicator.dataset);

  if (indicator.dataset === "cbp") {
    params.set("get", CBP_FIELD[indicator.key]);
    params.set("NAICS2017", sector.code);
  } else {
    params.set("get", ACS_FIELD[indicator.key]);
  }
  params.set("for", clause.for);
  if (clause.in) params.set("in", clause.in);
  params.set("key", process.env.CENSUS_API_KEY ?? "");

  const path = indicator.dataset === "cbp" ? `${year}/cbp` : `${year}/acs/acs5`;

  try {
    const res = await fetch(`${BASE}/${path}?${params}`, { next: { revalidate: DAY } });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.trim().startsWith("[")) return null;
    const rows = JSON.parse(text) as string[][];
    if (rows.length < 2) return null;

    const n = Number(rows[1][0]);
    if (!Number.isFinite(n) || n < 0) return null;
    // CBP reports employment and payroll as 0 where suppressed.
    if (indicator.dataset === "cbp" && indicator.key !== "establishments" && n === 0) return null;
    return indicator.key === "annual_payroll" ? n * 1000 : n;
  } catch {
    return null;
  }
}

export async function getSeries(
  indicatorKey: IndicatorKey,
  geo: ResolvedGeography,
  level: GeoLevel,
  sector: NaicsSector,
): Promise<Series | null> {
  const indicator = INDICATORS.find((i) => i.key === indicatorKey);
  if (!indicator) return null;
  if (level === "zip" && (!geo.zip || !indicator.zipAvailable)) {
    return {
      indicator: indicatorKey,
      label: indicator.label,
      unit: indicator.unit,
      source: indicator.source,
      geography: geoLabel(geo, level),
      points: [],
      change: null,
    };
  }

  const years = indicator.dataset === "cbp" ? CBP_YEARS : ACS_YEARS;
  const values = await Promise.all(years.map((y) => fetchYear(y, indicator, geo, level, sector)));

  const points: SeriesPoint[] = years.map((year, i) => ({ year, value: values[i] }));
  const withData = points.filter((p) => p.value !== null);
  const change =
    withData.length >= 2 && withData[0].value
      ? ((withData[withData.length - 1].value as number) - (withData[0].value as number)) / (withData[0].value as number)
      : null;

  return {
    indicator: indicatorKey,
    label: indicator.label,
    unit: indicator.unit,
    source: indicator.source,
    geography: geoLabel(geo, level),
    points,
    change,
  };
}
