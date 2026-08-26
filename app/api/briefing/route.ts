// app/api/briefing/route.ts
// POST /api/briefing  { kind: 'news' | 'markets' | 'world' | 'opportunities', industry, location }
//
// Trimmed-down version of the starter kit's briefing route: uses Claude's web
// search tool for live headlines, index levels, and opportunities, but drops
// the Supabase auth and the 6-hour shared cache table since this build has no
// login or database yet. See docs/backend-reference/ to restore those later.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPTS: Record<string, (industry: string, location: string) => string> = {
  news: (i, l) =>
    `Search the web for today's most important US small-business news (policy, SBA programs, lending rates, main-street trends). Summarize the top 5 items in plain language for a ${i} business in ${l}, with one line on why each matters to them.`,
  markets: () =>
    `Search the web for the current level and 1-month trend of the Russell 2000 index, the current prime rate and typical SBA 7(a) rate range, and one notable small-cap market story. Explain briefly for a non-expert business owner.`,
  world: () =>
    `Search the web for notable recent global small-business/SME news across major and emerging markets. Give 5 short items with why each matters.`,
  opportunities: (i, l) =>
    `Search the web for new and developing small-business opportunities in 2026 relevant to a ${i} business in ${l}. Give 5 specific opportunities with why now, rough startup cost, and a concrete first step.`,
};

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing ANTHROPIC_API_KEY. Add it to .env.local and restart the dev server." },
      { status: 500 },
    );
  }

  const { kind, industry, location } = await req.json();
  const buildPrompt = PROMPTS[kind];
  if (!buildPrompt) {
    return NextResponse.json({ error: "Unknown briefing kind." }, { status: 400 });
  }

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: buildPrompt(industry || "general", location || "the US") }],
      tools: [{ type: "web_search_20250305" as const, name: "web_search", max_uses: 5 }],
    });

    const content = msg.content.map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n");

    // Pull real headline + URL pairs out of the actual search results Claude
    // used (not out of its prose, which can misquote or invent link text).
    const sources: { url: string; title: string }[] = [];
    const seen = new Set<string>();
    for (const block of msg.content) {
      if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
      for (const result of block.content) {
        if (result.type === "web_search_result" && !seen.has(result.url)) {
          seen.add(result.url);
          sources.push({ url: result.url, title: result.title });
        }
      }
    }

    return NextResponse.json({ content, sources: sources.slice(0, 8) });
  } catch (err) {
    console.error("Briefing request failed:", err);
    return NextResponse.json({ error: "Claude request failed. Check your ANTHROPIC_API_KEY and try again." }, { status: 502 });
  }
}
