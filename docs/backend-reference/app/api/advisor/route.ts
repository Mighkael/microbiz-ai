// app/api/advisor/route.ts
// Next.js App Router API route (POST /api/advisor)
//
// Why this exists: the browser must NEVER hold your Anthropic API key.
// The frontend sends { businessId, message }; this route:
//   1. verifies the logged-in user owns that business (auth + RLS)
//   2. enforces a per-user daily usage cap
//   3. builds the advisor prompt from real DB metrics
//   4. streams Claude's answer back and logs the conversation

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr"; // or your auth of choice
import { cookies } from "next/headers";
import { computeMetrics } from "@/lib/metrics";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const DAILY_REQUEST_CAP = 40; // free tier; read from user's plan in production

export async function POST(req: NextRequest) {
  // ---------- 1. Authenticate ----------
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { businessId, conversationId, message } = await req.json();
  if (!message?.trim() || message.length > 4000) {
    return NextResponse.json({ error: "Message is required (max 4000 chars)." }, { status: 400 });
  }

  // ---------- 2. Ownership check (RLS also enforces this) ----------
  const { data: business } = await supabase
    .from("businesses").select("*").eq("id", businessId).single();
  if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });

  // ---------- 3. Usage cap ----------
  const today = new Date().toISOString().slice(0, 10);
  const { data: usage } = await supabase
    .from("ai_usage").select("requests").eq("owner_id", user.id).eq("day", today).maybeSingle();
  if ((usage?.requests ?? 0) >= DAILY_REQUEST_CAP) {
    return NextResponse.json(
      { error: "Daily advisor limit reached. Upgrade for unlimited conversations." },
      { status: 429 },
    );
  }

  // ---------- 4. Build context from real data ----------
  const { data: months } = await supabase
    .from("monthly_financials").select("*")
    .eq("business_id", businessId).order("period", { ascending: true });

  const metrics = computeMetrics(
    { industry: business.industry, employees: business.employees, founded_year: business.founded_year },
    months ?? [],
  );

  const { data: history } = conversationId
    ? await supabase.from("ai_messages").select("role, content")
        .eq("conversation_id", conversationId).order("created_at").limit(20)
    : { data: [] };

  const system = [
    "You are MicroBiz AI, an expert small-business advisor. Be specific, practical, and concise.",
    "Prioritize recommendations; use plain language; show simple math when it helps.",
    "You are not a licensed financial, legal, or tax professional — say so when a question needs one.",
    `BUSINESS: ${business.name} | ${business.industry} | ${business.location_city ?? ""}, ${business.location_state ?? "US"} | ${business.employees} employees | financing need: ${business.financing_need ?? "none"}`,
    `CHALLENGES: marketing — ${business.marketing_challenge ?? "n/a"}; operations — ${business.operational_challenge ?? "n/a"}`,
    `METRICS (trailing ${metrics.monthsOfData} months): revenue $${metrics.revenue.toFixed(0)}, net margin ${(metrics.netMargin * 100).toFixed(1)}% (industry avg ${(metrics.benchmark.margin * 100).toFixed(0)}%), monthly cash flow $${metrics.monthlyCashFlow.toFixed(0)}, break-even $${metrics.breakEvenRevenue?.toFixed(0) ?? "n/a"}, cash $${metrics.latestCash.toFixed(0)}, runway ${metrics.runwayMonths?.toFixed(1) ?? "self-sustaining"} months, health score ${metrics.healthScore}/100, credit readiness ${metrics.creditReadiness}/5.`,
  ].join("\n");

  // ---------- 5. Call Claude (streaming) ----------
  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system,
    messages: [
      ...(history ?? []).map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user", content: message },
    ],
  });

  // ---------- 6. Persist + meter, then relay the stream ----------
  const encoder = new TextEncoder();
  let full = "";

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            full += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } finally {
        controller.close();
        // Fire-and-forget persistence (don't block the response)
        const convoId = conversationId ?? (await supabase
          .from("ai_conversations")
          .insert({ business_id: businessId, title: message.slice(0, 60) })
          .select("id").single()).data?.id;
        if (convoId) {
          await supabase.from("ai_messages").insert([
            { conversation_id: convoId, role: "user", content: message },
            { conversation_id: convoId, role: "assistant", content: full },
          ]);
        }
        await supabase.rpc("increment_ai_usage", { p_owner: user.id }); // simple upsert function
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Conversation-Id": conversationId ?? "" },
  });
}
