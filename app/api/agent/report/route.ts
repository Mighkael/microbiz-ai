// app/api/agent/report/route.ts
// POST /api/agent/report  { type: "investor" | "lender", data, profile, options, today }
//   → { payload }   (a ReportPayload for /api/report to turn into Word)
//
// Every figure is computed here from the owner's own entries (and, for the
// investor report, published Census data). Claude writes only the narrative
// paragraphs, from a list of facts it is given and told not to go beyond. If
// Claude is unavailable, plain factual paragraphs are used instead.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeAgentData, OBLIGATION_KINDS, MONTH_NAMES } from "@/lib/agent/types";
import { analyze, usd, type Analysis } from "@/lib/agent/analysis";
import { structured, hasApiKey } from "@/lib/ai/claude";
import { resolveGeography } from "@/lib/census/geography";
import { getSectorEconomics, EC_SOURCE, EC_VINTAGE } from "@/lib/census/economic";
import { naicsForIndustry } from "@/lib/census/naics";

export const maxDuration = 90;

type ReportType = "investor" | "lender";
type Section = { heading: string; paragraphs?: string[]; table?: { columns: string[]; rows: string[][] } };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const money = (n: number | null) => (n == null ? "—" : usd(n));
const pct = (n: number | null, dp = 0) => (n == null ? "—" : `${(n * 100).toFixed(dp)}%`);

/** A commonly cited lender benchmark; each lender sets its own. */
const DSCR_BENCHMARK = 1.25;

/** Standard amortising loan payment. */
function monthlyPayment(principal: number, annualRatePct: number, months: number) {
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

/** Average of the first three months entered against the last three. */
function growth(a: Analysis): { value: number | null; label: string } {
  const entered = a.rows.filter((r) => r.revenue != null);
  if (entered.length < 2) return { value: null, label: "Needs at least two months of revenue." };
  const n = entered.length >= 6 ? 3 : 1;
  const avg = (xs: typeof entered) => xs.reduce((s, r) => s + (r.revenue as number), 0) / xs.length;
  const first = avg(entered.slice(0, n));
  const last = avg(entered.slice(-n));
  if (first <= 0) return { value: null, label: "Not meaningful from a zero start." };
  return {
    value: (last - first) / first,
    label: n === 3
      ? `Average of ${MONTH_NAMES[entered[entered.length - 3].month]}–${MONTH_NAMES[entered[entered.length - 1].month]} against ${MONTH_NAMES[entered[0].month]}–${MONTH_NAMES[entered[2].month]}.`
      : `${MONTH_NAMES[entered[entered.length - 1].month]} against ${MONTH_NAMES[entered[0].month]}.`,
  };
}

const NarrativeSchema = z.object({
  summary: z.string().describe("One paragraph: who the business is, how it is performing against plan, and what is being asked for."),
  performance: z.string().describe("One paragraph on results so far, using only the figures given."),
  outlook: z.string().describe("One paragraph on the forecast and what it depends on, stating that it is a projection."),
  capacity: z.string().describe("Lender report: one paragraph on ability to repay. Investor report: one paragraph on the growth opportunity."),
  risks: z.array(z.object({ risk: z.string(), mitigation: z.string() })).describe("Two to four genuine risks from the facts, each with a practical mitigation."),
});
type Narrative = z.infer<typeof NarrativeSchema>;

const SYSTEM = [
  "You write the narrative sections of a short report a US small-business owner will give to a lender or investor.",
  "Write in the third person about the business, in plain, professional, factual language. No hype, no superlatives.",
  "",
  "Use only the facts provided. Do not introduce any number, customer, contract, product, market claim or plan that",
  "is not in the facts. You may restate the given figures and simple comparisons between them. Where the facts show a",
  "weakness (for example revenue behind plan or a recent loss), state it plainly and pair it with the mitigation the",
  "facts support — readers trust reports that are candid. Refer to the figures as owner-reported and unaudited once.",
  "Never state or imply the owner's intentions, strategy or reasons beyond what the facts say. Published market",
  "averages describe the whole sector (including large employers); present them as context only and do not compare",
  "the business's own revenue against them.",
].join("\n");

function fallbackNarrative(type: ReportType, facts: string[], a: Analysis): Narrative {
  return {
    summary: facts.slice(0, 3).join(" "),
    performance: a.alerts.filter((x) => x.area !== "obligations").map((x) => x.actual).join(" ") || "Figures are limited.",
    outlook: a.forecast.revenue != null
      ? `If the recent monthly average continues, revenue for the year would be about ${usd(a.forecast.revenue)}. This is a projection from owner-reported figures, not a forecast of results.`
      : "Not enough months have been entered to project the year.",
    capacity: type === "lender"
      ? "See the repayment capacity table for the calculation from recent monthly results."
      : "See the market context and traction tables.",
    risks: a.alerts
      .filter((x) => x.severity === "high" || x.severity === "medium")
      .slice(0, 4)
      .map((x) => ({ risk: x.risk, mitigation: x.action })),
  };
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request couldn't be read." }, { status: 400 });
  }

  const type: ReportType = body.type === "lender" ? "lender" : "investor";
  const today = /^\d{4}-\d{2}-\d{2}$/.test(str(body.today, 10)) ? str(body.today, 10) : new Date().toISOString().slice(0, 10);
  const data = sanitizeAgentData(body.data, +today.slice(0, 4));

  if (!data.permissions.financials) {
    return NextResponse.json(
      { error: "Reports are built from your plan and monthly figures. Switch on sharing of \"Plan and monthly figures\" in the Sharing tab first." },
      { status: 400 },
    );
  }

  const a = analyze(data, today);
  if (a.monthsEntered === 0) {
    return NextResponse.json({ error: "Enter at least one month of revenue in Plan & actuals. Three or more months make a far stronger report." }, { status: 400 });
  }

  const p = (body.profile && typeof body.profile === "object" ? body.profile : {}) as Record<string, unknown>;
  const profile = data.permissions.profile
    ? { industry: str(p.industry, 80), location: str(p.location, 120), employees: str(p.employees, 20), age: str(p.age, 20) }
    : { industry: "", location: "", employees: "", age: "" };
  const o = (body.options && typeof body.options === "object" ? body.options : {}) as Record<string, unknown>;
  const businessName = str(o.businessName, 120) || "The business";
  const amount = num(o.amount);
  const purpose = str(o.purpose, 600);
  const termMonths = Math.min(360, Math.max(1, Math.round(num(o.termMonths) ?? 60)));
  const ratePct = Math.min(40, num(o.ratePct) ?? 0);

  const lastName = MONTH_NAMES[a.lastMonth];
  const margin = a.ytd.net != null && a.ytd.revenue > 0 ? a.ytd.net / a.ytd.revenue : null;
  const g = growth(a);

  /* ---------------- Figures shared by both reports ---------------- */

  const facts: string[] = [
    `${businessName}${profile.industry ? `, a ${profile.industry.toLowerCase()} business` : ""}${profile.location ? ` in ${profile.location}` : ""}${profile.age ? `, operating for ${profile.age} years` : ""}${profile.employees ? ` with ${profile.employees} employees` : ""}.`,
    `Owner-reported revenue for ${data.plan.year} through ${lastName}: ${usd(a.ytd.revenue)} across ${a.monthsEntered} month${a.monthsEntered === 1 ? "" : "s"}.`,
    ...(a.ytd.net != null ? [`Net result through ${lastName}: ${usd(Math.abs(a.ytd.net))} ${a.ytd.net >= 0 ? "profit" : "loss"} (${pct(margin)} of revenue).`] : []),
    ...(a.runRate.revenue != null ? [`Recent monthly revenue average (last ${a.runRate.months} months): ${usd(a.runRate.revenue)}.`] : []),
    ...(g.value != null ? [`Revenue growth: ${pct(g.value)} (${g.label})`] : []),
    ...(a.latestCash != null ? [`Cash at the last month entered: ${usd(a.latestCash)}.`] : []),
    ...a.alerts.map((x) => `${x.title}. Plan: ${x.plan} Actual: ${x.actual} Forecast: ${x.forecast}`),
  ];

  const monthTable = {
    columns: ["Month", "Planned revenue", "Revenue", "Expenses", "Net", "Cash"],
    rows: a.rows
      .filter((r) => r.month <= a.lastMonth)
      .map((r) => [r.name, money(r.planned), money(r.revenue), money(r.expenses), r.net == null ? "—" : usd(r.net), money(r.cash)]),
  };

  const planVsActual = {
    columns: ["Area", "Plan", "Actual", "Forecast"],
    rows: a.alerts.filter((x) => x.area !== "obligations").map((x) => [x.title, x.plan, x.actual, x.forecast]),
  };

  const overview = {
    columns: ["", ""],
    rows: [
      ["Business", businessName],
      ["Industry", profile.industry || "—"],
      ["Location", profile.location || "—"],
      ["Years operating", profile.age || "—"],
      ["Employees", profile.employees || "—"],
    ],
  };

  const sources = [`Financial figures: entered by the owner in MicroBiz AI (${data.plan.year}); unaudited.`];

  /* ---------------- Type-specific figures ---------------- */

  const extraSections: Section[] = [];

  if (type === "lender") {
    const payment = amount ? monthlyPayment(amount, ratePct, termMonths) : null;
    const existingLoans = data.obligations.filter((x) => x.kind === "loan" && !x.done && x.recurrence === "monthly" && x.amount != null);
    const existingMonthly = existingLoans.reduce((s, x) => s + (x.amount as number), 0);
    const annualNet = a.runRate.net != null ? a.runRate.net * 12 : null;
    const annualDebt = payment != null ? payment * 12 : null;
    // A ratio only means something when there is profit to cover the payment;
    // a loss is reported as "not covered" rather than as a negative ratio.
    const coverage = annualNet != null && annualNet > 0 && annualDebt ? annualNet / annualDebt : null;

    if (amount) {
      facts.push(`Loan requested: ${usd(amount)} over ${termMonths} months${ratePct ? ` at an assumed ${ratePct}% interest` : ""}; estimated payment ${money(payment)} a month. Purpose: ${purpose || "not stated"}.`);
    }
    if (coverage != null) {
      facts.push(`Recent profit covers the new loan payment ${coverage.toFixed(2)} times (annualized recent monthly net ${usd(annualNet!)} against ${usd(annualDebt!)} a year of new payments). ${coverage >= DSCR_BENCHMARK ? "That is at or above" : "That is below"} the ${DSCR_BENCHMARK} level commonly cited by lenders.`);
    } else if (annualNet != null && annualNet <= 0) {
      facts.push("Recent months show a loss, so the new payment would not currently be covered by profit.");
    }
    if (existingLoans.length) facts.push(`Existing monthly loan payments recorded: ${usd(existingMonthly)}.`);

    extraSections.push(
      {
        heading: "Loan request",
        table: {
          columns: ["", ""],
          rows: [
            ["Amount requested", money(amount)],
            ["Term", `${termMonths} months`],
            ["Interest rate assumed for this estimate", ratePct ? `${ratePct}%` : "Not given (payment shown at 0%)"],
            ["Estimated monthly payment", money(payment)],
            ["Purpose", purpose || "—"],
          ],
        },
      },
      {
        heading: "Repayment capacity",
        table: {
          columns: ["Measure", "Figure"],
          rows: [
            [`Average monthly net result (last ${a.runRate.months} months)`, a.runRate.net == null ? "Expenses not entered" : usd(a.runRate.net)],
            ["Annualized", money(annualNet)],
            ["New loan payments per year", money(annualDebt)],
            ["Coverage (annualized net ÷ new annual payments)",
              coverage != null ? `${coverage.toFixed(2)}×`
                : annualNet != null && annualNet <= 0 ? "Not covered — recent months show a loss"
                  : annualDebt == null ? "Enter a loan amount" : "—"],
            ["Existing monthly loan payments on record", existingLoans.length ? usd(existingMonthly) : "None recorded"],
          ],
        },
        paragraphs: [
          `Coverage divides the business's recent profit, annualized, by a year of payments on the new loan. Many lenders look for about ${DSCR_BENCHMARK}× or more, though each sets its own threshold and will use its own calculation from tax returns and statements. If the expenses entered already include existing loan payments, this figure is conservative.`,
        ],
      },
      {
        heading: "What a lender will usually also ask for",
        paragraphs: [
          "Business and personal tax returns (often two to three years), recent business bank statements, a year-to-date profit and loss statement and balance sheet, a list of existing debts, business licenses and registration documents, and identification for each owner. Having these ready shortens the process.",
        ],
      },
    );
  } else {
    // Market context from the Economic Census, when the location resolves.
    let market: Section | null = null;
    if (profile.location && profile.industry) {
      try {
        const geo = await resolveGeography(profile.location);
        const sector = naicsForIndustry(profile.industry);
        if (geo && sector.code2022) {
          const [local, us] = await Promise.all([
            getSectorEconomics(geo, sector, "county"),
            getSectorEconomics(geo, sector, "us"),
          ]);
          const le = local?.establishments.value ?? null;
          const lr = local?.revenuePerEstablishment.value ?? null;
          const ur = us?.revenuePerEstablishment.value ?? null;
          if (le != null || lr != null) {
            market = {
              heading: "Market context",
              table: {
                columns: ["Measure", local?.geography ?? "County", "United States"],
                rows: [
                  ["Establishments in this sector", le == null ? "Not published" : Math.round(le).toLocaleString("en-US"), us?.establishments.value == null ? "—" : Math.round(us.establishments.value).toLocaleString("en-US")],
                  ["Average revenue per establishment", lr == null ? "Not published" : usd(lr), ur == null ? "—" : usd(ur)],
                ],
              },
              paragraphs: [
                `Sector: ${sector.label}. Averages include large employers, so a typical small business sits below them.${sector.benchmarkNote ? ` ${sector.benchmarkNote}` : ""}`,
              ],
            };
            sources.push(`Market figures: ${EC_SOURCE} ${EC_VINTAGE}.`);
            facts.push(`Context only, not a benchmark for this business — the sector average includes large employers. Published market data (${EC_SOURCE} ${EC_VINTAGE}): ${le != null ? `${Math.round(le)} establishments in ${sector.label.toLowerCase()} in ${local?.geography}` : "local establishment count not published"}${lr != null ? `, averaging ${usd(lr)} revenue each` : ""}${ur != null ? ` (national average ${usd(ur)})` : ""}.`);
          }
        }
      } catch (err) {
        console.error("Report market context failed:", err);
      }
    }

    if (amount) facts.push(`Investment sought: ${usd(amount)}. Intended use of funds: ${purpose || "not stated"}.`);

    extraSections.push(
      {
        heading: "Traction",
        table: {
          columns: ["Measure", "Figure"],
          rows: [
            [`Revenue, ${data.plan.year} to date`, usd(a.ytd.revenue)],
            [`Average monthly revenue (last ${a.runRate.months} months)`, money(a.runRate.revenue)],
            ["Revenue growth", g.value == null ? g.label : `${pct(g.value)} — ${g.label}`],
            ["Net margin to date", pct(margin)],
            ["Months of figures", String(a.monthsEntered)],
          ],
        },
      },
      ...(market ? [market] : []),
      {
        heading: "Investment and use of funds",
        table: { columns: ["", ""], rows: [["Amount sought", money(amount)], ["Use of funds", purpose || "—"]] },
      },
    );
  }

  /* ---------------- Narrative ---------------- */

  let narrative = fallbackNarrative(type, facts, a);
  let aiWritten = false;
  if (hasApiKey()) {
    try {
      narrative = await structured({
        schema: NarrativeSchema,
        system: SYSTEM,
        prompt: `Report type: ${type === "lender" ? "bank / lender (supporting a loan application)" : "investor update"}\n\nFacts:\n${facts.map((f) => `- ${f}`).join("\n")}`,
        effort: "medium",
      });
      aiWritten = true;
    } catch (err) {
      console.error("Report narrative failed:", err);
    }
  }

  const title = type === "lender" ? `${businessName} — Lender Report` : `${businessName} — Investor Report`;
  const sections: Section[] = [
    { heading: "Summary", paragraphs: [narrative.summary] },
    { heading: "Business overview", table: overview },
    ...(type === "lender" ? extraSections.slice(0, 1) : []),
    { heading: "Financial performance", paragraphs: [narrative.performance], table: monthTable },
    ...(planVsActual.rows.length ? [{ heading: "Plan against actual", table: planVsActual }] : []),
    ...(type === "lender" ? extraSections.slice(1) : extraSections),
    { heading: "Outlook", paragraphs: [narrative.outlook, ...a.methods] },
    { heading: type === "lender" ? "Ability to repay" : "Growth opportunity", paragraphs: [narrative.capacity] },
    ...(narrative.risks.length ? [{
      heading: "Risks and mitigations",
      table: { columns: ["Risk", "Mitigation"], rows: narrative.risks.map((r) => [r.risk, r.mitigation]) },
    }] : []),
    ...(data.permissions.obligations && data.obligations.some((x) => !x.done) ? [{
      heading: "Upcoming obligations",
      table: {
        columns: ["Obligation", "Type", "Due", "Amount"],
        rows: data.obligations.filter((x) => !x.done).slice(0, 15).map((x) => [
          x.label, OBLIGATION_KINDS.find((k) => k.key === x.kind)?.label ?? x.kind, x.dueDate, money(x.amount),
        ]),
      },
    }] : []),
  ];

  return NextResponse.json({
    payload: {
      title,
      subtitle: `Prepared ${today} with MicroBiz AI`,
      sections,
      sources,
      limitations:
        `Prepared by MicroBiz AI from figures entered by the business owner. The figures are unaudited and are not financial statements. Projections assume recent months continue and are not predictions. ${aiWritten ? "Narrative paragraphs were drafted with AI from the figures shown; the owner should check every statement before sharing. " : ""}Not financial, legal, tax, or investment advice.`,
    },
  });
}
