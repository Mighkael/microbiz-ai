/**
 * What-if scenario modelling (§4).
 *
 * Everything here is arithmetic on the owner's own figures — no external data,
 * no prediction. A scenario says "if these assumptions held, the numbers would
 * look like this", which is a very different claim from "this will happen",
 * and the UI is required to say so.
 */
import type { Profile } from "./data";
import { INDUSTRIES } from "./data";

export type Levers = {
  /** Change in units sold / customer volume. */
  volumeChangePct: number;
  /** Change in average price. Compounds with volume on revenue. */
  priceChangePct: number;
  /** Change in operating expenses, excluding the staffing change below. */
  expenseChangePct: number;
  /** Staff added (positive) or cut (negative). */
  employeeDelta: number;
  /** Annual cost of one employee — wages plus on-costs. */
  costPerEmployee: number;
  /** New recurring monthly cost: marketing, transport, a pricier supplier. */
  monthlyAddedCost: number;
};

export const NO_CHANGE: Levers = {
  volumeChangePct: 0,
  priceChangePct: 0,
  expenseChangePct: 0,
  employeeDelta: 0,
  costPerEmployee: 0,
  monthlyAddedCost: 0,
};

export type ScenarioOutcome = {
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  monthlyCashFlow: number;
  breakEven: number | null;
  employees: number;
  /** Months of cash at this burn. Null when cash flow is positive. */
  runwayMonths: number | null;
};

/**
 * Applies levers to the base figures.
 *
 * Revenue moves with volume and price together: selling 10% more at 5% higher
 * prices is 1.10 × 1.05, not 1.15.
 */
export function runScenario(profile: Profile, levers: Levers): ScenarioOutcome {
  const baseRevenue = +profile.revenue || 0;
  const baseExpenses = +profile.expenses || 0;
  const cash = +profile.cash || 0;
  const baseEmployees = +profile.employees || 0;

  const revenue =
    baseRevenue * (1 + levers.volumeChangePct / 100) * (1 + levers.priceChangePct / 100);

  const staffingCost = levers.employeeDelta * levers.costPerEmployee;
  const addedCost = levers.monthlyAddedCost * 12;
  const expenses = baseExpenses * (1 + levers.expenseChangePct / 100) + staffingCost + addedCost;

  const profit = revenue - expenses;
  const margin = revenue > 0 ? profit / revenue : 0;
  const monthlyCashFlow = (revenue - expenses) / 12;
  const employees = Math.max(0, baseEmployees + levers.employeeDelta);

  // Break-even uses the industry's variable-cost ratio, the same split the
  // dashboard already uses, so the two never disagree.
  const bench = INDUSTRIES[profile.industry] ?? INDUSTRIES.Other;
  const variableCosts = expenses * bench.varRatio;
  const fixedCosts = expenses - variableCosts;
  const contributionRatio = revenue > 0 ? 1 - variableCosts / revenue : 0;
  const breakEven = contributionRatio > 0 ? fixedCosts / contributionRatio : null;

  const runwayMonths = monthlyCashFlow >= 0 ? null : cash / Math.abs(monthlyCashFlow);

  return { revenue, expenses, profit, margin, monthlyCashFlow, breakEven, employees, runwayMonths };
}

export type ScenarioDelta = {
  key: keyof ScenarioOutcome;
  label: string;
  base: number | null;
  scenario: number | null;
  /** Absolute change. Null when either side is unavailable. */
  change: number | null;
  format: "currency" | "percent" | "number" | "months";
  /** Whether an increase is a good thing for this measure. */
  higherIsBetter: boolean;
};

export function compareOutcomes(base: ScenarioOutcome, scenario: ScenarioOutcome): ScenarioDelta[] {
  const rows: Array<Omit<ScenarioDelta, "change">> = [
    { key: "revenue", label: "Revenue", base: base.revenue, scenario: scenario.revenue, format: "currency", higherIsBetter: true },
    { key: "expenses", label: "Expenses", base: base.expenses, scenario: scenario.expenses, format: "currency", higherIsBetter: false },
    { key: "profit", label: "Profit", base: base.profit, scenario: scenario.profit, format: "currency", higherIsBetter: true },
    { key: "margin", label: "Operating margin", base: base.margin, scenario: scenario.margin, format: "percent", higherIsBetter: true },
    { key: "monthlyCashFlow", label: "Monthly cash flow", base: base.monthlyCashFlow, scenario: scenario.monthlyCashFlow, format: "currency", higherIsBetter: true },
    { key: "breakEven", label: "Break-even revenue", base: base.breakEven, scenario: scenario.breakEven, format: "currency", higherIsBetter: false },
    { key: "employees", label: "Employees", base: base.employees, scenario: scenario.employees, format: "number", higherIsBetter: true },
  ];

  return rows.map((r) => ({
    ...r,
    change: r.base === null || r.scenario === null ? null : r.scenario - r.base,
  }));
}
