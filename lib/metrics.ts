// lib/metrics.ts
// Pure financial calculations — no I/O, fully unit-testable.
// Used by the dashboard API, the snapshot job, and the AI advisor context.

export interface MonthlyFinancial {
  period: string;        // '2026-08-01'
  revenue: number;
  cogs: number;          // variable costs
  opex: number;          // fixed-ish operating costs
  payroll: number;
  cash_balance: number | null;
  debt_payments: number;
}

export interface BusinessProfile {
  industry: string;
  employees: number;
  founded_year: number | null;
}

export const INDUSTRY_BENCHMARKS: Record<string, { margin: number; growth: number }> = {
  retail: { margin: 0.05, growth: 0.03 },
  restaurant: { margin: 0.06, growth: 0.04 },
  professional_services: { margin: 0.18, growth: 0.05 },
  construction: { margin: 0.08, growth: 0.04 },
  healthcare: { margin: 0.12, growth: 0.06 },
  ecommerce: { margin: 0.10, growth: 0.08 },
  manufacturing: { margin: 0.09, growth: 0.03 },
  technology: { margin: 0.20, growth: 0.12 },
  logistics: { margin: 0.07, growth: 0.04 },
  personal_services: { margin: 0.11, growth: 0.05 },
  other: { margin: 0.10, growth: 0.04 },
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);

export function computeMetrics(profile: BusinessProfile, months: MonthlyFinancial[]) {
  // Use trailing 12 months (or whatever exists), newest last.
  const m = [...months].sort((a, b) => a.period.localeCompare(b.period)).slice(-12);
  const bench = INDUSTRY_BENCHMARKS[profile.industry] ?? INDUSTRY_BENCHMARKS.other;

  const revenue = sum(m.map((x) => x.revenue));
  const totalExpenses = sum(m.map((x) => x.cogs + x.opex + x.payroll + x.debt_payments));
  const variableCosts = sum(m.map((x) => x.cogs));
  const fixedCosts = totalExpenses - variableCosts;

  const profit = revenue - totalExpenses;
  const netMargin = revenue > 0 ? profit / revenue : 0;

  const monthlyRevenue = avg(m.map((x) => x.revenue));
  const monthlyExpenses = avg(m.map((x) => x.cogs + x.opex + x.payroll + x.debt_payments));
  const monthlyCashFlow = monthlyRevenue - monthlyExpenses;

  const cmRatio = revenue > 0 ? 1 - variableCosts / revenue : 0;
  const breakEvenRevenue = cmRatio > 0 ? fixedCosts / cmRatio : null;

  const latestCash = [...m].reverse().find((x) => x.cash_balance != null)?.cash_balance ?? 0;
  const runwayMonths =
    monthlyCashFlow >= 0 ? null : latestCash / Math.abs(monthlyCashFlow); // null = self-sustaining

  // Trend: last 3 months vs prior 3 months
  const last3 = avg(m.slice(-3).map((x) => x.revenue));
  const prior3 = avg(m.slice(-6, -3).map((x) => x.revenue));
  const revenueTrend = prior3 > 0 ? (last3 - prior3) / prior3 : 0;

  const businessAge = profile.founded_year
    ? new Date().getFullYear() - profile.founded_year
    : 0;

  // Health score: same weights as the prototype, tuned on real monthly data.
  let score = 50;
  score += clamp((netMargin - bench.margin) * 200, -20, 20);
  score += monthlyCashFlow > 0 ? 12 : -12;
  score += Math.min(10, businessAge * 2);
  score += latestCash > monthlyExpenses * 3 ? 8 : latestCash > monthlyExpenses ? 3 : -8;
  score += clamp(revenueTrend * 50, -8, 8);
  const healthScore = Math.round(clamp(score, 5, 98));

  const creditChecks = [
    profit > 0,
    businessAge >= 2,
    latestCash >= monthlyExpenses * 3,
    netMargin >= bench.margin,
    profit > revenue * 0.1,
  ];

  return {
    revenue, totalExpenses, profit, netMargin,
    monthlyRevenue, monthlyExpenses, monthlyCashFlow,
    fixedCosts, variableCosts, cmRatio, breakEvenRevenue,
    latestCash, runwayMonths, revenueTrend, businessAge,
    healthScore,
    creditReadiness: creditChecks.filter(Boolean).length,
    benchmark: bench,
    monthsOfData: m.length,
  };
}

export function stressTest(
  metrics: ReturnType<typeof computeMetrics>,
  revDropPct: number,
  expRisePct: number,
) {
  const rev = metrics.monthlyRevenue * (1 - revDropPct / 100);
  const exp = metrics.monthlyExpenses * (1 + expRisePct / 100);
  const cash = rev - exp;
  return {
    stressedMonthlyCashFlow: cash,
    stressedRunwayMonths: cash >= 0 ? null : metrics.latestCash / Math.abs(cash),
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
