// app/api/messages/route.ts
// POST /api/messages — Contact Us and Feedback submissions.
//
// Stored in the Supabase `messages` table (supabase/messages.sql). The table
// accepts inserts from anyone but has no read policy, so submissions are
// visible only in the Supabase dashboard — never through the site's API.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LIMITS = { name: 120, email: 254, topic: 60, message: 5000, page: 300 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request couldn't be read." }, { status: 400 });
  }

  // Honeypot: a field real visitors never see. Bots that fill every input get
  // a normal-looking success and nothing is stored.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const kind = body.kind === "contact" || body.kind === "feedback" ? body.kind : null;
  const message = text(body.message, LIMITS.message);
  const email = text(body.email, LIMITS.email);

  if (!kind) return NextResponse.json({ error: "Unknown message type." }, { status: 400 });
  if (!message || message.length < 3) {
    return NextResponse.json({ error: "Please write a message before sending." }, { status: 400 });
  }
  if (kind === "contact" && !email) {
    return NextResponse.json({ error: "Please add an email address so we can reply." }, { status: 400 });
  }
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("messages").insert({
      kind,
      name: text(body.name, LIMITS.name),
      email,
      topic: text(body.topic, LIMITS.topic),
      message,
      page: text(body.page, LIMITS.page),
      user_id: user?.id ?? null,
    });

    if (error) {
      // 42P01 / PGRST205: the table hasn't been created yet.
      const missing = error.code === "42P01" || error.code === "PGRST205";
      console.error("messages insert failed", error.code, error.message);
      return NextResponse.json(
        { error: missing
            ? "Messages can't be received yet — the site owner still needs to finish setting this up."
            : "Your message couldn't be sent. Please try again in a moment." },
        { status: missing ? 503 : 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Your message couldn't be sent. Please try again in a moment." }, { status: 500 });
  }
}
