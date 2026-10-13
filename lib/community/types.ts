/**
 * Community context: the conditions a business would operate in, beyond what
 * it sells and who its competitors are.
 *
 * Who lives in a place, how healthy they are, what the weather does and what
 * disasters have hit it are all published by federal agencies, and all of it
 * bears on whether a business works there. This layer gathers it; the pages
 * present it; lib/community/implications.ts turns it into questions an owner
 * or investor should ask — never into predictions about demand.
 */

export type Comparison = "higher" | "lower" | "similar" | null;

export type Unit = "percent" | "years" | "dollars" | "people" | "minutes" | "count" | "degreesF" | "inches";

export type Indicator = {
  key: string;
  label: string;
  value: number | null;
  unit: Unit;
  /** The national figure for the same measure, where one exists. */
  national: number | null;
  comparison: Comparison;
  source: string;
  vintage: string;
  /** How to read it — especially where the figure is modelled rather than counted. */
  note?: string;
};

export type IndicatorGroup = {
  key: string;
  label: string;
  blurb: string;
  indicators: Indicator[];
};

export type HazardSummary = {
  /** Federally declared disasters affecting this county, most common first. */
  types: { type: string; count: number; latestYear: number }[];
  total: number;
  sinceYear: number;
  source: string;
};

export type ClimateMonth = { month: number; avgTempF: number | null; precipIn: number | null };

export type ClimateSummary = {
  station: { id: string; name: string; state: string; distanceMiles: number };
  months: ClimateMonth[];
  warmest: { month: number; avgTempF: number } | null;
  coldest: { month: number; avgTempF: number } | null;
  wettest: { month: number; precipIn: number } | null;
  annualPrecipIn: number | null;
  source: string;
  vintage: string;
};

export type CommunityProfile = {
  geography: { label: string; countyFips: string; stateFips: string; lat: number; lon: number; displayName: string };
  population: number | null;
  people: IndicatorGroup[];
  health: IndicatorGroup[];
  hazards: HazardSummary | null;
  climate: ClimateSummary | null;
  /** Sections that couldn't be loaded, named so the page can say which. */
  unavailable: string[];
  sources: string[];
  limitations: string[];
};

/**
 * "Higher" or "lower" only where the gap is big enough to act on: at least a
 * tenth of the national figure, and at least half a point for a percentage.
 * Everything else reads as "similar", which is usually the honest answer.
 */
export function compare(value: number | null, national: number | null, unit: Unit): Comparison {
  if (value == null || national == null || national === 0) return null;
  const gap = value - national;
  const threshold = Math.max(Math.abs(national) * 0.1, unit === "percent" ? 0.5 : 0);
  if (Math.abs(gap) < threshold) return "similar";
  return gap > 0 ? "higher" : "lower";
}

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  // The Census uses large negative sentinels for withheld values.
  return Number.isFinite(n) && n > -666666666 ? n : null;
};
