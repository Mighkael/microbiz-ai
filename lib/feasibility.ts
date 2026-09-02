/**
 * Feasibility & Viability checks (§6).
 *
 * The honest framing this module holds to: it does not predict whether a
 * business will succeed. It tests the user's own assumptions against what
 * the chosen market demonstrably supports, and says where those assumptions
 * sit relative to businesses already operating there.
 *
 * What no free federal source publishes, and therefore what we never claim:
 * startup costs, rent, profit margins, or time to break even. Payroll is the
 * one major cost the Economic Census does publish, so payroll is the one we
 * model — narrowly, and labelled as an estimate.
 */
import type { LocationProfile, NationalReference } from "./census/location";
import type { LocationScore } from "./locationScore";

export type CheckStatus = "strong" | "workable" | "stretch" | "unknown";

export type FeasibilityCheck = {
  key: string;
  label: string;
  status: CheckStatus;
  headline: string;
  detail: string;
  /** Where the comparison figure came from. */
  source?: string;
};

export type FeasibilityPlan = {
  expectedRevenue: number;
  employees: number;
  startupCapital: number;
};

export type FeasibilityResult = {
  checks: FeasibilityCheck[];
  /** Payroll modelled from local sector wages — an estimate, not a quote. */
  estimatedAnnualPayroll: number | null;
  marketScore: number | null;
  /** Overall reading, derived only from checks that had data. */
  outlook: "encouraging" | "mixed" | "challenging" | "insufficient_data";
  summaryFacts: string[];
};

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function assessFeasibility(
  plan: FeasibilityPlan,
  profile: LocationProfile,
  national: NationalReference,
  score: LocationScore,
): FeasibilityResult {
  const checks: FeasibilityCheck[] = [];
  const facts: string[] = [];

  const econ = profile.economics;
  const localRevPerBiz = econ?.revenuePerEstablishment.value ?? null;
  const localWage = econ?.averageWage.value ?? null;
  const localPayrollShare = econ?.payrollShareOfRevenue.value ?? null;
  const where = profile.geography.label;
  const sectorName = profile.sector.label.toLowerCase();
  const ecSource = `US Census Bureau — Economic Census 2022 · ${where}`;

  // 1. How does the revenue expectation compare to what businesses here take in?
  //
  //    Note this is a mean, not a median — the Economic Census publishes
  //    sector totals, not distributions. In sectors with a few very large
  //    establishments (car dealerships in retail, say) the mean sits far
  //    above the typical small operator, so a low ratio is described rather
  //    than judged: being small is not the same as being unviable.
  if (plan.expectedRevenue > 0 && localRevPerBiz) {
    const ratio = plan.expectedRevenue / localRevPerBiz;
    const meanCaveat = "This is an average across all businesses in the sector, including large establishments, so it sits above what a typical small operator takes in.";

    let status: CheckStatus;
    let headline: string;
    let detail: string;

    if (ratio > 1.75) {
      status = "stretch";
      headline = "Well above what this market typically supports";
      detail = `You expect ${usd(plan.expectedRevenue)} — ${pct(ratio)} of the ${usd(localRevPerBiz)} average for ${sectorName} businesses in ${where}. You would need to substantially out-earn the businesses already there.`;
    } else if (ratio >= 0.5) {
      status = "strong";
      headline = "Within the range this market supports";
      detail = `You expect ${usd(plan.expectedRevenue)}, against an average of ${usd(localRevPerBiz)} for ${sectorName} businesses in ${where} — ${pct(ratio)} of that.`;
    } else {
      status = "workable";
      headline = "At the small end of this market";
      detail = `You expect ${usd(plan.expectedRevenue)}, which is ${pct(ratio)} of the ${usd(localRevPerBiz)} average for ${sectorName} businesses in ${where}. ${meanCaveat} A smaller operation can still work — but check your costs against the wage figures below rather than against that average.`;
    }

    checks.push({ key: "revenue_realism", label: "Revenue expectation", status, headline, detail, source: ecSource });
    facts.push(
      `Expected revenue ${usd(plan.expectedRevenue)} vs local sector average ${usd(localRevPerBiz)} (${pct(ratio)}). The average includes large establishments and is not a median.`,
    );
  } else {
    checks.push({
      key: "revenue_realism",
      label: "Revenue expectation",
      status: "unknown",
      headline: "No local revenue figure published",
      detail: `The Economic Census does not publish revenue for ${sectorName} in ${where}, so there is nothing reliable to measure your expectation against.`,
    });
  }

  // 2. Payroll — the one major cost with a published local figure.
  const estimatedAnnualPayroll =
    localWage !== null && plan.employees > 0 ? localWage * plan.employees : null;

  if (estimatedAnnualPayroll !== null && plan.expectedRevenue > 0) {
    const shareOfRevenue = estimatedAnnualPayroll / plan.expectedRevenue;
    const comparison = localPayrollShare;
    const status: CheckStatus =
      comparison === null
        ? "unknown"
        : shareOfRevenue <= comparison * 1.1
          ? "strong"
          : shareOfRevenue <= comparison * 1.4
            ? "workable"
            : "stretch";

    checks.push({
      key: "payroll",
      label: "Payroll load",
      status,
      headline:
        comparison === null
          ? `Roughly ${usd(estimatedAnnualPayroll)} a year in wages`
          : shareOfRevenue <= comparison * 1.1
            ? "Wage load in line with the sector"
            : "Wages would take a larger share than is typical",
      detail:
        comparison === null
          ? `At local ${sectorName} wages (${usd(localWage as number)} per employee), ${plan.employees} staff costs about ${usd(estimatedAnnualPayroll)} a year before any other expense.`
          : `${plan.employees} staff at local sector wages is about ${usd(estimatedAnnualPayroll)} a year — ${pct(shareOfRevenue)} of your expected revenue. Businesses in this sector here spend ${pct(comparison)} of revenue on payroll.`,
      source: ecSource,
    });
    facts.push(
      `Estimated payroll for ${plan.employees} staff: ${usd(estimatedAnnualPayroll)}/yr (${pct(shareOfRevenue)} of expected revenue; sector norm ${comparison === null ? "n/a" : pct(comparison)}).`,
    );
  }

  // 3. Capital, expressed only as months of payroll it would cover. Deliberately
  //    not "runway" — we have no data on rent, equipment or inventory.
  if (plan.startupCapital > 0 && estimatedAnnualPayroll !== null && estimatedAnnualPayroll > 0) {
    const months = plan.startupCapital / (estimatedAnnualPayroll / 12);
    const status: CheckStatus = months >= 6 ? "strong" : months >= 3 ? "workable" : "stretch";
    checks.push({
      key: "capital",
      label: "Starting capital",
      status,
      headline: `Covers about ${months.toFixed(1)} months of wages`,
      detail: `${usd(plan.startupCapital)} against an estimated ${usd(estimatedAnnualPayroll / 12)} a month in wages. This counts wages only — rent, equipment, inventory, licences and stock are not included, because no free federal source publishes those by sector and area.`,
      source: ecSource,
    });
    facts.push(`Starting capital ${usd(plan.startupCapital)} covers ~${months.toFixed(1)} months of estimated wages.`);
  }

  // 4. The market itself, from the Phase 4 opportunity score.
  if (score.score !== null) {
    const status: CheckStatus = score.score >= 60 ? "strong" : score.score >= 45 ? "workable" : "stretch";
    checks.push({
      key: "market",
      label: "Market conditions",
      status,
      headline: `Opportunity score ${score.score} of 100`,
      detail: `Measured against the national average on spending power, what businesses here earn, room in the market and population growth. ${score.positives[0] ?? score.negatives[0] ?? ""}`.trim(),
      source: `US Census Bureau — ACS and Economic Census · ${where}`,
    });
    facts.push(`Market opportunity score ${score.score}/100 (${score.confidence} confidence).`);
  }

  const pop = profile.population.value;
  if (pop !== null) facts.push(`${where} population ${pop.toLocaleString("en-US")}.`);
  const growth = profile.populationGrowth.value;
  if (growth !== null) facts.push(`Population change over five years: ${growth >= 0 ? "+" : ""}${(growth * 100).toFixed(1)}%.`);
  const estab = econ?.establishments.value;
  if (estab != null) facts.push(`${estab.toLocaleString("en-US")} ${sectorName} businesses already operating in ${where}.`);

  const scored = checks.filter((c) => c.status !== "unknown");
  let outlook: FeasibilityResult["outlook"] = "insufficient_data";
  if (scored.length > 0) {
    const stretches = scored.filter((c) => c.status === "stretch").length;
    const strongs = scored.filter((c) => c.status === "strong").length;
    outlook = stretches === 0 && strongs >= scored.length / 2 ? "encouraging" : stretches >= 2 ? "challenging" : "mixed";
  }

  return {
    checks,
    estimatedAnnualPayroll,
    marketScore: score.score,
    outlook,
    summaryFacts: facts,
  };
}
