/**
 * Opportunity Finder (§16).
 *
 * Answers the question the other modules can't: "I know roughly what I can
 * put in and where I'd be — what should I actually open?" Every other tool
 * assumes you already know your sector.
 *
 * It ranks sectors on four things the Economic Census and ACS actually
 * publish for that county, each scored against the national figure so 50
 * always means "the same as the average American market".
 *
 * What it deliberately does NOT do:
 *   - Estimate what it costs to start a business. No free federal source
 *     publishes startup costs, and inventing one would be the single most
 *     damaging number on the page. The capital test is explicitly a *payroll*
 *     test — how long your money covers the wage bill a typical local
 *     establishment carries — and is labelled that way everywhere.
 *   - Treat competition as bad. A crowded sector where businesses earn well
 *     is a strong sector, which is why revenue outweighs headroom.
 */
import { INDUSTRY_TO_NAICS, type NaicsSector } from "./census/naics";
import type { SectorScan, SectorRow } from "./census/sectorScan";

export type OpportunityFactor = {
  key: string;
  label: string;
  /** 0–100, where 50 is the national figure. */
  subscore: number;
  direction: "positive" | "neutral" | "negative";
  reading: string;
  weight: number;
};

export type Opportunity = {
  industry: string;
  sector: NaicsSector;
  score: number;
  factors: OpportunityFactor[];
  /** Local figures, for the detail table. */
  establishments: number;
  revenuePerEstablishment: number | null;
  employeesPerEstablishment: number | null;
  typicalAnnualPayroll: number | null;
  /** Months of a typical establishment's payroll the stated capital covers. */
  monthsOfPayrollCovered: number | null;
  /** True when capital covers under three months — a real constraint, flagged. */
  capitalIsAStretch: boolean;
  confidence: "high" | "moderate" | "limited";
};

export type UnrankedSector = { industry: string; reason: string };

export type OpportunityResult = {
  ranked: Opportunity[];
  /**
   * Sectors that score well on the market but sit beyond the stated capital.
   * Kept visible with their scores — the budget may change, and the figures
   * are the reason — but out of the main ranking, because presenting a sector
   * whose typical establishment runs a $40m payroll as the top pick for
   * someone with $50,000 is misleading however it is flagged.
   */
  outOfReach: Opportunity[];
  unranked: UnrankedSector[];
};

/** Below this many months of covered payroll, a sector is treated as out of reach. */
export const REACH_THRESHOLD_MONTHS = 1;

/** Parity with the national figure scores 50; capped so one factor can't swamp the rest. */
const ratioToScore = (ratio: number) => Math.max(0, Math.min(100, 50 * Math.min(ratio, 2)));

const directionFor = (s: number): OpportunityFactor["direction"] =>
  s >= 60 ? "positive" : s <= 40 ? "negative" : "neutral";

const usd = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pctChange = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(0)}%`;
const count = (v: number) => Math.round(v).toLocaleString("en-US");

/**
 * Candidate sectors, deduplicated by their Economic Census code. E-commerce
 * and Retail both resolve to 44-45 under NAICS 2022, and listing the same
 * figures twice under two names would be noise — so the exact match wins.
 */
function candidateSectors(): { industry: string; sector: NaicsSector }[] {
  const byCode = new Map<string, { industry: string; sector: NaicsSector }>();
  for (const [industry, sector] of Object.entries(INDUSTRY_TO_NAICS)) {
    if (!sector.code2022) continue;
    const existing = byCode.get(sector.code2022);
    const isExact = sector.code === sector.code2022;
    if (!existing || (isExact && existing.sector.code !== existing.sector.code2022)) {
      byCode.set(sector.code2022, { industry, sector });
    }
  }
  return [...byCode.values()];
}

const per = (a: number | null, b: number | null) =>
  a === null || b === null || b === 0 ? null : a / b;

export function findOpportunities(
  local: SectorScan,
  national: SectorScan,
  localPopulation: number | null,
  nationalPopulation: number | null,
  capital: number | null,
): OpportunityResult {
  const ranked: Opportunity[] = [];
  const unranked: UnrankedSector[] = [];

  for (const { industry, sector } of candidateSectors()) {
    const code = sector.code2022 as string;
    const l: SectorRow | undefined = local.get(code);
    const n: SectorRow | undefined = national.get(code);

    if (!l) {
      unranked.push({
        industry,
        reason: "The Economic Census publishes no figures for this sector in this county.",
      });
      continue;
    }

    const localRev = per(l.totalRevenue, l.establishments);
    const natRev = n ? per(n.totalRevenue, n.establishments) : null;
    const localWage = per(l.annualPayroll, l.employees);
    const natWage = n ? per(n.annualPayroll, n.employees) : null;
    const typicalPayroll = per(l.annualPayroll, l.establishments);

    const factors: OpportunityFactor[] = [];

    // 1. What a business here actually takes in. The heaviest factor: it is
    //    the closest thing published to "is there money in this here".
    if (localRev !== null && natRev !== null) {
      const ratio = localRev / natRev;
      const subscore = ratioToScore(ratio);
      factors.push({
        key: "revenue",
        label: "Revenue per business",
        subscore,
        direction: directionFor(subscore),
        reading: `A typical business in this sector here takes in ${usd(localRev)} a year — ${pctChange(ratio - 1)} against the national ${usd(natRev)}.`,
        weight: 0.3,
      });
    }

    // 2. Room in the market — residents per business, local against national.
    const localRoom = per(localPopulation, l.establishments);
    const natRoom = n ? per(nationalPopulation, n.establishments) : null;
    if (localRoom !== null && natRoom !== null) {
      const ratio = localRoom / natRoom;
      const subscore = ratioToScore(ratio);
      factors.push({
        key: "room",
        label: "Room in the market",
        subscore,
        direction: directionFor(subscore),
        reading: `${count(localRoom)} residents per business here against ${count(natRoom)} nationally — ${ratio >= 1 ? "a less crowded field" : "a denser field"}. There are ${count(l.establishments)} already operating.`,
        weight: 0.25,
      });
    }

    // 3. Wage cost. Inverted: for someone deciding what to open, a lower
    //    local wage is a lower cost base. It is not a judgement about pay.
    if (localWage !== null && natWage !== null) {
      const ratio = localWage / natWage;
      const subscore = ratioToScore(2 - ratio);
      factors.push({
        key: "wages",
        label: "Wage cost",
        subscore,
        direction: directionFor(subscore),
        reading: `Average wage in this sector locally is ${usd(localWage)}, ${pctChange(ratio - 1)} against the national ${usd(natWage)} — ${ratio <= 1 ? "a lower cost base" : "a higher cost base"} than average.`,
        weight: 0.15,
      });
    }

    // 4. Capital against the local wage bill. Only a payroll test — see the
    //    module note. Skipped entirely when no capital was given.
    let monthsCovered: number | null = null;
    if (capital !== null && typicalPayroll !== null && typicalPayroll > 0) {
      monthsCovered = capital / (typicalPayroll / 12);
      const subscore = Math.max(0, Math.min(100, (monthsCovered / 12) * 100));
      factors.push({
        key: "capital",
        label: "Capital against the wage bill",
        subscore,
        direction: directionFor(subscore),
        reading: `A typical establishment here carries ${usd(typicalPayroll)} of payroll a year. Your ${usd(capital)} covers about ${monthsCovered >= 1 ? `${monthsCovered.toFixed(1)} months` : "under a month"} of that — before rent, stock or equipment.`,
        weight: 0.3,
      });
    }

    // Revenue is the load-bearing factor: without it, "room in the market"
    // alone can score a sector 100 purely for being under-served, which would
    // rank an unmeasured sector above a well-evidenced one. A sector missing
    // it is reported as unranked with what is known, not scored.
    const hasRevenue = factors.some((f) => f.key === "revenue");
    if (!hasRevenue) {
      const known = factors.length > 0
        ? ` What is published: ${factors.map((f) => f.label.toLowerCase()).join(", ")}.`
        : "";
      unranked.push({
        industry,
        reason:
          `Revenue is withheld for this sector in this county, so there is no way to tell whether businesses here earn well.${known}`,
      });
      continue;
    }

    const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
    const score = Math.round(factors.reduce((s, f) => s + f.subscore * f.weight, 0) / totalWeight);

    ranked.push({
      industry,
      sector,
      score,
      factors,
      establishments: l.establishments,
      revenuePerEstablishment: localRev,
      employeesPerEstablishment: per(l.employees, l.establishments),
      typicalAnnualPayroll: typicalPayroll,
      monthsOfPayrollCovered: monthsCovered,
      capitalIsAStretch: monthsCovered !== null && monthsCovered < 3,
      // Judged on which market factors are present, not the raw count — the
      // capital factor is optional, so counting it would make every result
      // "limited" whenever capital is left blank.
      confidence:
        factors.some((f) => f.key === "room") && factors.some((f) => f.key === "wages")
          ? "high"
          : factors.length >= 2
            ? "moderate"
            : "limited",
    });
  }

  ranked.sort((a, b) => b.score - a.score);

  const withinReach: Opportunity[] = [];
  const outOfReach: Opportunity[] = [];
  for (const o of ranked) {
    const beyond =
      o.monthsOfPayrollCovered !== null && o.monthsOfPayrollCovered < REACH_THRESHOLD_MONTHS;
    (beyond ? outOfReach : withinReach).push(o);
  }

  return { ranked: withinReach, outOfReach, unranked };
}

/**
 * Caveats that belong on every result. The first two are the ones most likely
 * to mislead someone acting on this page.
 */
export const OPPORTUNITY_LIMITATIONS = [
  "These are sector averages, not a forecast for your business. A large employer in the county pulls the average up, so a typical small operator will usually sit below the revenue figure shown.",
  "Nothing here estimates what it costs to start. No free federal source publishes startup costs, so the capital test measures only how long your money would cover a typical establishment's wage bill — not rent, stock, equipment, fit-out or licences.",
  "The Economic Census is conducted every five years; these are 2022 figures, the current vintage.",
  "Sectors the Census withholds locally are listed separately rather than scored, because a withheld figure is not a zero.",
  "This ranks what the data supports. It does not know your experience, your contacts, or what you would be good at — which matter at least as much.",
];
