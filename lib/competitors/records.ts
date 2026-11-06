/**
 * Published ratings and complaints about businesses, where the government
 * publishes them.
 *
 * The honest position, stated here once and repeated on screen: there is no
 * free public dataset of customer ratings for ordinary local businesses.
 * Restaurants, shops, salons and trades are rated on Google, Yelp and
 * Facebook, and those companies own that data and charge for access to it.
 * Anyone offering you "ratings for every business in your area" for nothing
 * is either scraping in breach of terms or making it up.
 *
 * Two federal sources do publish real, named, comparable records:
 *
 *   - CMS rates every Medicare-certified nursing home and home health agency
 *     in the country on a five-star scale, and counts substantiated
 *     complaints and fines against nursing homes.
 *   - The CFPB publishes every consumer complaint about financial products,
 *     naming the company, the issue, and whether the company answered on
 *     time — down to ZIP code.
 *
 * Everything else routes to the review analyser, which works on reviews the
 * owner collects themselves.
 *
 * Server-only.
 */

const DAY = 86400;
/** Several federal services reject anonymous clients outright. */
const UA = "MicroBizAI/1.0 (https://www.microbiz-ai.com)";

export type RatedProvider = {
  name: string;
  city: string;
  /** Out of five, where CMS publishes one. */
  rating: number | null;
  /** Deficiencies found after someone complained — not a count of complaints. */
  complaintDeficiencies: number | null;
  fines: number | null;
  finesDollars: number | null;
};

export type CmsSector = {
  key: string;
  label: string;
  /** What the stars measure, in CMS's own terms. */
  ratingMeans: string;
  providers: RatedProvider[];
  averageRating: number | null;
  /** Rated at or below two stars — where the openings are. */
  weakest: RatedProvider[];
  source: string;
};

export type ComplaintIssue = { issue: string; count: number };
export type ComplaintCompany = { company: string; count: number };

export type FinancialComplaints = {
  area: string;
  total: number;
  since: string;
  topIssues: ComplaintIssue[];
  topCompanies: ComplaintCompany[];
  /** Share the company answered within the deadline. */
  timelyPercent: number | null;
  /** How companies responded, most common first. */
  responses: { response: string; count: number }[];
  source: string;
};

/* ------------------------------------------------------------------ */
/* CMS — healthcare providers                                          */
/* ------------------------------------------------------------------ */

const CMS_BASE = "https://data.cms.gov/provider-data/api/1/datastore/query";
const CMS_SOURCE = "Centers for Medicare & Medicaid Services — Provider Data Catalog";

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "" || v === "Not Available") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function cmsQuery(dataset: string, state: string, limit = 500): Promise<Record<string, string>[]> {
  const url = new URL(`${CMS_BASE}/${dataset}/0`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("conditions[0][property]", "state");
  url.searchParams.set("conditions[0][value]", state);
  url.searchParams.set("conditions[0][operator]", "=");

  // CMS refuses requests with no User-Agent, and does it with a 403 HTML page
  // rather than JSON — which looks like "no providers here" if unchecked.
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate: DAY * 7 },
  });
  if (!res.ok) return [];
  try {
    return ((await res.json()) as { results?: Record<string, string>[] }).results ?? [];
  } catch {
    return [];
  }
}

const sameCounty = (row: Record<string, string>, county: string, city: string) => {
  const rowCounty = (row.countyparish ?? "").toLowerCase();
  const rowCity = (row.citytown ?? "").toLowerCase();
  return (county && rowCounty === county.toLowerCase()) || (city && rowCity === city.toLowerCase());
};

/**
 * Nursing homes and home health agencies in and around the owner's county.
 * Falls back to the whole state when a county has too few to compare.
 */
export async function getCmsRatings(stateAbbr: string, county: string, city: string): Promise<CmsSector[]> {
  const [homes, agencies] = await Promise.all([
    cmsQuery("4pq5-n9py", stateAbbr).catch(() => []),
    cmsQuery("6jpm-sxkc", stateAbbr).catch(() => []),
  ]);

  const build = (
    key: string, label: string, ratingMeans: string, rows: Record<string, string>[],
    ratingField: string, hasComplaints: boolean,
  ): CmsSector | null => {
    const local = rows.filter((r) => sameCounty(r, county, city));
    // A county with one or two providers tells you nothing; widen to the state.
    const used = local.length >= 3 ? local : rows;

    const providers: RatedProvider[] = used
      .map((r) => ({
        name: r.provider_name ?? "Unnamed",
        city: r.citytown ?? "",
        rating: num(r[ratingField]),
        complaintDeficiencies: hasComplaints
          ? (num(r.rating_cycle_1_number_of_complaint_health_deficiencies) ?? 0)
            + (num(r.rating_cycle_23_number_of_complaint_health_deficiencies) ?? 0)
          : null,
        fines: hasComplaints ? num(r.number_of_fines) : null,
        finesDollars: hasComplaints ? num(r.total_amount_of_fines_in_dollars) : null,
      }))
      .filter((p) => p.rating != null || p.complaintDeficiencies != null);

    if (providers.length === 0) return null;

    const rated = providers.filter((p) => p.rating != null);
    const averageRating = rated.length
      ? Math.round((rated.reduce((s, p) => s + (p.rating as number), 0) / rated.length) * 10) / 10
      : null;

    return {
      key,
      label: local.length >= 3 ? label : `${label} (statewide — too few nearby to compare)`,
      ratingMeans,
      providers: providers.sort((a, b) => (a.rating ?? 9) - (b.rating ?? 9)).slice(0, 40),
      averageRating,
      weakest: rated.filter((p) => (p.rating as number) <= 2).sort((a, b) => (a.rating as number) - (b.rating as number)).slice(0, 10),
      source: CMS_SOURCE,
    };
  };

  return [
    build("nursing", "Nursing homes", "CMS's overall five-star rating, combining health inspections, staffing and quality measures.", homes, "overall_rating", true),
    build("homehealth", "Home health agencies", "CMS's quality of patient care star rating.", agencies, "quality_of_patient_care_star_rating", false),
  ].filter((s): s is CmsSector => s !== null);
}

/* ------------------------------------------------------------------ */
/* CFPB — financial complaints                                         */
/* ------------------------------------------------------------------ */

const CFPB_URL = "https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/";
const CFPB_SOURCE = "Consumer Financial Protection Bureau — Consumer Complaint Database";

type Bucket = { key: string; doc_count: number };
type CfpbResponse = {
  hits?: { total?: { value?: number } };
  aggregations?: Record<string, Record<string, { buckets?: Bucket[] }>>;
};

export async function getFinancialComplaints(zip: string | null, stateAbbr: string, since: string): Promise<FinancialComplaints | null> {
  const url = new URL(CFPB_URL);
  url.searchParams.set("size", "0");
  url.searchParams.set("date_received_min", since);
  if (zip) url.searchParams.set("zip_code", zip);
  else url.searchParams.set("state", stateAbbr);

  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate: DAY },
  });
  if (!res.ok) return null;

  let data: CfpbResponse;
  try {
    data = (await res.json()) as CfpbResponse;
  } catch {
    return null;
  }

  const total = data.hits?.total?.value ?? 0;
  if (total === 0) return null;

  const buckets = (name: string): Bucket[] => data.aggregations?.[name]?.[name]?.buckets ?? [];
  const timely = buckets("timely");
  const onTime = timely.find((b) => /^yes$/i.test(b.key))?.doc_count ?? 0;
  const timelyTotal = timely.reduce((s, b) => s + b.doc_count, 0);

  return {
    area: zip ? `ZIP ${zip}` : stateAbbr,
    total,
    since,
    topIssues: buckets("issue").slice(0, 8).map((b) => ({ issue: b.key, count: b.doc_count })),
    topCompanies: buckets("company").slice(0, 8).map((b) => ({ company: b.key, count: b.doc_count })),
    timelyPercent: timelyTotal ? Math.round((onTime / timelyTotal) * 1000) / 10 : null,
    responses: buckets("company_response").slice(0, 6).map((b) => ({ response: b.key, count: b.doc_count })),
    source: CFPB_SOURCE,
  };
}

/* ------------------------------------------------------------------ */

/** Which published source, if any, covers a given industry. */
export function coverageFor(industry: string): "cms" | "cfpb" | "none" {
  if (industry === "Healthcare") return "cms";
  if (industry === "Professional services") return "cfpb";
  return "none";
}

export const NO_PUBLIC_RATINGS_NOTE =
  "No government body collects customer ratings for ordinary local businesses — restaurants, shops, salons, trades. " +
  "Those live on Google, Yelp and Facebook, which own them and charge for access. Rather than show you numbers we " +
  "can't stand behind, the next tab turns reviews you collect yourself into a ranked list of what competitors keep " +
  "getting wrong.";

export const RECORD_LIMITATIONS = [
  "These are regulators' records, not customer ratings. They say how a provider performed against the rules and surveys the agency uses, which is not the same as how it feels to be a customer.",
  "Star ratings are relative: CMS grades on a curve, so one star doesn't mean failing and five doesn't mean flawless.",
  "A business with no complaints on file may simply be one nobody has reported. Absence of a record is not evidence of quality.",
];
