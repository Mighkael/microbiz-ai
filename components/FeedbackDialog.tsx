"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Send, CheckCircle2 } from "lucide-react";
import { C } from "@/lib/theme";
import Modal from "./Modal";
import { Btn, Field, inputStyle } from "./ui";

const KINDS = [
  { value: "Something isn't working", hint: "What did you do, and what happened?" },
  { value: "A figure looks wrong", hint: "Which figure, where, and what you expected?" },
  { value: "An idea or request", hint: "What would make MicroBiz AI more useful to you?" },
  { value: "Something else", hint: "Tell us anything." },
];

export default function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [topic, setTopic] = useState(KINDS[0].value);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  function close() {
    onClose();
    // Reset after a successful send, so the next opening starts fresh — but
    // keep an unsent draft if the dialog was closed by accident.
    if (status === "sent") { setMessage(""); setStatus("idle"); }
    setError("");
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending"); setError("");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "feedback", topic, message, email, website, page: pathname }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Your feedback couldn't be sent.");
      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your feedback couldn't be sent.");
      setStatus("idle");
    }
  }

  const hint = KINDS.find((k) => k.value === topic)?.hint;

  return (
    <Modal open={open} onClose={close} title="Send feedback">
      {status === "sent" ? (
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <CheckCircle2 size={20} color={C.ledger} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.6 }}>
              Thank you — that&apos;s been received. Feedback like this is how the figures and tools get better.
            </div>
          </div>
          <div style={{ marginTop: 16 }}><Btn onClick={close}>Close</Btn></div>
        </div>
      ) : (
        <form onSubmit={send} style={{ display: "grid", gap: 13, position: "relative" }}>
          <div style={{ fontSize: 13, color: C.mist, lineHeight: 1.55, marginTop: -4 }}>
            We&apos;ll note that you were on <code style={{ fontSize: 12 }}>{pathname}</code>, so there&apos;s no need
            to explain where.
          </div>

          <Field label="What kind of feedback?">
            <select style={inputStyle} value={topic} onChange={(e) => setTopic(e.target.value)}>
              {KINDS.map((k) => <option key={k.value}>{k.value}</option>)}
            </select>
          </Field>

          <Field label="Your feedback">
            <textarea
              style={{ ...inputStyle, minHeight: 120, resize: "vertical", lineHeight: 1.5 }}
              value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder={hint} required maxLength={5000}
            />
          </Field>

          <Field label="Email (optional — only if you'd like a reply)">
            <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} />
          </Field>

          <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
            <label>Website <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
          </div>

          {error && <div role="alert" style={{ fontSize: 13.5, color: C.alert }}>{error}</div>}

          <div>
            <Btn tone="green" disabled={status === "sending" || message.trim().length < 3}>
              <Send size={15} style={{ verticalAlign: -3, marginRight: 6 }} />
              {status === "sending" ? "Sending…" : "Send feedback"}
            </Btn>
          </div>
        </form>
      )}
    </Modal>
  );
}
