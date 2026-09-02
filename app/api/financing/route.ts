// app/api/financing/route.ts
// GET /api/financing?keyword=...&status=posted
//
// Financing Finder (§11). Live federal funding opportunities from
// Grants.gov, filtered to those small businesses are eligible for.

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const GRANTS_API = "https://api.grants.gov/v1/api/search2";
/** Grants.gov eligibility code for "Small businesses". */
const SMALL_BUSINESS = "23";

type OppHit = {
  id?: string;
  number?: string;
  title?: string;
  agency?: string;
  agencyCode?: string;
  openDate?: string;
  closeDate?: string;
  oppStatus?: string;
};

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const keyword = p.get("keyword")?.trim() ?? "";
  const status = p.get("status") === "forecasted" ? "forecasted" : "posted";

  try {
    const res = await fetch(GRANTS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: 25,
        keyword,
        eligibilities: SMALL_BUSINESS,
        oppStatuses: status,
      }),
      // Postings change daily; an hour keeps it fresh without hammering them.
      next: { revalidate: 3600 },
    });

    if (!res.ok) throw new Error(`Grants.gov returned ${res.status}`);
    const json = await res.json();
    const data = json?.data ?? {};

    const opportunities = (data.oppHits ?? []).map((o: OppHit) => ({
      id: o.id ?? o.number ?? "",
      number: o.number ?? "",
      title: o.title ?? "Untitled opportunity",
      agency: o.agency ?? o.agencyCode ?? "",
      openDate: o.openDate ?? null,
      closeDate: o.closeDate ?? null,
      status: o.oppStatus ?? status,
      url: o.id ? `https://www.grants.gov/search-results-detail/${o.id}` : "https://www.grants.gov",
    }));

    return NextResponse.json({
      total: data.hitCount ?? opportunities.length,
      showing: opportunities.length,
      opportunities,
      source: "Grants.gov — US federal funding opportunities, filtered to those listing small businesses as eligible.",
      limitations: [
        "Federal opportunities only. State, county and city programmes are not in this database and must be found separately.",
        "Listing an opportunity is not a statement that you qualify. Eligibility rules are specific and are set out in each announcement.",
        "SBA loan programmes are not grants and do not appear here — see the Funding tab for those.",
      ],
    });
  } catch (err) {
    console.error("Financing lookup failed:", err);
    return NextResponse.json(
      { error: "Couldn't reach Grants.gov. Please try again shortly." },
      { status: 502 },
    );
  }
}
