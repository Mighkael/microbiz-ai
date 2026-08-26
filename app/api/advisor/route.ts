// app/api/advisor/route.ts
// POST /api/advisor  { profile, metrics, message, history }
//
// This is a trimmed-down version of the starter kit's advisor route: it keeps
// the important part (the Anthropic key lives only on the server, never in
// the browser) and drops the Supabase auth / ownership / usage-cap / logging
// pieces from the original, since this build has no login or database yet.
// See docs/backend-reference/ for the full production route to restore next.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type Profile = {
  industry: string;
  location: string;
  financing: string;
  marketing: string;
  operations: string;
};

type Metrics = {
  rev: number; exp: number; cash: number; emp: number; age: number;
  margin: number; mCash: number; breakEven: number; score: number;
  bench: { margin: number };
};

type HistoryMessage = { role: "user" | "ai"; text: string };

// `Infinity` (a "self-sustaining" cash flow or already-past-break-even) has
// no JSON representation — it arrives here as `null` after crossing the
// network, not as Infinity. Treat any non-finite/missing number as "n/a"
// rather than crashing on it.
function fmt(n: unknown) {
  return typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "n/a";
}

function buildSystemPrompt(p: Profile, m: Metrics) {
  return [
    "You are MicroBiz AI, an expert small-business advisor. Be specific, practical, and concise.",
    "Prioritize recommendations; use plain language; show simple math when it helps.",
    "You are not a licensed financial, legal, or tax professional — say so when a question needs one.",
    `BUSINESS: ${p.industry} | ${p.location || "US"} | ${m.emp} employees | ${m.age} years old | financing need: ${p.financing}`,
    `CHALLENGES: marketing — ${p.marketing || "not specified"}; operations — ${p.operations || "not specified"}`,
    `METRICS: annual revenue ${fmt(m.rev)}, annual expenses ${fmt(m.exp)}, net margin ${(m.margin * 100).toFixed(1)}% (industry avg ${(m.bench.margin * 100).toFixed(0)}%), monthly cash flow ${fmt(m.mCash)}, break-even revenue ${fmt(m.breakEven)}, cash on hand ${fmt(m.cash)}, health score ${m.score}/100.`,
  ].join("\n");
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing ANTHROPIC_API_KEY. Add it to .env.local and restart the dev server." },
      { status: 500 },
    );
  }

  const { profile, metrics, message, history } = await req.json();

  if (!message || typeof message !== "string" || !message.trim() || message.length > 4000) {
    return NextResponse.json({ error: "Message is required (max 4000 characters)." }, { status: 400 });
  }

  const system = buildSystemPrompt(profile as Profile, metrics as Metrics);
  const convo: HistoryMessage[] = Array.isArray(history) ? history : [];

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system,
      messages: [
        ...convo.map((h) => ({ role: (h.role === "user" ? "user" : "assistant") as "user" | "assistant", content: h.text })),
        { role: "user" as const, content: message },
      ],
    });

    const reply = msg.content.map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n");
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Advisor request failed:", err);
    return NextResponse.json({ error: "Claude request failed. Check your ANTHROPIC_API_KEY and try again." }, { status: 502 });
  }
}
