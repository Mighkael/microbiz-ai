// app/api/sectors/route.ts
// GET /api/sectors                       → every NAICS code with its label
// GET /api/sectors?naics=722511          → that industry across all states
// GET /api/sectors?naics=722511&state=47 → across the counties of one state
//
// Sector Browser (§3). Every response is cached for a day upstream.

import { NextRequest, NextResponse } from "next/server";
import {
  listIndustries, getDistribution, SECTOR_BROWSER_LIMITATIONS,
  CBP_SOURCE, CBP_VINTAGE, POPULATION_SOURCE,
} from "@/lib/census/sectorBrowser";

export const maxDuration = 60;

const NAICS_RE = /^(\d{2,6}|\d{2}-\d{2})$/;
const STATE_RE = /^\d{2}$/;

export async function GET(req: NextRequest) {
  if (!process.env.CENSUS_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing CENSUS_API_KEY. Add it to .env.local and restart." },
      { status: 500 },
    );
  }

  const p = req.nextUrl.searchParams;
  const naics = p.get("naics")?.trim();
  const state = p.get("state")?.trim() || null;

  try {
    if (!naics) {
      const industries = await listIndustries();
      if (!industries) {
        return NextResponse.json({ error: "The Census service didn't respond. Please try again in a moment." }, { status: 502 });
      }
      return NextResponse.json({ industries, source: `${CBP_SOURCE} ${CBP_VINTAGE}` });
    }

    if (!NAICS_RE.test(naics)) {
      return NextResponse.json({ error: "That isn't a valid NAICS code." }, { status: 400 });
    }
    if (state !== null && !STATE_RE.test(state)) {
      return NextResponse.json({ error: "That isn't a valid state." }, { status: 400 });
    }

    const distribution = await getDistribution(naics, state);
    if (!distribution) {
      return NextResponse.json(
        { error: state
            ? "No establishments are published for this industry in that state."
            : "No figures are published for this industry." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ...distribution,
      source: `${CBP_SOURCE} ${CBP_VINTAGE}; population from ${POPULATION_SOURCE}.`,
      limitations: SECTOR_BROWSER_LIMITATIONS,
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong loading this industry. Please try again." }, { status: 500 });
  }
}
