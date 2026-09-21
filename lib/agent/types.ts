/**
 * MicroBiz Agent — the owner's plan, what is actually happening, and what the
 * agent is allowed to see.
 *
 * All of this lives in the owner's browser. Nothing here is sent anywhere until
 * the owner uses the assistant, a briefing or a report, and then only the
 * categories they have switched on in `permissions`.
 */

export type AssistantRole = "executive" | "financial" | "compliance" | "strategy";

export const ROLES: { key: AssistantRole; label: string; blurb: string; starters: string[] }[] = [
  {
    key: "executive", label: "Executive",
    blurb: "A chief of staff: what matters most this week across money, deadlines and strategy.",
    starters: ["What needs my attention this week?", "Give me a one-page status of the business.", "Where am I furthest from my plan?"],
  },
  {
    key: "financial", label: "Financial",
    blurb: "Revenue, expenses, profit, cash and forecast against your plan.",
    starters: ["Am I on track to hit my revenue goal?", "How long could my cash last if sales slip?", "What should I fix first to improve cash flow?"],
  },
  {
    key: "compliance", label: "Compliance & Obligations",
    blurb: "Taxes, licenses, insurance, loan payments and other deadlines — so nothing lapses.",
    starters: ["What is due in the next 30 days?", "Which obligations could hurt cash flow soon?", "Help me prepare for my next filing."],
  },
  {
    key: "strategy", label: "Strategy & Operations",
    blurb: "How to close the gap to plan, run more efficiently and put AI to work.",
    starters: ["How could I close my revenue gap?", "Where could AI save me the most time?", "What should I change in operations this quarter?"],
  },
];

export const roleLabel = (r: AssistantRole) => ROLES.find((x) => x.key === r)!.label;

export type Plan = {
  year: number;
  revenueTarget: number | null;
  expenseBudget: number | null;
  /** The lowest cash balance the owner is comfortable with. */
  cashFloor: number | null;
};

/** One month, January = index 0. `null` means "not entered", never zero. */
export type MonthEntry = {
  plannedRevenue: number | null;
  revenue: number | null;
  expenses: number | null;
  cash: number | null;
};

export type ObligationKind = "tax" | "license" | "insurance" | "loan" | "lease" | "payroll" | "other";
/**
 * "estimated_tax" follows the federal estimated-tax calendar (Apr 15, Jun 15,
 * Sep 15, Jan 15), which is not evenly quarterly — rolling it forward three
 * months would produce dates the IRS never uses.
 */
export type Recurrence = "none" | "monthly" | "quarterly" | "annual" | "estimated_tax";

export type Obligation = {
  id: string;
  label: string;
  kind: ObligationKind;
  /** YYYY-MM-DD */
  dueDate: string;
  amount: number | null;
  recurrence: Recurrence;
  done: boolean;
};

export const OBLIGATION_KINDS: { key: ObligationKind; label: string }[] = [
  { key: "tax", label: "Tax" },
  { key: "license", label: "License / permit" },
  { key: "insurance", label: "Insurance" },
  { key: "loan", label: "Loan payment" },
  { key: "lease", label: "Rent / lease" },
  { key: "payroll", label: "Payroll" },
  { key: "other", label: "Other" },
];

/** What the assistant may see. Profile defaults on (it already powers Ask); the rest are opt-in. */
export type SharePermissions = {
  profile: boolean;
  financials: boolean;
  obligations: boolean;
};

export type AgentData = {
  plan: Plan;
  months: MonthEntry[];
  obligations: Obligation[];
  permissions: SharePermissions;
  updatedAt: string | null;
};

export const emptyMonth = (): MonthEntry => ({ plannedRevenue: null, revenue: null, expenses: null, cash: null });

export function emptyAgentData(year: number): AgentData {
  return {
    plan: { year, revenueTarget: null, expenseBudget: null, cashFloor: null },
    months: Array.from({ length: 12 }, emptyMonth),
    obligations: [],
    permissions: { profile: true, financials: false, obligations: false },
    updatedAt: null,
  };
}

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));

/**
 * What may be sent to the assistant: strips anything the owner has not
 * permitted. Applied in the browser before sending and again on the server.
 */
export function redactForAssistant(data: AgentData): AgentData {
  const { permissions } = data;
  const blank = emptyAgentData(data.plan.year);
  return {
    ...data,
    plan: permissions.financials ? data.plan : blank.plan,
    months: permissions.financials ? data.months : blank.months,
    obligations: permissions.obligations ? data.obligations : [],
  };
}

/** Defensive: the shape of stored or received data can't be trusted. */
export function sanitizeAgentData(raw: unknown, fallbackYear: number): AgentData {
  const base = emptyAgentData(fallbackYear);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

  const planRaw = (r.plan && typeof r.plan === "object" ? r.plan : {}) as Record<string, unknown>;
  const plan: Plan = {
    year: typeof planRaw.year === "number" && planRaw.year > 1990 && planRaw.year < 2100 ? Math.round(planRaw.year) : fallbackYear,
    revenueTarget: num(planRaw.revenueTarget),
    expenseBudget: num(planRaw.expenseBudget),
    cashFloor: num(planRaw.cashFloor),
  };

  const monthsRaw = Array.isArray(r.months) ? r.months : [];
  const months: MonthEntry[] = Array.from({ length: 12 }, (_, i) => {
    const m = (monthsRaw[i] && typeof monthsRaw[i] === "object" ? monthsRaw[i] : {}) as Record<string, unknown>;
    return { plannedRevenue: num(m.plannedRevenue), revenue: num(m.revenue), expenses: num(m.expenses), cash: num(m.cash) };
  });

  const kinds = OBLIGATION_KINDS.map((k) => k.key as string);
  const recs = ["none", "monthly", "quarterly", "annual", "estimated_tax"];
  const obligations: Obligation[] = (Array.isArray(r.obligations) ? r.obligations : [])
    .slice(0, 100)
    .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
    .map((o, i) => ({
      id: typeof o.id === "string" ? o.id.slice(0, 40) : `o${i}`,
      label: typeof o.label === "string" ? o.label.slice(0, 120) : "Obligation",
      kind: (kinds.includes(String(o.kind)) ? o.kind : "other") as ObligationKind,
      dueDate: typeof o.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.dueDate) ? o.dueDate : "",
      amount: num(o.amount),
      recurrence: (recs.includes(String(o.recurrence)) ? o.recurrence : "none") as Recurrence,
      done: o.done === true,
    }))
    .filter((o) => o.dueDate);

  const p = (r.permissions && typeof r.permissions === "object" ? r.permissions : {}) as Record<string, unknown>;
  return {
    plan, months, obligations,
    permissions: {
      profile: p.profile !== false,
      financials: p.financials === true,
      obligations: p.obligations === true,
    },
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : null,
  };
}
