/**
 * Location Opportunity Score (§5).
 *
 * Four factors, each measured against the national figure so the score means
 * "relative to the average American market" rather than an arbitrary curve.
 *
 * A deliberate design decision from §10: competition is never treated as bad
 * on its own. A crowded market where businesses earn well is a strong market.
 * So "headroom" (residents per business) is only one factor of four, and it
 * sits alongside market depth (what a business here actually takes in) —
 * which is high precisely in markets that support many competitors.
 */
import type { LocationProfile, NationalReference } from "./census/location";

export type FactorDirection = "positive" | "neutral" | "negative";

export type ScoreFactor = {
  key: string;
  label: string;
  /** 0–100, where 50 means "the national average". */
  subscore: number | null;
  direction: FactorDirection;
  /** What the number is, in plain language. */
  reading: string;
  weight: number;
};

export type LocationScore = {
  score: number | null;
  factors: ScoreFactor[];
  positives: string[];
  negatives: string[];
  /** How many factors had data. A score from one factor deserves less trust. */
  basis: number;
  confidence: "high" | "moderate" | "limited";
};

/**
 * Converts a local-to-national ratio into a 0–100 subscore where parity is 50.
 * Capped so a market twice the national average doesn't score 200 and swamp
 * every other factor.
 */
function ratioToScore(ratio: number): number {
  return Math.max(0, Math.min(100, 50 * Math.min(ratio, 2)));
}

function directionFor(subscore: number): FactorDirection {
  if (subscore >= 60) return "positive";
  if (subscore <= 40) return "negative";
  return "neutral";
}

const pctChange = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
const usd = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function scoreLocation(
  profile: LocationProfile,
  national: NationalReference,
): LocationScore {
  const factors: ScoreFactor[] = [];

  // 1. Spending power — local median income against the national median.
  const income = profile.medianIncome.value;
  if (income !== null && national.medianIncome) {
    const ratio = income / national.medianIncome;
    const subscore = ratioToScore(ratio);
    factors.push({
      key: "spending_power",
      label: "Spending power",
      subscore,
      direction: directionFor(subscore),
      reading: `Median household income is ${usd(income)}, ${pctChange(ratio - 1)} against the national median of ${usd(national.medianIncome)}.`,
      weight: 0.3,
    });
  }

  // 2. Market depth — what a typical business in this sector actually takes
  //    in here, against the national figure. This is where a busy market
  //    earns its keep.
  const localRev = profile.economics?.revenuePerEstablishment.value ?? null;
  const natRev = national.economics?.revenuePerEstablishment.value ?? null;
  if (localRev !== null && natRev) {
    const ratio = localRev / natRev;
    const subscore = ratioToScore(ratio);
    factors.push({
      key: "market_depth",
      label: "Revenue per business",
      subscore,
      direction: directionFor(subscore),
      reading: `A typical business in this sector takes in ${usd(localRev)} here, ${pctChange(ratio - 1)} against the national ${usd(natRev)}.`,
      weight: 0.3,
    });
  }

  // 3. Headroom — residents per business in the sector. More people per
  //    business means more room; fewer means a denser field.
  const localHeadroom = profile.residentsPerBusiness.value;
  const natHeadroom =
    national.population && national.economics?.establishments.value
      ? national.population / (national.economics.establishments.value as number)
      : null;
  if (localHeadroom !== null && natHeadroom) {
    const ratio = localHeadroom / natHeadroom;
    const subscore = ratioToScore(ratio);
    factors.push({
      key: "headroom",
      label: "Room in the market",
      subscore,
      direction: directionFor(subscore),
      reading: `${Math.round(localHeadroom).toLocaleString("en-US")} residents per business in this sector, against ${Math.round(natHeadroom).toLocaleString("en-US")} nationally — ${ratio >= 1 ? "a less crowded field" : "a denser field"}.`,
      weight: 0.2,
    });
  }

  // 4. Growth — is the market getting bigger? Scored against a 5% national
  //    five-year benchmark rather than a ratio, since growth can be negative.
  const growth = profile.populationGrowth.value;
  if (growth !== null) {
    const subscore = Math.max(0, Math.min(100, 50 + growth * 400));
    factors.push({
      key: "growth",
      label: "Population growth",
      subscore,
      direction: directionFor(subscore),
      reading: `Population changed ${pctChange(growth)} over five years.`,
      weight: 0.2,
    });
  }

  const usable = factors.filter((f) => f.subscore !== null);
  if (usable.length === 0) {
    return { score: null, factors, positives: [], negatives: [], basis: 0, confidence: "limited" };
  }

  const totalWeight = usable.reduce((sum, f) => sum + f.weight, 0);
  const score = Math.round(
    usable.reduce((sum, f) => sum + (f.subscore as number) * f.weight, 0) / totalWeight,
  );

  return {
    score,
    factors,
    positives: usable.filter((f) => f.direction === "positive").map((f) => f.reading),
    negatives: usable.filter((f) => f.direction === "negative").map((f) => f.reading),
    basis: usable.length,
    confidence: usable.length >= 4 ? "high" : usable.length >= 2 ? "moderate" : "limited",
  };
}
