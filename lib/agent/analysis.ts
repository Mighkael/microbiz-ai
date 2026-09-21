/**
 * The MicroBiz Agent's monitoring engine: Plan → Actual → Forecast → Risk →
 * Recommended action, for every area the owner has given it figures for.
 *
 * Pure arithmetic on the owner's own numbers, so every figure in an alert can
 * be traced and re-checked, and the same result appears on screen, in the
 * assistant's answers and in reports. The AI explains these results; it never
 * computes them.
 *
 * Methods, stated wherever they appear:
 *   - Plan to date: the owner's monthly planned revenue where entered;
 *     otherwise the annual target spread evenly across twelve months.
 *   - Forecast: year-to-date actual plus the recent average (the last three
 *     months entered) for every month still to come. A simple run-rate, not a
 *     prediction — it assumes the next months look like the last few.
 */
import type { AgentData, Obligation } from "./types";
import { MONTH_NAMES } from "./types";

export type Severity = "high" | "medium" | "low" | "good";
export type Area = "revenue" | "expenses" | "profit" | "cash" | "obligations";

export type Alert = {
  id: string;
  area: Area;
  severity: Severity;
  title: string;
  plan: string;
  actual: string;
  forecast: string;
  risk: string;
  action: string;
};

export type MonthRow = {
  month: number;
  name: string;
  planned: number | null;
  revenue: number | null;
  expenses: number | null;
  net: number | null;
  cash: number | null;
};

export type Analysis = {
  year: number;
  /** Index (0–11) of the latest month with revenue entered; -1 if none. */
  lastMonth: number;
  monthsEntered: number;
  rows: MonthRow[];
  ytd: { revenue: number; expenses: number | null; net: number | null; plannedRevenue: number | null };
  /** (actual − plan) ÷ plan, year to date. */
  revenueGap: number | null;
  planBasis: "monthly" | "even" | null;
  runRate: { revenue: number | null; net: number | null; months: number };
  forecast: { revenue: number | null; expenses: number | null; net: number | null };
  /** Monthly revenue needed from here on to hit the annual target. */
  requiredMonthly: number | null;
  latestCash: number | null;
  /** Months of cash left at the recent monthly loss; null when not losing money. */
  runwayMonths: number | null;
  upcoming: (Obligation & { daysAway: number })[];
  overdue: (Obligation & { daysAway: number })[];
  alerts: Alert[];
  methods: string[];
};

const RUN_RATE_MONTHS = 3;
const UPCOMING_DAYS = 30;

export const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (n: number) => `${Math.abs(n * 100).toFixed(0)}%`;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function daysBetween(fromISO: string, toISO: string) {
  const a = Date.UTC(+fromISO.slice(0, 4), +fromISO.slice(5, 7) - 1, +fromISO.slice(8, 10));
  const b = Date.UTC(+toISO.slice(0, 4), +toISO.slice(5, 7) - 1, +toISO.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

/**
 * The next federal estimated-tax date on or after `fromISO` (or strictly after
 * it, once the current one is paid). Calendar-year filers; a date on a weekend
 * or holiday moves to the next business day, which the UI tells the owner to
 * confirm on IRS.gov.
 */
export function nextEstimatedTaxDate(fromISO: string, strictlyAfter = false): string {
  const y = +fromISO.slice(0, 4);
  const dates = [`${y}-01-15`, `${y}-04-15`, `${y}-06-15`, `${y}-09-15`, `${y + 1}-01-15`];
  return dates.find((d) => (strictlyAfter ? d > fromISO : d >= fromISO))!;
}

/** Next due date for a recurring obligation once the current one is paid. */
export function nextDueDate(o: Obligation): string | null {
  if (o.recurrence === "estimated_tax") return nextEstimatedTaxDate(o.dueDate, true);
  const step = { monthly: 1, quarterly: 3, annual: 12, none: 0 }[o.recurrence];
  if (!step) return null;
  const y = +o.dueDate.slice(0, 4);
  const m = +o.dueDate.slice(5, 7) - 1 + step;
  const d = +o.dueDate.slice(8, 10);
  // Clamp to the month's last day (Jan 31 + 1 month → Feb 28/29).
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const date = new Date(Date.UTC(y, m, Math.min(d, last)));
  return date.toISOString().slice(0, 10);
}

export function analyze(data: AgentData, todayISO: string): Analysis {
  const { plan, months } = data;
  const rows: MonthRow[] = months.map((m, i) => ({
    month: i,
    name: MONTH_NAMES[i],
    planned: m.plannedRevenue ?? (plan.revenueTarget != null ? plan.revenueTarget / 12 : null),
    revenue: m.revenue,
    expenses: m.expenses,
    net: m.revenue != null && m.expenses != null ? m.revenue - m.expenses : null,
    cash: m.cash,
  }));

  const lastMonth = rows.reduce((last, r) => (r.revenue != null ? r.month : last), -1);
  const toDate = rows.slice(0, lastMonth + 1);
  const entered = toDate.filter((r) => r.revenue != null);

  const ytdRevenue = sum(entered.map((r) => r.revenue as number));
  const allExpenses = toDate.every((r) => r.revenue == null || r.expenses != null);
  const ytdExpenses = entered.length && allExpenses ? sum(entered.map((r) => r.expenses ?? 0)) : null;
  const ytdNet = ytdExpenses != null ? ytdRevenue - ytdExpenses : null;

  const monthlyPlanEntered = months.some((m) => m.plannedRevenue != null);
  const plannedToDate = toDate.length && toDate.every((r) => r.planned != null)
    ? sum(toDate.map((r) => r.planned as number))
    : null;
  const planBasis = plannedToDate == null ? null : monthlyPlanEntered ? "monthly" : "even";
  const revenueGap = plannedToDate ? (ytdRevenue - plannedToDate) / plannedToDate : null;

  // Run rate from the most recent months entered.
  const recent = entered.slice(-RUN_RATE_MONTHS);
  const runRevenue = recent.length ? sum(recent.map((r) => r.revenue as number)) / recent.length : null;
  const recentNet = recent.filter((r) => r.net != null);
  const runNet = recentNet.length === recent.length && recent.length
    ? sum(recentNet.map((r) => r.net as number)) / recentNet.length
    : null;

  const remaining = lastMonth >= 0 ? 11 - lastMonth : 12;
  const forecastRevenue = runRevenue != null ? ytdRevenue + runRevenue * remaining : null;
  const forecastNet = runNet != null && ytdNet != null ? ytdNet + runNet * remaining : null;
  const forecastExpenses = forecastRevenue != null && forecastNet != null ? forecastRevenue - forecastNet : null;

  const requiredMonthly = plan.revenueTarget != null && remaining > 0
    ? Math.max(0, (plan.revenueTarget - ytdRevenue) / remaining)
    : null;

  const latestCash = [...rows].reverse().find((r) => r.cash != null)?.cash ?? null;
  const runwayMonths = latestCash != null && runNet != null && runNet < 0 ? latestCash / -runNet : null;

  const open = data.obligations
    .filter((o) => !o.done)
    .map((o) => ({ ...o, daysAway: daysBetween(todayISO, o.dueDate) }))
    .sort((a, b) => a.daysAway - b.daysAway);
  const overdue = open.filter((o) => o.daysAway < 0);
  const upcoming = open.filter((o) => o.daysAway >= 0 && o.daysAway <= UPCOMING_DAYS);

  const lastName = lastMonth >= 0 ? MONTH_NAMES[lastMonth] : "";
  const alerts: Alert[] = [];

  /* Revenue ---------------------------------------------------------- */
  if (revenueGap != null && plannedToDate != null) {
    const behind = revenueGap < 0;
    const severity: Severity = revenueGap <= -0.15 ? "high" : revenueGap <= -0.05 ? "medium" : "good";
    const extra = requiredMonthly != null && runRevenue != null ? requiredMonthly - runRevenue : null;
    alerts.push({
      id: "revenue",
      area: "revenue",
      severity,
      title: severity === "good"
        ? (revenueGap > 0.05 ? `Revenue is ${pct(revenueGap)} ahead of plan` : "Revenue is on plan")
        : `Revenue is ${pct(revenueGap)} below plan`,
      plan: `${usd(plannedToDate)} planned through ${lastName}${plan.revenueTarget != null ? ` (annual target ${usd(plan.revenueTarget)})` : ""}.`,
      actual: `${usd(ytdRevenue)} actual through ${lastName} — ${behind ? usd(plannedToDate - ytdRevenue) + " short" : usd(ytdRevenue - plannedToDate) + " ahead"}.`,
      forecast: forecastRevenue != null
        ? `At the recent average of ${usd(runRevenue as number)} a month, the year ends near ${usd(forecastRevenue)}${plan.revenueTarget != null ? ` — ${forecastRevenue >= plan.revenueTarget ? "at or above" : `${usd(plan.revenueTarget - forecastRevenue)} short of`} target` : ""}.`
        : "Not enough months entered to forecast.",
      risk: severity === "good"
        ? "Low on current figures."
        : extra != null && extra > 0 && remaining > 0
          ? `Reaching the target now needs about ${usd(requiredMonthly as number)} a month for the remaining ${remaining} month${remaining === 1 ? "" : "s"} — ${usd(extra)} more a month than you're averaging (${pct(extra / (runRevenue as number))} higher).`
          : "The gap may widen if the recent pace continues.",
      action: severity === "good"
        ? "Keep entering monthly figures so a slowdown shows up early."
        : "Decide now whether to close the gap or reset the target. Look first at your best-selling products and best customers: a price review, a push on repeat business, or one new sales channel usually moves faster than trying everything.",
    });
  }

  /* Expenses --------------------------------------------------------- */
  if (plan.expenseBudget != null && ytdExpenses != null && lastMonth >= 0) {
    const budgetToDate = (plan.expenseBudget / 12) * (lastMonth + 1);
    const over = (ytdExpenses - budgetToDate) / budgetToDate;
    const severity: Severity = over >= 0.1 ? "high" : over >= 0.03 ? "medium" : "good";
    const forecastExp = forecastExpenses;
    alerts.push({
      id: "expenses",
      area: "expenses",
      severity,
      title: over > 0.03 ? `Spending is ${pct(over)} over budget` : "Spending is within budget",
      plan: `${usd(budgetToDate)} budgeted through ${lastName} (annual ${usd(plan.expenseBudget)}, spread evenly).`,
      actual: `${usd(ytdExpenses)} spent through ${lastName}.`,
      forecast: forecastExp != null ? `At the recent pace, the year's spending ends near ${usd(forecastExp)}.` : "Not enough months entered to forecast.",
      risk: over > 0.03 ? "Overspending comes straight out of profit and cash." : "Low on current figures.",
      action: over > 0.03
        ? "List last month's ten biggest costs. Renegotiate or cancel one this month, and check whether any overspend was a one-off."
        : "No action needed.",
    });
  }

  /* Profit ----------------------------------------------------------- */
  if (ytdNet != null && runNet != null) {
    const losing = runNet < 0;
    alerts.push({
      id: "profit",
      area: "profit",
      severity: losing ? (ytdNet < 0 ? "high" : "medium") : "good",
      title: losing ? "Recent months are running at a loss" : "The business is running at a profit",
      plan: plan.revenueTarget != null && plan.expenseBudget != null
        ? `Planned profit for the year: ${usd(plan.revenueTarget - plan.expenseBudget)}.`
        : "No profit target set (add a revenue target and expense budget).",
      actual: `${usd(Math.abs(ytdNet))} ${ytdNet >= 0 ? "profit" : "loss"} through ${lastName}; recent average ${usd(Math.abs(runNet))} a month ${runNet >= 0 ? "profit" : "loss"}.`,
      forecast: forecastNet != null ? `At the recent pace, the year ends near a ${usd(Math.abs(forecastNet))} ${forecastNet >= 0 ? "profit" : "loss"}.` : "Not enough months entered to forecast.",
      risk: losing ? "Each month at a loss draws down cash." : "Low on current figures.",
      action: losing
        ? "Work out your break-even: which costs are fixed, and how much more you'd need to sell each month to cover them. Then decide between raising prices, cutting a cost, or selling more."
        : "Consider setting part of the monthly profit aside as a cash reserve.",
    });
  }

  /* Cash ------------------------------------------------------------- */
  if (latestCash != null) {
    const floor = data.plan.cashFloor;
    const projected3 = runNet != null ? latestCash + runNet * 3 : null;
    const belowFloorNow = floor != null && latestCash < floor;
    const belowFloorSoon = floor != null && projected3 != null && projected3 < floor;
    const shortRunway = runwayMonths != null && runwayMonths < 3;
    // Losing money is never "steady", however long the cushion.
    const severity: Severity = belowFloorNow || shortRunway ? "high"
      : belowFloorSoon || (runwayMonths != null && runwayMonths < 6) ? "medium"
        : runwayMonths != null ? "low" : "good";
    alerts.push({
      id: "cash",
      area: "cash",
      severity,
      title: severity === "good" ? "Cash position looks steady"
        : severity === "low" ? `Cash is shrinking slowly — about ${Math.round(runwayMonths as number)} months left at the current rate`
        : runwayMonths != null ? `About ${runwayMonths.toFixed(1)} months of cash at the current rate`
          : belowFloorNow ? "Cash is below your minimum" : "Cash may fall below your minimum",
      plan: floor != null ? `You want to keep at least ${usd(floor)} in cash.` : "No minimum cash level set.",
      actual: `${usd(latestCash)} in cash at the last month entered.`,
      forecast: projected3 != null
        ? `At the recent monthly ${runNet! >= 0 ? "profit" : "loss"} of ${usd(Math.abs(runNet!))}, cash would be about ${usd(projected3)} in three months.`
        : "Enter expenses to project cash.",
      risk: belowFloorNow ? "You're already under the cushion you set."
        : belowFloorSoon ? "On the current path you'll dip under your cushion within three months."
          : shortRunway ? "Running out of cash is the most common reason small businesses close."
            : severity === "low" ? "Not urgent, but the cushion is being used up rather than built."
              : "Low on current figures.",
      action: severity === "good"
        ? "Keep an eye on large payments due in the next month (see Obligations)."
        : severity === "low"
          ? "Fix the monthly loss while there's time (see the profit alert) rather than waiting for cash to run low."
        : "Chase unpaid invoices, delay any purchase that can wait, and talk to your bank or a lender about a line of credit before you need it — terms are better when you're not in a hurry.",
    });
  }

  /* Obligations ------------------------------------------------------ */
  if (overdue.length) {
    alerts.push({
      id: "obligations_overdue",
      area: "obligations",
      severity: "high",
      title: `${overdue.length} obligation${overdue.length === 1 ? " is" : "s are"} overdue`,
      plan: overdue.map((o) => `${o.label} was due ${o.dueDate}`).join("; ") + ".",
      actual: "Not marked as done.",
      forecast: "Penalties, interest or a lapse in cover can build the longer it waits.",
      risk: "Late taxes, lapsed licenses or insurance can cost far more than the original amount.",
      action: "Deal with the oldest first. If you can't pay in full, contact the agency, lender or landlord now — most have payment plans for people who ask early.",
    });
  }
  if (upcoming.length) {
    const due = sum(upcoming.map((o) => o.amount ?? 0));
    const cashShort = latestCash != null && due > 0 && due > latestCash;
    alerts.push({
      id: "obligations_upcoming",
      area: "obligations",
      severity: cashShort ? "high" : upcoming.some((o) => o.daysAway <= 7) ? "medium" : "low",
      title: `${upcoming.length} obligation${upcoming.length === 1 ? "" : "s"} due in the next ${UPCOMING_DAYS} days`,
      plan: upcoming.map((o) => `${o.label} — ${o.dueDate}${o.amount != null ? `, ${usd(o.amount)}` : ""}`).join("; ") + ".",
      actual: due > 0 ? `${usd(due)} due in total${latestCash != null ? ` against ${usd(latestCash)} in cash` : ""}.` : "Amounts not entered.",
      forecast: cashShort ? "What's due is more than your last recorded cash." : "Covered by current cash on the figures entered.",
      risk: cashShort ? "You may not be able to pay everything on time." : "Low if paid on time.",
      action: cashShort
        ? "Prioritize taxes and anything with penalties, then contact the others about timing before the due date."
        : "Put the dates in your phone calendar with a reminder three days before.",
    });
  }

  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2, good: 3 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);

  const methods = [
    planBasis === "even"
      ? "Plan to date spreads your annual target evenly across twelve months. If your business is seasonal, enter a planned revenue for each month for a fairer comparison."
      : "Plan to date uses the planned revenue you entered for each month.",
    `Forecasts assume the rest of the year looks like your last ${Math.min(RUN_RATE_MONTHS, entered.length) || RUN_RATE_MONTHS} month${entered.length === 1 ? "" : "s"}. They are a simple projection of your own figures, not a prediction.`,
  ];

  return {
    year: data.plan.year,
    lastMonth,
    monthsEntered: entered.length,
    rows,
    ytd: { revenue: ytdRevenue, expenses: ytdExpenses, net: ytdNet, plannedRevenue: plannedToDate },
    revenueGap,
    planBasis,
    runRate: { revenue: runRevenue, net: runNet, months: recent.length },
    forecast: { revenue: forecastRevenue, expenses: forecastExpenses, net: forecastNet },
    requiredMonthly,
    latestCash,
    runwayMonths,
    upcoming,
    overdue,
    alerts,
    methods,
  };
}
