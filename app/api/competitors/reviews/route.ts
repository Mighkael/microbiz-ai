// app/api/competitors/reviews/route.ts
// POST /api/competitors/reviews  { industry, area, competitor, text }
//
// Turns reviews the owner has collected into a ranked list of what
// competitors keep getting wrong, and what to do about it.
//
// The owner supplies the text. MicroBiz AI does not scrape Google, Yelp or
// Facebook: their terms forbid it, and a tool that breaks them puts the
// owner's own listings at risk. Reading public reviews and pasting them is
// ordinary market research.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { structured, hasApiKey } from "@/lib/ai/claude";
import { INDUSTRIES } from "@/lib/data";

export const maxDuration = 90;

const MAX_TEXT = 40000;

const AnalysisSchema = z.object({
  reviewsSeen: z.number().describe("How many separate reviews you can distinguish in the text. Be conservative."),
  overallRead: z.string().describe("Two sentences: what these customers mostly complain about, and what that says about the gap in this market."),
  complaints: z.array(z.object({
    theme: z.string().describe("The complaint in six words or fewer, e.g. 'Nobody answers the phone'."),
    mentions: z.number().describe("How many of the reviews raise this. Count only what is actually there."),
    severity: z.enum(["high", "medium", "low"]).describe("high = people say they left or warned others; medium = clear annoyance; low = a passing gripe."),
    quotes: z.array(z.string()).describe("One to three short quotes copied word for word from the text. Never paraphrase, never invent."),
    whatToDo: z.string().describe("One or two sentences: the specific, cheap thing this business could do so customers don't say this about them."),
  })).describe("Ranked, most important first. Up to six."),
  praised: z.array(z.object({
    theme: z.string(),
    note: z.string().describe("One sentence on what you'd have to match to compete."),
  })).describe("What these competitors are praised for — the table stakes. Up to three."),
  positioning: z.object({
    promises: z.array(z.string()).describe("Three specific promises this owner could make that answer the top complaints. Each must be something a small business can actually deliver."),
    proof: z.array(z.string()).describe("Two or three ways to prove each promise to a sceptical customer before they buy."),
    profileLine: z.string().describe("One sentence under 150 characters for their Google Business Profile description, built from the gap found."),
  }),
});

const SYSTEM = [
  "You analyse customer reviews of competing businesses for a small-business owner deciding how to position against them.",
  "",
  "Strict rules, because this feeds real decisions:",
  "- Use only the text provided. Every quote must appear in it word for word. If you cannot quote it, do not claim it.",
  "- Count honestly. If three reviews mention slow service, say three — never round up, never estimate a percentage.",
  "- If the text is thin, or is mostly praise, say so in overallRead and return fewer complaints rather than padding.",
  "- Never name a business the text does not name, and never infer who the owner should be told to attack.",
  "- Advice must suit a very small business with little money: things like answering the phone, posting opening hours,",
  "  confirming appointments, written quotes. Not software purchases or hiring.",
  "- Plain language, no marketing jargon, no exclamation marks.",
].join("\n");

export async function POST(req: NextRequest) {
  if (!hasApiKey()) {
    return NextResponse.json({ error: "Analysis isn't configured on this server yet." }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request couldn't be read." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
  const industry = typeof body.industry === "string" && body.industry in INDUSTRIES ? body.industry : "";
  const area = typeof body.area === "string" ? body.area.trim().slice(0, 120) : "";
  const competitor = typeof body.competitor === "string" ? body.competitor.trim().slice(0, 160) : "";

  if (text.length < 120) {
    return NextResponse.json(
      { error: "Paste a few reviews first — at least a short paragraph or two. Five or more reviews gives a much better read." },
      { status: 400 },
    );
  }

  try {
    const analysis = await structured({
      schema: AnalysisSchema,
      system: SYSTEM,
      prompt: [
        `Industry the owner is in: ${industry || "not stated"}`,
        `Area: ${area || "not stated"}`,
        `Business these reviews are about: ${competitor || "not stated — may be several"}`,
        "",
        "Reviews:",
        text,
      ].join("\n"),
      effort: "medium",
      maxTokens: 6000,
    });

    return NextResponse.json({
      ...analysis,
      caveat:
        "Counts are of the reviews you pasted, not of all customers. People who write reviews are not a fair sample — " +
        "the angry and the delighted write far more often than the satisfied. Treat this as a list of things worth " +
        "checking, and read a few reviews yourself before acting on it.",
    });
  } catch (err) {
    console.error("Review analysis failed:", err);
    return NextResponse.json({ error: "The analysis couldn't be completed. Please try again." }, { status: 502 });
  }
}
