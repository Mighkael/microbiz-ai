// app/api/feasibility/route.ts
// POST /api/feasibility  { location, industry, expectedRevenue, employees, startupCapital }
//
// Feasibility & Viability study (§6): tests a prospective business's own
// assumptions against what the chosen market demonstrably supports.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getLocationProfile, getNationalReference } from "@/lib/census/location";
import { resolveGeography } from "@/lib/census/geography";
import { naicsForIndustry } from "@/lib/census/naics";
import { scoreLocation } from "@/lib/locationScore";
import { assessFeasibility } from "@/lib/feasibility";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * The summary is written from the computed figures only. Per §21, the AI
 * layer interprets numbers the analytics layer produced — it is never the
 * source of a number itself.
 */
async function writeSummary(
  facts: string[], sectorLabel: string, where: string, outlook: string,
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const system = [
    "You are MicroBiz AI, writing the executive summary of a feasibility study for a prospective small-business owner.",
    "Write 3-4 sentences of flowing prose in plain language. Be direct about risk without being discouraging.",
    "Do not add a heading, title, or bullet list — the page supplies its own heading.",
    "CRITICAL: use only the figures provided. Do not introduce any number, statistic, cost or forecast that is not in the facts given.",
    "Do not promise success, predict profit, or estimate startup costs — none of that is in the data.",
    "You are not a licensed financial or legal adviser; the study is educational.",
  ].join("\n");

  const prompt = [
    `Sector: ${sectorLabel}`,
    `Market: ${where}`,
    `Overall reading from the checks: ${outlook}`,
    "",
    "Findings:",
    ...facts.map((f) => `- ${f}`),
  ].join("\n");

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    return msg.content.map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n") || null;
  } catch (err) {
    console.error("Feasibility summary failed:", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.CENSUS_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing CENSUS_API_KEY. Add it to .env.local and restart." },
      { status: 500 },
    );
  }

  const body = await req.json();
  const location = String(body.location ?? "").trim();
  const industry = String(body.industry ?? "Other").trim();
  const expectedRevenue = Number(body.expectedRevenue) || 0;
  const employees = Number(body.employees) || 0;
  const startupCapital = Number(body.startupCapital) || 0;

  if (location.length < 3) {
    return NextResponse.json({ error: "A target location is required." }, { status: 400 });
  }

  try {
    const sector = naicsForIndustry(industry);
    const anchor = await resolveGeography(location);
    if (!anchor) {
      return NextResponse.json(
        { error: `Couldn't find "${location}". Try a city and state, or a 5-digit ZIP code.` },
        { status: 404 },
      );
    }

    const [national, profile] = await Promise.all([
      getNationalReference(anchor, sector),
      getLocationProfile(location, sector),
    ]);

    if (!profile) {
      return NextResponse.json({ error: "No county-level data available for that location." }, { status: 404 });
    }

    const score = scoreLocation(profile, national);
    const result = assessFeasibility(
      { expectedRevenue, employees, startupCapital },
      profile, national, score,
    );

    const summary = await writeSummary(
      result.summaryFacts, sector.label, profile.geography.label, result.outlook,
    );

    return NextResponse.json({ sector, profile, score, result, summary });
  } catch (err) {
    console.error("Feasibility study failed:", err);
    return NextResponse.json({ error: "Feasibility study failed. Please try again." }, { status: 502 });
  }
}
