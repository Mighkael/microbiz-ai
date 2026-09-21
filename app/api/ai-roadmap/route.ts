// app/api/ai-roadmap/route.ts
// POST /api/ai-roadmap  { context, answers }  →  { plan, summary }
//
// The plan is built entirely by lib/aiReadiness.ts from the owner's answers.
// Claude only writes a short plain-language summary, and is given nothing but
// the plan's `summaryFacts` to write it from. If Claude is unavailable the
// plan is returned with `summary: null` — it is complete without one.

import { NextRequest, NextResponse } from "next/server";
import { buildAdoptionPlan, type ReadinessContext } from "@/lib/aiReadiness";
import { INDUSTRIES } from "@/lib/data";
import { claude, hasApiKey, MODEL, FALLBACK_BETA } from "@/lib/ai/claude";

export const maxDuration = 60;

const SYSTEM = [
  "You write a short, plain-language summary of an AI adoption plan for a small-business owner in the United States.",
  "Many readers run very small businesses in under-served neighborhoods; some have never used AI or business software.",
  "",
  "Use only the facts you are given. Do not add tools, products, prices, statistics, time or money savings, or any",
  "recommendation that is not in the facts. Mention the readiness score only as a starting point, never as a grade.",
  "",
  "Write two short paragraphs, addressed to the owner as \"you\", at about an 8th-grade reading level: first where",
  "their business stands and why the plan starts where it does; then the first use to try and how they will know it",
  "is working. Warm and direct. No headings, lists, bold text or exclamation marks.",
].join("\n");

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Server-side: rebuild the context from known fields rather than trusting the browser's object. */
function normalizeContext(raw: unknown): ReadinessContext | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const industry = str(r.industry, 80);
  if (!(industry in INDUSTRIES)) return null;
  const employees = Number(r.employees);
  return {
    industry,
    employees: Number.isFinite(employees) && employees >= 0 ? Math.min(Math.round(employees), 100000) : 0,
    location: str(r.location, 120),
    marketing: str(r.marketing, 500),
    operations: str(r.operations, 500),
  };
}

async function writeSummary(facts: string[]): Promise<string | null> {
  const response = await claude().beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system: SYSTEM,
    messages: [{ role: "user", content: `Facts about this plan:\n${facts.map((f) => `- ${f}`).join("\n")}` }],
  });
  if (response.stop_reason === "refusal") return null;
  const text = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  return text || null;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request couldn't be read." }, { status: 400 });
  }

  const context = normalizeContext(body.context);
  if (!context) {
    return NextResponse.json({ error: "Choose your industry before building the plan." }, { status: 400 });
  }

  const plan = buildAdoptionPlan(body.answers, context);

  let summary: string | null = null;
  if (hasApiKey()) {
    try {
      summary = await writeSummary(plan.summaryFacts);
    } catch (err) {
      // The plan stands on its own; the summary is a courtesy.
      console.error("AI roadmap summary failed:", err);
    }
  }

  return NextResponse.json({ plan, summary });
}
