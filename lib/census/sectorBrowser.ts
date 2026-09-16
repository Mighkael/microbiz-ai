/**
 * Sector Browser (§3) — any industry, by NAICS code, across states or across
 * the counties of one state.
 *
 * Built on County Business Patterns, which counts every establishment with
 * paid employees. It has no revenue (that is the Economic Census) but it
 * reaches every NAICS level from 2-digit sectors to 6-digit industries, and
 * every county — which is what browsing needs.
 *
 * Server-only.
 */
import { CBP_VINTAGE, CBP_SOURCE } from "./client";

const DAY = 86400;
const CBP = `https://api.census.gov/data/${CBP_VINTAGE}/cbp`;
const ACS_VINTAGE = "2023";
const ACS = `https://api.census.gov/data/${ACS_VINTAGE}/acs/acs5`;

export { CBP_VINTAGE, CBP_SOURCE };
export const POPULATION_SOURCE = `US Census Bureau — American Community Survey (5-year) ${ACS_VINTAGE}`;

async function census(url: URL): Promise<string[][] | null> {
  url.searchParams.set("key", process.env.CENSUS_API_KEY ?? "");
  const res = await fetch(url, { next: { revalidate: DAY } });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim().startsWith("[")) return null;
  const rows = JSON.parse(text) as string[][];
  return rows.length < 2 ? null : rows;
}

const positive = (v: string | undefined): number | null => {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/* ------------------------------------------------------------------ */
/* Industry list                                                       */
/* ------------------------------------------------------------------ */

export type NaicsEntry = {
  code: string;
  label: string;
  /** 2 = sector … 6 = national industry. Ranges like "44-45" count as 2. */
  digits: number;
  establishments: number;
};

/**
 * Every NAICS code CBP publishes nationally, with its label. NAICS repeats a
 * code down the levels when an industry has no subdivisions (1131 and 11311
 * are the same thing), so exact repeats collapse into the shortest code.
 */
export async function listIndustries(): Promise<NaicsEntry[] | null> {
  const url = new URL(CBP);
  url.searchParams.set("get", "NAICS2017_LABEL,ESTAB");
  url.searchParams.set("for", "us:1");
  url.searchParams.set("NAICS2017", "*");

  const rows = await census(url);
  if (!rows) return null;

  const [h, ...data] = rows;
  const iCode = h.indexOf("NAICS2017");
  const iLabel = h.indexOf("NAICS2017_LABEL");
  const iEstab = h.indexOf("ESTAB");

  // Shortest code first, so the collapse below keeps the general one.
  const ordered = [...data].sort((a, b) => a[iCode].length - b[iCode].length);

  const seen = new Set<string>();
  const out: NaicsEntry[] = [];
  for (const r of ordered) {
    const code = r[iCode];
    const estab = positive(r[iEstab]);
    // "00" is the all-sectors total — not an industry you can browse.
    if (code === "00" || estab === null) continue;

    const key = `${r[iLabel]}|${estab}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      code,
      label: r[iLabel],
      digits: code.includes("-") ? 2 : code.length,
      establishments: estab,
    });
  }
  // Back into code order so a sector sits beside its subsectors.
  return out.sort((a, b) => a.code.localeCompare(b.code));
}

/* ------------------------------------------------------------------ */
/* Distribution across areas                                           */
/* ------------------------------------------------------------------ */

export type AreaRow = {
  /** 2-digit state FIPS, or 5-digit county FIPS. */
  fips: string;
  name: string;
  establishments: number;
  /** Null where the Census withholds it. */
  employees: number | null;
  annualPayroll: number | null;
  /** Payroll ÷ employees. Calculated. */
  averageWage: number | null;
  population: number | null;
  /** Establishments per 10,000 residents. Calculated. */
  per10k: number | null;
  /** This area's share of all establishments in the scope. Calculated. */
  share: number;
};

export type SizeBand = { label: string; establishments: number };

export type Distribution = {
  naics: { code: string; label: string };
  scope: { level: "state" | "county"; stateFips: string | null; label: string };
  totals: { establishments: number; employees: number | null; annualPayroll: number | null };
  areas: AreaRow[];
  /** Establishments by employee count, for the scope as a whole. */
  sizeBands: SizeBand[];
  /** Areas in the scope with no published establishments in this industry. */
  areasWithoutData: number;
};

/** Short labels for CBP's employment-size classes, in order. */
const SIZE_CLASSES: Record<string, string> = {
  "210": "1–4",
  "220": "5–9",
  "230": "10–19",
  "241": "20–49",
  "242": "50–99",
  "251": "100–249",
  "252": "250–499",
  "254": "500–999",
  "260": "1,000+",
};

async function populations(forClause: string, inClause?: string): Promise<Map<string, number>> {
  const url = new URL(ACS);
  url.searchParams.set("get", "B01003_001E");
  url.searchParams.set("for", forClause);
  if (inClause) url.searchParams.set("in", inClause);
  const rows = await census(url);
  const out = new Map<string, number>();
  if (!rows) return out;

  const [h, ...data] = rows;
  const iPop = h.indexOf("B01003_001E");
  const iState = h.indexOf("state");
  const iCounty = h.indexOf("county");
  for (const r of data) {
    const pop = positive(r[iPop]);
    if (pop === null) continue;
    out.set(iCounty >= 0 ? `${r[iState]}${r[iCounty]}` : r[iState], pop);
  }
  return out;
}

async function sizeBands(naics: string, stateFips: string | null): Promise<SizeBand[]> {
  const url = new URL(CBP);
  url.searchParams.set("get", "EMPSZES,ESTAB");
  url.searchParams.set("for", stateFips ? `state:${stateFips}` : "us:1");
  url.searchParams.set("NAICS2017", naics);
  const rows = await census(url);
  if (!rows) return [];

  const [h, ...data] = rows;
  const iSize = h.indexOf("EMPSZES");
  const iEstab = h.indexOf("ESTAB");
  const byCode = new Map(data.map((r) => [r[iSize], positive(r[iEstab]) ?? 0]));
  return Object.entries(SIZE_CLASSES)
    .filter(([code]) => byCode.has(code))
    .map(([code, label]) => ({ label, establishments: byCode.get(code) as number }));
}

export async function getDistribution(
  naics: string,
  stateFips: string | null,
): Promise<Distribution | null> {
  const url = new URL(CBP);
  url.searchParams.set("get", "NAME,NAICS2017_LABEL,ESTAB,EMP,PAYANN");
  url.searchParams.set("NAICS2017", naics);
  if (stateFips) {
    url.searchParams.set("for", "county:*");
    url.searchParams.set("in", `state:${stateFips}`);
  } else {
    url.searchParams.set("for", "state:*");
  }

  const [rows, pops, bands] = await Promise.all([
    census(url),
    stateFips ? populations("county:*", `state:${stateFips}`) : populations("state:*"),
    sizeBands(naics, stateFips),
  ]);
  if (!rows) return null;

  const [h, ...data] = rows;
  const col = (name: string) => h.indexOf(name);
  const [iName, iLabel, iEstab, iEmp, iPay, iState, iCounty] = [
    col("NAME"), col("NAICS2017_LABEL"), col("ESTAB"), col("EMP"), col("PAYANN"), col("state"), col("county"),
  ];

  const parsed = data
    .map((r) => {
      const establishments = positive(r[iEstab]);
      if (establishments === null) return null;
      const fips = stateFips ? `${r[iState]}${r[iCounty]}` : r[iState];
      // A published establishment count with zero employees or payroll is a
      // withheld figure, not a real zero — an establishment in CBP has paid
      // employees by definition.
      const employees = positive(r[iEmp]);
      const payroll = positive(r[iPay]);
      const annualPayroll = payroll === null ? null : payroll * 1000;
      const population = pops.get(fips) ?? null;
      return {
        fips,
        name: stateFips ? r[iName].replace(/,\s*[^,]+$/, "") : r[iName],
        establishments,
        employees,
        annualPayroll,
        averageWage: employees !== null && annualPayroll !== null ? annualPayroll / employees : null,
        population,
        per10k: population ? (establishments / population) * 10000 : null,
      };
    })
    .filter((r): r is Omit<AreaRow, "share"> => r !== null);

  if (parsed.length === 0) return null;

  // Totals come from the rows themselves. Withheld employment in any area
  // means the employment total would be understated, so it is withheld too.
  const establishments = parsed.reduce((s, r) => s + r.establishments, 0);
  const anyEmpWithheld = parsed.some((r) => r.employees === null);
  const anyPayWithheld = parsed.some((r) => r.annualPayroll === null);

  const areas: AreaRow[] = parsed.map((r) => ({ ...r, share: r.establishments / establishments }));

  // Areas the Census has population for but no establishments in this industry.
  const published = new Set(areas.map((a) => a.fips));
  const areasWithoutData = [...pops.keys()].filter((f) => !published.has(f)).length;
  const label = data[0][iLabel];

  return {
    naics: { code: naics, label },
    scope: {
      level: stateFips ? "county" : "state",
      stateFips,
      // County names arrive as "Davidson County, Tennessee".
      label: stateFips ? (data[0][iName].split(",").pop()?.trim() ?? "") : "United States",
    },
    totals: {
      establishments,
      employees: anyEmpWithheld ? null : parsed.reduce((s, r) => s + (r.employees as number), 0),
      annualPayroll: anyPayWithheld ? null : parsed.reduce((s, r) => s + (r.annualPayroll as number), 0),
    },
    areas,
    sizeBands: bands,
    areasWithoutData,
  };
}

export const SECTOR_BROWSER_LIMITATIONS = [
  "Counts establishments with paid employees only. Sole proprietors and other businesses with no payroll — most very small businesses — are not included.",
  "An area missing from the list or shaded grey has no establishments published for this industry. That usually means none exist there, but very small counts can also go unpublished.",
  "Where employment or payroll is shown as withheld, the Census has suppressed it to avoid identifying individual businesses. Totals that would include a withheld figure are withheld too, rather than understated.",
  "Establishments per 10,000 residents is calculated by MicroBiz AI from Census population. In very small counties one or two businesses can swing it widely.",
  "Average wage is total payroll divided by employees, and includes part-time workers — it runs below a full-time salary.",
  "County figures within a state add up to slightly less than the state's own total. Some establishments operate statewide with no single county, and the Census publishes them at state level only.",
];
