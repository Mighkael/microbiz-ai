/**
 * How much need there is for a service locally, and when it peaks.
 *
 * On the question actually asked — "how many people search for this here" —
 * the honest answer is that nobody publishes it for free. Google and Bing
 * hold the only real counts; both gate them behind an advertising or
 * webmaster account, and a per-area figure needs that account's own key.
 * Rather than invent a number, this reports what *is* published:
 *
 *   - How many businesses already serve this need per 10,000 residents,
 *     against the national rate. Fewer than average is the clearest public
 *     signal of unmet need there is.
 *   - How local employment in the industry moves through the year, from the
 *     Bureau of Labor Statistics' quarterly census. That answers "when is it
 *     busy here" with measured local figures rather than guesswork.
 *
 * Server-only.
 */
import type { ResolvedGeography } from "../census/geography";
import { getBusinessActivity, getDemographics, CBP_SOURCE, CBP_VINTAGE } from "../census/client";
import type { NaicsSector } from "../census/naics";

const DAY = 86400;
const QCEW_SOURCE = "US Bureau of Labor Statistics — Quarterly Census of Employment and Wages";

export type SeasonalQuarter = {
  quarter: number;
  label: string;
  employment: number | null;
  establishments: number | null;
};

export type Seasonality = {
  year: number;
  quarters: SeasonalQuarter[];
  busiest: SeasonalQuarter | null;
  quietest: SeasonalQuarter | null;
  /** Peak employment over trough, as a percentage. */
  swingPercent: number | null;
  source: string;
};

export type DemandRead = {
  sector: { label: string; code: string };
  geography: { label: string; population: number | null };
  localBusinesses: number | null;
  /** Businesses in this sector per 10,000 residents. */
  localPer10k: number | null;
  nationalPer10k: number | null;
  /** More competition per resident than the country, or less. */
  competition: "crowded" | "typical" | "underserved" | null;
  reading: string;
  seasonality: Seasonality | null;
  sources: string[];
  searchVolumeNote: string;
};

export const SEARCH_VOLUME_NOTE =
  "MicroBiz AI does not show how many people searched for this, because no free public source publishes it. " +
  "Google's and Bing's own counts sit behind an advertising or webmaster account, and anyone quoting a local " +
  "search figure without one is estimating. What's below is measured instead: how many businesses already serve " +
  "this need here, and when local employment in the industry peaks.";

const QUARTER_LABELS = ["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"];

/** Splits a CSV line, honoring quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(field); field = ""; }
    else field += ch;
  }
  out.push(field);
  return out;
}

const toNum = (v: string | undefined): number | null => {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** One quarter of county data for one industry. Private ownership only. */
async function qcewQuarter(countyFips5: string, industry: string, year: number, quarter: number) {
  const url = `https://data.bls.gov/cew/data/api/${year}/${quarter}/area/${countyFips5}.csv`;
  const res = await fetch(url, {
    headers: { "User-Agent": "MicroBizAI/1.0 (https://www.microbiz-ai.com)" },
    next: { revalidate: DAY * 7 },
  });
  if (!res.ok) return null;

  const text = await res.text();
  const lines = text.split("\n").filter(Boolean);
  if (lines.length < 2) return null;

  const header = splitCsvLine(lines[0]).map((h) => h.replace(/"/g, ""));
  const col = (name: string) => header.indexOf(name);
  const [iIndustry, iOwn, iEstabs, iM1, iM2, iM3, iDisclosure] = [
    col("industry_code"), col("own_code"), col("qtrly_estabs"),
    col("month1_emplvl"), col("month2_emplvl"), col("month3_emplvl"), col("disclosure_code"),
  ];
  if (iIndustry < 0) return null;

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    if (cells[iIndustry] !== industry || cells[iOwn] !== "5") continue;
    // "N" means the Bureau withheld the figures to protect employers.
    if (cells[iDisclosure]?.trim() === "N") return { employment: null, establishments: null };
    const months = [toNum(cells[iM1]), toNum(cells[iM2]), toNum(cells[iM3])].filter((n): n is number => n != null);
    return {
      employment: months.length ? Math.round(months.reduce((a, b) => a + b, 0) / months.length) : null,
      establishments: toNum(cells[iEstabs]),
    };
  }
  return null;
}

/**
 * The most recent complete year of quarterly figures. Tries the last few
 * years because the Bureau publishes about two quarters behind.
 */
async function getSeasonality(countyFips5: string, industry: string): Promise<Seasonality | null> {
  const thisYear = new Date().getFullYear();
  for (const year of [thisYear - 1, thisYear - 2]) {
    const quarters = await Promise.all([1, 2, 3, 4].map((q) => qcewQuarter(countyFips5, industry, year, q)));
    const rows: SeasonalQuarter[] = quarters.map((r, i) => ({
      quarter: i + 1,
      label: QUARTER_LABELS[i],
      employment: r?.employment ?? null,
      establishments: r?.establishments ?? null,
    }));
    const withData = rows.filter((r) => r.employment != null);
    if (withData.length < 4) continue;

    const busiest = withData.reduce((a, b) => ((b.employment as number) > (a.employment as number) ? b : a));
    const quietest = withData.reduce((a, b) => ((b.employment as number) < (a.employment as number) ? b : a));
    const swing = (quietest.employment as number) > 0
      ? Math.round((((busiest.employment as number) / (quietest.employment as number)) - 1) * 100)
      : null;

    return { year, quarters: rows, busiest, quietest, swingPercent: swing, source: QCEW_SOURCE };
  }
  return null;
}

export async function readDemand(geo: ResolvedGeography, sector: NaicsSector): Promise<DemandRead | null> {
  if (!geo.countyFips) return null;
  const countyFips5 = `${geo.stateFips}${geo.countyFips}`;

  const [localActivity, nationalActivity, demographics, nationalPop, seasonality] = await Promise.all([
    getBusinessActivity(geo, sector, "county").catch(() => null),
    nationalEstablishments(sector.code).catch(() => null),
    getDemographics(geo, "county").catch(() => null),
    getNationalPopulation().catch(() => null),
    getSeasonality(countyFips5, sector.code).catch(() => null),
  ]);

  const localBusinesses = localActivity?.establishments.value ?? null;
  const population = demographics?.population.value ?? null;
  const nationalBusinesses = nationalActivity;

  const localPer10k = localBusinesses != null && population ? (localBusinesses / population) * 10000 : null;
  const nationalPer10k = nationalBusinesses != null && nationalPop ? (nationalBusinesses / nationalPop) * 10000 : null;

  let competition: DemandRead["competition"] = null;
  let reading = "Not enough published figures to compare this market with the country.";
  if (localPer10k != null && nationalPer10k) {
    const ratio = localPer10k / nationalPer10k;
    competition = ratio > 1.15 ? "crowded" : ratio < 0.85 ? "underserved" : "typical";
    const per = (v: number) => v.toFixed(1);
    reading = competition === "underserved"
      ? `There are ${per(localPer10k)} such businesses per 10,000 residents here against ${per(nationalPer10k)} nationally — fewer than most places, which is the clearest public sign of unmet need.`
      : competition === "crowded"
        ? `There are ${per(localPer10k)} such businesses per 10,000 residents here against ${per(nationalPer10k)} nationally — a busier field than most places, so winning work will mean standing apart rather than simply existing.`
        : `There are ${per(localPer10k)} such businesses per 10,000 residents here against ${per(nationalPer10k)} nationally — about the same as the country as a whole.`;
  }

  return {
    sector: { label: sector.label, code: sector.code },
    geography: { label: geo.countyName ? `${geo.countyName}, ${geo.stateName}` : geo.stateName, population },
    localBusinesses,
    localPer10k,
    nationalPer10k,
    competition,
    reading,
    seasonality,
    sources: [
      `${CBP_SOURCE} ${CBP_VINTAGE}`,
      ...(seasonality ? [`${QCEW_SOURCE} ${seasonality.year}`] : []),
    ],
    searchVolumeNote: SEARCH_VOLUME_NOTE,
  };
}

/** Establishments in this sector nationally — the denominator for the comparison. */
async function nationalEstablishments(naics: string): Promise<number | null> {
  const url = new URL(`https://api.census.gov/data/${CBP_VINTAGE}/cbp`);
  url.searchParams.set("get", "ESTAB");
  url.searchParams.set("for", "us:1");
  url.searchParams.set("NAICS2017", naics);
  url.searchParams.set("key", process.env.CENSUS_API_KEY ?? "");
  const res = await fetch(url, { next: { revalidate: DAY } });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim().startsWith("[")) return null;
  const rows = JSON.parse(text) as string[][];
  const n = Number(rows[1]?.[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** National population, for the per-10,000 comparison. */
async function getNationalPopulation(): Promise<number | null> {
  const url = new URL("https://api.census.gov/data/2023/acs/acs5/profile");
  url.searchParams.set("get", "DP05_0001E");
  url.searchParams.set("for", "us:1");
  url.searchParams.set("key", process.env.CENSUS_API_KEY ?? "");
  const res = await fetch(url, { next: { revalidate: DAY } });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim().startsWith("[")) return null;
  const rows = JSON.parse(text) as string[][];
  const n = Number(rows[1]?.[0]);
  return Number.isFinite(n) ? n : null;
}
