/**
 * What each MicroBiz Agent assistant is told — server-only.
 *
 * The briefing hands the model the monitoring engine's results verbatim, so
 * the assistant explains the same figures the owner sees on screen instead of
 * re-deriving (and possibly contradicting) them.
 */
import type { AgentData, AssistantRole } from "./types";
import { MONTH_NAMES, OBLIGATION_KINDS } from "./types";
import type { Analysis } from "./analysis";
import { usd } from "./analysis";

export type ProfileSummary = {
  industry?: string;
  location?: string;
  employees?: string;
  age?: string;
  revenue?: string;
  expenses?: string;
  cash?: string;
  marketing?: string;
  operations?: string;
};

const COMMON = [
  "You are the MicroBiz Agent, an assistant inside MicroBiz AI that helps a small-business owner in the United States",
  "run their business: comparing what they planned with what is actually happening, spotting risks early, and",
  "recommending practical next steps. Many owners run very small businesses in under-served neighborhoods.",
  "",
  "How to work:",
  "- The owner's figures, plan and obligations are below, together with MONITORING RESULTS calculated by MicroBiz AI.",
  "  Use those results as given. Do not recalculate them a different way; if you do extra arithmetic, show it.",
  "- When you discuss a gap or a risk, follow this order: Plan, Actual, Forecast, Risk, Recommended action.",
  "- Be proactive: if a HIGH alert is relevant to the question, raise it even if the owner didn't ask.",
  "- Recommend specific actions the owner can take this week, not general advice.",
  "- Keep answers short and plain, in American English. Use short headings or bullets only when they help.",
  "- If an answer needs data you don't have, say what's missing rather than guessing. Only send the owner to fields",
  "  that exist: the Plan & actuals tab holds an annual revenue target, expense budget and minimum cash, plus each",
  "  month's planned revenue, revenue, expenses and month-end cash; the Obligations tab holds deadlines and payments;",
  "  the Sharing tab controls what you can see. For anything else (cost breakdowns, prices, customer numbers), ask",
  "  the owner to tell you in the chat.",
  "- You have tools that query real US Census data about markets and sectors. Use them for questions about a place,",
  "  a market or competitors, and cite the source. Never invent a statistic.",
  "- You are not a licensed accountant, lawyer, tax adviser or financial adviser. Say so when a decision needs one.",
].join("\n");

const ROLE_FOCUS: Record<AssistantRole, string> = {
  executive: [
    "ROLE: Executive assistant — the owner's chief of staff.",
    "Look across everything: revenue, costs, cash, deadlines and strategy. Lead with the two or three things that",
    "matter most right now and why, in priority order. When asked for a status or briefing, give a one-screen summary:",
    "what's going well, what needs attention, and what to do this week.",
  ].join("\n"),
  financial: [
    "ROLE: Financial assistant.",
    "Focus on revenue, expenses, profit, cash and the forecast against the plan. Show the arithmetic in plain terms",
    "(\"$X a month for Y months\"). Help with pricing, break-even, cash flow timing and whether a target is realistic.",
    "Be clear about the difference between the owner's reported figures, calculations and your own judgement.",
  ].join("\n"),
  compliance: [
    "ROLE: Compliance & Obligations assistant.",
    "Focus on deadlines and obligations: taxes, licenses and permits, insurance, loan and lease payments, payroll.",
    "Help the owner plan payments against cash, avoid missed deadlines and prepare for filings.",
    "You may describe common obligations for US small businesses in general terms, but do not state specific",
    "deadlines, rates or requirements for their state or city as fact — tell them which agency to confirm with (for",
    "example the IRS, their state revenue department, or their city or county licensing office). This is not legal or",
    "tax advice.",
  ].join("\n"),
  strategy: [
    "ROLE: Strategy & Operations assistant.",
    "Focus on how to close gaps to plan and grow: customers, pricing, products, operations, staffing and where AI or",
    "simple tools could save time. Use the Census tools when a question involves the local market, competition or",
    "a new location. MicroBiz AI's AI Readiness & Roadmap page (/business/ai-roadmap) builds a detailed AI plan — point",
    "the owner there when they want one.",
  ].join("\n"),
};

const money = (n: number | null) => (n == null ? "not entered" : usd(n));

/** The context block the model sees. Only data the owner permitted reaches this function. */
export function briefing(
  role: AssistantRole,
  data: AgentData,
  analysis: Analysis | null,
  profile: ProfileSummary | null,
  todayISO: string,
): string {
  const lines: string[] = [COMMON, "", ROLE_FOCUS[role], "", `TODAY: ${todayISO}`];

  lines.push("", "BUSINESS PROFILE:");
  if (profile) {
    lines.push(
      `${profile.industry || "Industry not given"} | ${profile.location || "location not given"} | ` +
      `${profile.employees || "?"} employees | ${profile.age || "?"} years old`,
      `Owner's own estimates from the assessment: annual revenue ${profile.revenue || "?"}, annual expenses ${profile.expenses || "?"}, cash ${profile.cash || "?"}.`,
      `Challenges they described: marketing — ${profile.marketing || "none given"}; operations — ${profile.operations || "none given"}.`,
    );
  } else {
    lines.push("Not shared by the owner.");
  }

  const { permissions } = data;
  lines.push("", `PLAN AND MONTHLY FIGURES (${data.plan.year}):`);
  if (!permissions.financials) {
    lines.push("Not shared by the owner. Financial questions need them to switch on \"Plan and monthly figures\" in the Sharing tab.");
  } else if (!analysis || (analysis.monthsEntered === 0 && data.plan.revenueTarget == null)) {
    lines.push("Shared, but nothing entered yet. Suggest the owner sets a revenue target and enters last month in the Plan & actuals tab.");
  } else {
    lines.push(
      `Annual revenue target ${money(data.plan.revenueTarget)}; expense budget ${money(data.plan.expenseBudget)}; minimum cash wanted ${money(data.plan.cashFloor)}.`,
      "Month | planned revenue | revenue | expenses | cash",
      ...analysis.rows
        .filter((r) => r.revenue != null || r.expenses != null || r.cash != null || data.months[r.month].plannedRevenue != null)
        .map((r) => `${MONTH_NAMES[r.month]} | ${money(r.planned)} | ${money(r.revenue)} | ${money(r.expenses)} | ${money(r.cash)}`),
    );
  }

  lines.push("", "OBLIGATIONS:");
  if (!permissions.obligations) {
    lines.push("Not shared by the owner. Deadline questions need them to switch on \"Obligations\" in the Sharing tab.");
  } else if (data.obligations.length === 0) {
    lines.push("None entered yet.");
  } else {
    const kind = (k: string) => OBLIGATION_KINDS.find((x) => x.key === k)?.label ?? k;
    lines.push(...data.obligations.map((o) =>
      `${o.label} (${kind(o.kind)}) — due ${o.dueDate}${o.amount != null ? `, ${usd(o.amount)}` : ""}, repeats: ${o.recurrence}${o.done ? ", DONE" : ""}`,
    ));
  }

  if (analysis && (permissions.financials || permissions.obligations)) {
    lines.push("", "MONITORING RESULTS (calculated by MicroBiz AI from the figures above):");
    if (analysis.alerts.length === 0) {
      lines.push("No alerts — not enough figures entered yet.");
    }
    for (const a of analysis.alerts) {
      lines.push(
        `[${a.severity.toUpperCase()}] ${a.title}`,
        `  Plan: ${a.plan}`, `  Actual: ${a.actual}`, `  Forecast: ${a.forecast}`,
        `  Risk: ${a.risk}`, `  Suggested action: ${a.action}`,
      );
    }
    lines.push("Methods:", ...analysis.methods.map((m) => `  - ${m}`));
  }

  return lines.join("\n");
}
