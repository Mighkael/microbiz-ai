// app/api/briefing/route.ts
// POST /api/briefing  { kind: 'news' | 'markets' | 'world' | 'opportunities', businessId }
//
// Uses Claude's web search tool for live headlines, index levels, and rates.
// Briefings are cached per (kind, industry, state) for 6 hours so 1,000 users
// don't trigger 1,000 identical searches — this is your biggest cost lever.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const CACHE_HOURS = 6;

const PROMPTS: Record<string, (industry: string, state: string) => string> = {
  news: (i, s) =>
    `Search the web for today's most important US small-business news (policy, SBA programs, lending rates, main-street trends). Summarize the top 5 items in plain language for a ${i} business in ${s}, with one line on why each matters to them.`,
  markets: () =>
    `Search the web for the current level and 1-month trend of the Russell 2000 index, the current prime rate and typical SBA 7(a) rate range, and one notable small-cap market story. Explain briefly for a non-expert business owner.`,
  world: () =>
    `Search the web for notable recent global small-business/SME news across major and emerging markets. Give 5 short items with why each matters.`,
  opportunities: (i, s) =>
    `Search the web for new and developing small-business opportunities in 2026 relevant to a ${i} business in ${s}. Give 5 specific opportunities with why now, rough startup cost, and a concrete first step.`,
};

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { kind, businessId } = await req.json();
  if (!PROMPTS[kind]) return NextResponse.json({ error: "Unknown briefing kind." }, { status: 400 });

  const { data: business } = await supabase
    .from("businesses").select("industry, location_state").eq("id", businessId).single();
  const industry = business?.industry ?? "general";
  const state = business?.location_state ?? "US";

  // ---------- cache lookup (table: briefing_cache(kind, industry, state, content, created_at)) ----------
  const cutoff = new Date(Date.now() - CACHE_HOURS * 3600_000).toISOString();
  const { data: cached } = await supabase
    .from("briefing_cache").select("content, created_at")
    .eq("kind", kind).eq("industry", industry).eq("state", state)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (cached) {
    return NextResponse.json({ content: cached.content, cached: true, asOf: cached.created_at });
  }

  // ---------- live call with web search ----------
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [{ role: "user", content: PROMPTS[kind](industry, state) }],
    tools: [{ type: "web_search_20250305" as const, name: "web_search", max_uses: 5 }],
  });

  const content = msg.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .filter(Boolean)
    .join("\n");

  await supabase.from("briefing_cache").insert({ kind, industry, state, content });

  return NextResponse.json({ content, cached: false, asOf: new Date().toISOString() });
}

/* Add to schema.sql:
create table if not exists briefing_cache (
  id uuid primary key default gen_random_uuid(),
  kind text not null, industry text not null, state text not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index on briefing_cache (kind, industry, state, created_at desc);
*/
