/**
 * Economic Census (2022) — the only free federal source with actual business
 * *revenue* by sector and geography. County Business Patterns has employment
 * and payroll but no receipts, which is why benchmarking needs both.
 *
 * Conducted every five years, so 2022 is the current vintage. Published at
 * county level and above — there is no ZIP-level revenue.
 *
 * Server-only.
 */
import { observed, unavailable, type DataPoint } from "./types";
import type { ResolvedGeography } from "./geography";
import type { NaicsSector } from "./naics";

const DAY = 86400;
const BASE = "https://api.census.gov/data";

export const EC_VINTAGE = "2022";
export const EC_SOURCE = "US Census Bureau — Economic Census";

/** Receipts and payroll are reported in thousands of dollars. */
const THOUSANDS = 1000;

export type GeoLevel = "county" | "state" | "us";

export type SectorEconomics = {
  geography: string;
  level: GeoLevel;
  sector: NaicsSector;
  establishments: DataPoint;
  employees: DataPoint;
  annualPayroll: DataPoint;
  totalRevenue: DataPoint;
  /** Derived below — each marked "calculated" with its formula in the note. */
  revenuePerEstablishment: DataPoint;
  revenuePerEmployee: DataPoint;
  employeesPerEstablishment: DataPoint;
  averageWage: DataPoint;
  payrollShareOfRevenue: DataPoint;
};

function geoLabel(geo: ResolvedGeography, level: GeoLevel): string {
  if (level === "us") return "United States";
  if (level === "state") return geo.stateName;
  return `${geo.countyName ?? "county"}, ${geo.stateName}`;
}

const num = (v: string | undefined): number | null => {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export async function getSectorEconomics(
  geo: ResolvedGeography,
  sector: NaicsSector,
  level: GeoLevel,
): Promise<SectorEconomics | null> {
  const label = geoLabel(geo, level);

  // Economic Census publishes no all-industries total, and some sectors have
  // no 2022 equivalent.
  if (!sector.code2022) {
    const why = "The Economic Census does not publish an all-industries total.";
    const none = () => unavailable(EC_SOURCE, EC_VINTAGE, label, why);
    return {
      geography: label, level, sector,
      establishments: none(), employees: none(), annualPayroll: none(), totalRevenue: none(),
      revenuePerEstablishment: none(), revenuePerEmployee: none(),
      employeesPerEstablishment: none(), averageWage: none(), payrollShareOfRevenue: none(),
    };
  }

  if (level === "county" && !geo.countyFips) return null;

  const url = new URL(`${BASE}/${EC_VINTAGE}/ecnbasic`);
  url.searchParams.set("get", "ESTAB,EMP,PAYANN,RCPTOT");
  url.searchParams.set("NAICS2022", sector.code2022);
  if (level === "us") {
    url.searchParams.set("for", "us:1");
  } else if (level === "state") {
    url.searchParams.set("for", `state:${geo.stateFips}`);
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

  const [header, ...data] = rows;
  const row = Object.fromEntries(header.map((h, i) => [h, data[0][i]])) as Record<string, string>;

  const estab = num(row.ESTAB);
  const emp = num(row.EMP);
  const payroll = num(row.PAYANN);
  const revenue = num(row.RCPTOT);

  const miss = (why: string) => unavailable(EC_SOURCE, EC_VINTAGE, label, why);
  const noData = "Not published for this area and sector — often withheld where too few businesses operate.";

  // Ratios are ours, not Census's, so they're marked "calculated" and carry
  // the arithmetic that produced them.
  const ratio = (
    a: number | null, b: number | null, note: string,
  ): DataPoint =>
    a === null || b === null || b === 0
      ? miss(noData)
      : { value: a / b, status: "calculated", source: EC_SOURCE, vintage: EC_VINTAGE, geography: label, note };

  return {
    geography: label,
    level,
    sector,
    establishments: estab === null ? miss(noData) : observed(estab, EC_SOURCE, EC_VINTAGE, label),
    employees: emp === null ? miss(noData) : observed(emp, EC_SOURCE, EC_VINTAGE, label),
    annualPayroll: payroll === null ? miss(noData) : observed(payroll * THOUSANDS, EC_SOURCE, EC_VINTAGE, label),
    totalRevenue: revenue === null ? miss(noData) : observed(revenue * THOUSANDS, EC_SOURCE, EC_VINTAGE, label),

    revenuePerEstablishment: ratio(
      revenue === null ? null : revenue * THOUSANDS, estab,
      "Total sector receipts divided by number of establishments.",
    ),
    revenuePerEmployee: ratio(
      revenue === null ? null : revenue * THOUSANDS, emp,
      "Total sector receipts divided by sector employment.",
    ),
    employeesPerEstablishment: ratio(
      emp, estab,
      "Sector employment divided by number of establishments.",
    ),
    averageWage: ratio(
      payroll === null ? null : payroll * THOUSANDS, emp,
      "Total sector payroll divided by sector employment.",
    ),
    payrollShareOfRevenue: ratio(
      payroll, revenue,
      "Sector payroll as a share of sector receipts.",
    ),
  };
}
