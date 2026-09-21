// app/api/agent/route.ts
// POST /api/agent  { role, message, history, data, profile, today }
//
// The MicroBiz Agent's assistant. The browser sends the owner's workspace; the
// server re-applies the owner's sharing choices before anything reaches the
// model, runs the monitoring engine on what's left, and answers in the chosen
// role — with the same Census tools as the original advisor.

import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { TOOLS, runTool } from "@/lib/ai/tools";
import { claude, hasApiKey, MODEL, FALLBACK_BETA, echoableContent } from "@/lib/ai/claude";
import { ROLES, sanitizeAgentData, redactForAssistant, type AssistantRole } from "@/lib/agent/types";
import { analyze } from "@/lib/agent/analysis";
import { briefing, type ProfileSummary } from "@/lib/agent/prompts";

/** Tool rounds chain Census calls, and the model thinks before answering. */
export const maxDuration = 120;

const MAX_TOOL_ROUNDS = 4;
const MAX_HISTORY = 20;

type HistoryMessage = { role: "user" | "ai"; text: string };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function sanitizeProfile(raw: unknown): ProfileSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    industry: str(r.industry, 80), location: str(r.location, 120), employees: str(r.employees, 20),
    age: str(r.age, 20), revenue: str(r.revenue, 30), expenses: str(r.expenses, 30), cash: str(r.cash, 30),
    marketing: str(r.marketing, 500), operations: str(r.operations, 500),
  };
}

function isoToday(raw: unknown): string {
  const s = str(raw, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : new Date().toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  if (!hasApiKey()) {
    return NextResponse.json({ error: "The assistant isn't configured on this server yet." }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request couldn't be read." }, { status: 400 });
  }

  const message = str(body.message, 4000);
  if (!message) return NextResponse.json({ error: "Please type a question." }, { status: 400 });

  const role: AssistantRole = ROLES.some((r) => r.key === body.role) ? (body.role as AssistantRole) : "executive";
  const today = isoToday(body.today);

  // Re-apply the owner's sharing choices here too: the browser is not trusted.
  const data = redactForAssistant(sanitizeAgentData(body.data, +today.slice(0, 4)));
  const profile = data.permissions.profile ? sanitizeProfile(body.profile) : null;
  const analysis = data.permissions.financials || data.permissions.obligations ? analyze(data, today) : null;

  const system = briefing(role, data, analysis, profile, today);

  const history: HistoryMessage[] = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history
      .filter((h) => h && typeof h.text === "string" && h.text.trim())
      .map((h) => ({ role: (h.role === "user" ? "user" : "assistant") as "user" | "assistant", content: h.text.slice(0, 8000) })),
    { role: "user", content: message },
  ];
  // The API requires the conversation to open with the owner.
  while (messages.length && messages[0].role !== "user") messages.shift();

  const evidence: { tool: string; input: Record<string, unknown> }[] = [];
  const text = (content: Anthropic.Beta.BetaContentBlock[]) =>
    content.map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n").trim();

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const lastRound = round === MAX_TOOL_ROUNDS;
      const response = await claude().beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        system,
        tools: TOOLS,
        // On the last round, answer from what has been gathered. The tools stay
        // declared because the conversation already contains tool calls.
        ...(lastRound ? { tool_choice: { type: "none" as const } } : {}),
        messages,
      });

      if (response.stop_reason === "refusal") {
        return NextResponse.json({ reply: "I can't help with that one. Try asking it a different way.", evidence });
      }
      if (response.stop_reason !== "tool_use") {
        return NextResponse.json({ reply: text(response.content) || "No answer came back — please try again.", evidence });
      }

      const toolUses = response.content.filter(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
      );
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(
        toolUses.map(async (t) => {
          const input = (t.input ?? {}) as Record<string, unknown>;
          evidence.push({ tool: t.name, input });
          try {
            return { type: "tool_result" as const, tool_use_id: t.id, content: JSON.stringify(await runTool(t.name, input)) };
          } catch (err) {
            console.error(`Agent tool ${t.name} failed:`, err);
            return {
              type: "tool_result" as const, tool_use_id: t.id, is_error: true,
              content: "That data lookup failed. Say so rather than guessing the figures.",
            };
          }
        }),
      );

      messages.push({ role: "assistant", content: echoableContent(response.content) });
      messages.push({ role: "user", content: results });
    }
    return NextResponse.json({ reply: "That took too many steps — please ask a narrower question.", evidence });
  } catch (err) {
    console.error("Agent request failed:", err);
    return NextResponse.json({ error: "The assistant couldn't answer just now. Please try again." }, { status: 502 });
  }
}
