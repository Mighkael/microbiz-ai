/**
 * Every sector at once, for one geography, in a single Census call (§16).
 *
 * The Opportunity Finder has to compare ten sectors against each other. Asking
 * `getSectorEconomics` ten times would mean twenty round trips; the Economic
 * Census accepts `NAICS2022=*`, which returns every published sector for the
 * area in one response. Two calls — local and national — cover the whole scan.
 *
 * Server-only.
 */
import type { ResolvedGeography } from "./geography";
import { EC_VINTAGE, EC_SOURCE } from "./economic";

const DAY = 86400;

export { EC_VINTAGE, EC_SOURCE };

export type SectorRow = {
  establishments: number;
  employees: number | null;
  annualPayroll: number | null;
  totalRevenue: number | null;
};

/** Receipts and payroll come in thousands of dollars. */
const THOUSANDS = 1000;

/**
 * The Economic Census reports withheld figures as 0 rather than omitting them,
 * so a zero is "not published", never "genuinely none". Treating it as a real
 * zero would put fake $0-revenue sectors at the bottom of every ranking.
 */
const num = (v: string | undefined): number | null => {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export type SectorScan = Map<string, SectorRow>;

export async function scanSectors(
  geo: ResolvedGeography,
  level: "county" | "us",
): Promise<SectorScan | null> {
  if (level === "county" && !geo.countyFips) return null;

  const url = new URL(`https://api.census.gov/data/${EC_VINTAGE}/ecnbasic`);
  url.searchParams.set("get", "ESTAB,EMP,PAYANN,RCPTOT");
  url.searchParams.set("NAICS2022", "*");
  if (level === "us") {
    url.searchParams.set("for", "us:1");
  } else {
    url.searchParams.set("for", `county:${geo.countyFips}`);
    url.searchParams.set("in", `state:${geo.stateFips}`);
  }
  url.searchParams.set("key", process.env.CENSUS_API_KEY ?? "");

  const res = await fetch(url, { next: { revalidate: DAY } });
  if (!res.ok) return null;

  const text = await res.text();
  if (!text.trim().startsWith("[")) return null;

  const rows = JSON.parse(text) as string[][];
  if (rows.length < 2) return null;

  const header = rows[0];
  const iCode = header.indexOf("NAICS2022");
  const iEstab = header.indexOf("ESTAB");
  const iEmp = header.indexOf("EMP");
  const iPay = header.indexOf("PAYANN");
  const iRcpt = header.indexOf("RCPTOT");
  if (iCode < 0 || iEstab < 0) return null;

  const out: SectorScan = new Map();
  for (const r of rows.slice(1)) {
    const estab = num(r[iEstab]);
    // No establishments published means the sector isn't reported here at all.
    if (estab === null) continue;

    const pay = num(r[iPay]);
    const rcpt = num(r[iRcpt]);
    out.set(r[iCode], {
      establishments: estab,
      employees: num(r[iEmp]),
      annualPayroll: pay === null ? null : pay * THOUSANDS,
      totalRevenue: rcpt === null ? null : rcpt * THOUSANDS,
    });
  }
  return out;
}
