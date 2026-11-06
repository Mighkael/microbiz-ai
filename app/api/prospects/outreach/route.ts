// app/api/prospects/outreach/route.ts
// POST /api/prospects/outreach  { sender, prospect, goal }
//
// Drafts one outreach email for one business. It never sends anything: the
// owner sends it from their own mailbox, so the relationship — and the legal
// responsibility that comes with it — stays theirs.
//
// The required elements of a lawful US commercial email are appended here in
// code rather than left to the model: who is writing, their postal address,
// and a working opt-out line.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { structured, hasApiKey } from "@/lib/ai/claude";

export const maxDuration = 60;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const DraftSchema = z.object({
  subject: z.string().describe("Under 60 characters, specific and plain. No marketing hype, no all-caps, no exclamation marks."),
  body: z.string().describe("The message, 90–150 words, in short paragraphs separated by blank lines. No greeting line beyond 'Hi <name>,' and no sign-off — those are added separately."),
  whyThisOne: z.string().describe("One short sentence for the sender, explaining the angle taken with this prospect."),
});

const SYSTEM = [
  "You write short, honest, first-contact emails from one small business to another in the United States.",
  "",
  "The reader is a busy owner or manager who did not ask to hear from you. Earn the reply:",
  "- Open with why you are writing to them specifically, not a generic compliment.",
  "- Say plainly what you do and what it would do for them. One clear benefit, not three.",
  "- Ask for something small and concrete — a brief call, a sample, a question answered.",
  "- Keep it under 150 words, plain words, no jargon, no hype, no exclamation marks.",
  "",
  "Hard rules:",
  "- Invent nothing. Do not claim you have worked with them, know their staff, have seen their numbers,",
  "  or have been recommended by anyone. Use only the facts given below.",
  "- Make no promise about results, savings or revenue.",
  "- Do not imply the message was requested.",
  "- Write the body only. The sender's name, business, postal address and opt-out line are added by the system.",
].join("\n");

export async function POST(req: NextRequest) {
  if (!hasApiKey()) {
    return NextResponse.json({ error: "Drafting isn't configured on this server yet." }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request couldn't be read." }, { status: 400 });
  }

  const sender = (body.sender && typeof body.sender === "object" ? body.sender : {}) as Record<string, unknown>;
  const prospect = (body.prospect && typeof body.prospect === "object" ? body.prospect : {}) as Record<string, unknown>;

  const businessName = str(sender.businessName, 120);
  const offer = str(sender.offer, 400);
  const postalAddress = str(sender.postalAddress, 300);
  const replyEmail = str(sender.replyEmail, 254);
  const prospectName = str(prospect.name, 160);

  if (!businessName || !offer) {
    return NextResponse.json({ error: "Add your business name and what you offer first." }, { status: 400 });
  }
  if (!prospectName) {
    return NextResponse.json({ error: "No prospect given." }, { status: 400 });
  }
  if (!postalAddress) {
    return NextResponse.json(
      { error: "A commercial email must carry your street address or PO box. Add it in Your details." },
      { status: 400 },
    );
  }

  const facts = [
    `Sender's business: ${businessName}`,
    `What they offer: ${offer}`,
    `Where they are: ${str(sender.location, 120) || "not stated"}`,
    "",
    `Prospect: ${prospectName}`,
    `Kind of business: ${str(prospect.category, 80) || "not stated"}`,
    `Where: ${str(prospect.address, 240) || "nearby"}`,
    `Distance from the sender: ${typeof prospect.distanceMiles === "number" ? `${prospect.distanceMiles} miles` : "unknown"}`,
    `Their website: ${str(prospect.website, 300) || "none listed"}`,
    "",
    `What the sender wants from this email: ${str(body.goal, 200) || "a short reply or a brief call"}`,
    "",
    "Everything known about this prospect is above — it came from a public map listing, not from any dealings with them.",
  ].join("\n");

  try {
    const draft = await structured({
      schema: DraftSchema,
      system: SYSTEM,
      prompt: facts,
      effort: "low",
      maxTokens: 2000,
    });

    // Added in code, not left to the model: the parts the law requires.
    const signature = [
      "",
      `— ${businessName}`,
      postalAddress,
      replyEmail ? `Reply to this email: ${replyEmail}` : "",
      "",
      `If you'd rather not hear from ${businessName} again, reply with "unsubscribe" and you won't be contacted.`,
    ].filter(Boolean).join("\n");

    return NextResponse.json({
      subject: draft.subject,
      body: `${draft.body.trim()}\n${signature}`,
      whyThisOne: draft.whyThisOne,
    });
  } catch (err) {
    console.error("Outreach draft failed:", err);
    return NextResponse.json({ error: "The draft couldn't be written just now. Please try again." }, { status: 502 });
  }
}
