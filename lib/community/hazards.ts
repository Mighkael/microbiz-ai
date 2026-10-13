/**
 * What has actually gone wrong here: federally declared disasters affecting
 * this county.
 *
 * OpenFEMA's declaration summaries are a record of events serious enough for a
 * presidential declaration — so it understates smaller floods and storms, and
 * a declaration covers a whole county rather than a particular street. It is
 * still the plainest public answer to "does this place get hit, and by what?",
 * which bears on insurance, downtime and what a lender will ask about.
 *
 * Server-only. No key required.
 */
import type { HazardSummary } from "./types";

const DAY = 86400;
const YEARS_BACK = 20;
const SOURCE = "FEMA — OpenFEMA Disaster Declarations Summaries";

type Declaration = {
  disasterNumber: number;
  incidentType: string;
  declarationDate: string;
  declarationTitle?: string;
};

export async function getHazards(stateFips: string, countyFips: string, todayISO: string): Promise<HazardSummary | null> {
  const sinceYear = Number(todayISO.slice(0, 4)) - YEARS_BACK;
  const url = new URL("https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries");
  url.searchParams.set(
    "$filter",
    `fipsStateCode eq '${stateFips}' and fipsCountyCode eq '${countyFips}' and declarationDate ge '${sinceYear}-01-01T00:00:00.000Z'`,
  );
  url.searchParams.set("$select", "disasterNumber,incidentType,declarationDate,declarationTitle");
  url.searchParams.set("$top", "1000");

  const res = await fetch(url, { next: { revalidate: DAY } });
  if (!res.ok) return null;

  let rows: Declaration[];
  try {
    rows = ((await res.json()) as { DisasterDeclarationsSummaries?: Declaration[] }).DisasterDeclarationsSummaries ?? [];
  } catch {
    return null;
  }

  // One disaster can appear several times for the same county; count events.
  const seen = new Set<number>();
  const byType = new Map<string, { count: number; latestYear: number }>();
  for (const r of rows) {
    if (seen.has(r.disasterNumber)) continue;
    seen.add(r.disasterNumber);
    const type = (r.incidentType || "Other").trim();
    const year = Number(r.declarationDate?.slice(0, 4)) || sinceYear;
    const current = byType.get(type);
    byType.set(type, {
      count: (current?.count ?? 0) + 1,
      latestYear: Math.max(current?.latestYear ?? 0, year),
    });
  }

  return {
    types: [...byType.entries()]
      .map(([type, v]) => ({ type, ...v }))
      .sort((a, b) => b.count - a.count || b.latestYear - a.latestYear),
    total: seen.size,
    sinceYear,
    source: SOURCE,
  };
}

export const HAZARDS_SOURCE = SOURCE;
export const HAZARDS_LIMITATION =
  "Disaster counts are federal declarations covering the whole county over the last 20 years. Smaller floods, storms and fires that never reached a federal declaration are not counted, and a declaration doesn't mean every address was affected.";
