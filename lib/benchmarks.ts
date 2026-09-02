/**
 * Compares a business against real market figures — "where you really stand".
 *
 * Every comparison here is grounded in published Census data. Deliberately
 * absent: profit margin. No free federal source publishes profit by sector
 * and geography, so the margin benchmark in the current app is an estimate,
 * and this module will not dress an estimate up as a measurement.
 */
import type { SectorEconomics } from "./census/economic";
import type { DataPoint } from "./census/types";

export type ComparisonVerdict = "well_above" | "above" | "typical" | "below" | "well_below";

export type Comparison = {
  key: string;
  label: string;
  /** What the business reported (or what we derived from its inputs). */
  yours: number | null;
  /** The market figure it's measured against. */
  benchmark: DataPoint;
  /** yours / benchmark. 1.0 means exactly typical. */
  ratio: number | null;
  verdict: ComparisonVerdict | null;
  /** Plain-language reading, written for a non-analyst. */
  reading: string;
  format: "currency" | "number";
};

export type BenchmarkInput = {
  annualRevenue: number;
  employees: number;
};

function verdictFor(ratio: number): ComparisonVerdict {
  if (ratio >= 1.5) return "well_above";
  if (ratio >= 1.1) return "above";
  if (ratio > 0.9) return "typical";
  if (ratio > 0.5) return "below";
  return "well_below";
}

const pct = (r: number) => `${Math.round(r * 100)}%`;

function compare(
  key: string,
  label: string,
  yours: number | null,
  benchmark: DataPoint,
  format: "currency" | "number",
  phrasing: (verdict: ComparisonVerdict, ratio: number) => string,
): Comparison {
  const b = benchmark.value;
  const canCompare = yours !== null && yours > 0 && b !== null && b > 0;
  const ratio = canCompare ? yours / (b as number) : null;
  const verdict = ratio === null ? null : verdictFor(ratio);

  let reading: string;
  if (b === null) {
    reading = benchmark.note ?? "No market figure published for this area and sector.";
  } else if (yours === null || yours <= 0) {
    reading = "Add this figure to your assessment to see how you compare.";
  } else {
    reading = phrasing(verdict as ComparisonVerdict, ratio as number);
  }

  return { key, label, yours, benchmark, ratio, verdict, reading, format };
}

/**
 * Phrases the comparison geography so the copy reads naturally at every
 * level — "nationwide" rather than "in United States", and never "locally"
 * when the user is comparing against the whole country.
 */
function wherePhrase(market: SectorEconomics): string {
  if (market.level === "us") return "nationwide";
  return `in ${market.geography}`;
}

export function buildComparisons(
  input: BenchmarkInput,
  market: SectorEconomics,
): Comparison[] {
  const revenuePerEmployee =
    input.employees > 0 && input.annualRevenue > 0 ? input.annualRevenue / input.employees : null;

  const where = wherePhrase(market);

  return [
    compare(
      "revenue",
      "Annual revenue",
      input.annualRevenue > 0 ? input.annualRevenue : null,
      market.revenuePerEstablishment,
      "currency",
      (v, r) =>
        v === "typical"
          ? `About the same as a typical business in your sector ${where}.`
          : `You're at ${pct(r)} of what a typical business in your sector takes in ${where}.`,
    ),
    compare(
      "revenuePerEmployee",
      "Revenue per employee",
      revenuePerEmployee,
      market.revenuePerEmployee,
      "currency",
      (v, r) =>
        v === "typical"
          ? `Each of your people generates about what the sector average does ${where}.`
          : r >= 1
            ? `Each of your people generates ${pct(r)} of the sector average ${where} — you're getting more out of a smaller team.`
            : `Each of your people generates ${pct(r)} of the sector average ${where}.`,
    ),
    compare(
      "size",
      "Team size",
      input.employees > 0 ? input.employees : null,
      market.employeesPerEstablishment,
      "number",
      (v, r) =>
        v === "typical"
          ? `You're about the size of a typical business in your sector ${where}.`
          : r >= 1
            ? `You employ ${pct(r)} of what a typical business in your sector does ${where} — you're larger than average.`
            : `You employ ${pct(r)} of what a typical business in your sector does ${where} — you're smaller than average.`,
    ),
  ];
}

/**
 * A 0–100 position score built only from comparisons we could actually make.
 * Returns null when no benchmark was available, rather than inventing a
 * number from nothing.
 */
export function positionScore(comparisons: Comparison[]): { score: number; basis: number } | null {
  const usable = comparisons.filter((c) => c.ratio !== null);
  if (usable.length === 0) return null;

  // Each ratio contributes on a curve where "typical" (1.0) sits at 50 and
  // 2x or better tops out — being twice the average shouldn't score 200.
  const points = usable.map((c) => {
    const r = c.ratio as number;
    const scaled = 50 * Math.min(r, 2);
    return Math.max(5, Math.min(100, scaled));
  });

  const score = Math.round(points.reduce((a, b) => a + b, 0) / points.length);
  return { score, basis: usable.length };
}
