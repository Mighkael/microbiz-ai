"use client";

import { useState } from "react";
import { Send, CheckCircle2 } from "lucide-react";
import { C, FONT_HEAD } from "@/lib/theme";
import { useAuth } from "./AuthProvider";
import { Btn, Field, inputStyle } from "./ui";

const TOPICS = ["General question", "Partnership", "Press or media", "A question about the data", "Something else"];

/** Visually hidden, but still in the form for bots to fill. */
const honeypotStyle: React.CSSProperties = {
  position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden",
};

export default function ContactForm() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  const replyTo = email || user?.email || "";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending"); setError("");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "contact", name, email: replyTo, topic, message, website, page: "/contact" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Your message couldn't be sent.");
      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your message couldn't be sent.");
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <CheckCircle2 size={22} color={C.ledger} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 16, color: C.ink }}>Message sent</div>
          <div style={{ fontSize: 14, color: C.mist, marginTop: 4, lineHeight: 1.6 }}>
            Thank you. We read every message, and we&apos;ll reply to {replyTo}.
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={send} style={{ display: "grid", gap: 14, position: "relative" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
        <Field label="Your name">
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} />
        </Field>
        <Field label="Email (so we can reply)">
          <input
            style={inputStyle} type="email" required={!user?.email}
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder={user?.email ?? ""} autoComplete="email" maxLength={254}
          />
        </Field>
      </div>

      <Field label="What's it about?">
        <select style={inputStyle} value={topic} onChange={(e) => setTopic(e.target.value)}>
          {TOPICS.map((t) => <option key={t}>{t}</option>)}
        </select>
      </Field>

      <Field label="Message">
        <textarea
          style={{ ...inputStyle, minHeight: 150, resize: "vertical", lineHeight: 1.5 }}
          value={message} onChange={(e) => setMessage(e.target.value)} required maxLength={5000}
        />
      </Field>

      <div aria-hidden="true" style={honeypotStyle}>
        <label>Website <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      </div>

      {error && <div role="alert" style={{ fontSize: 13.5, color: C.alert }}>{error}</div>}

      <div>
        <Btn tone="green" disabled={status === "sending" || message.trim().length < 3}>
          <Send size={15} style={{ verticalAlign: -3, marginRight: 6 }} />
          {status === "sending" ? "Sending…" : "Send message"}
        </Btn>
      </div>
    </form>
  );
}
