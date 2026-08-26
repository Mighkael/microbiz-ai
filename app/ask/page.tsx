"use client";

import { useState } from "react";
import { Send, RefreshCw } from "lucide-react";
import { C, FONT_HEAD } from "@/lib/theme";
import { DEFAULT_PROFILE } from "@/lib/data";
import type { ChatMessage } from "@/lib/data";
import { useMetrics } from "@/lib/useMetrics";
import { askAdvisor } from "@/lib/api";
import { Card, Btn, inputStyle } from "@/components/ui";
import { useProfileContext } from "@/components/ProfileProvider";
import Markdown from "@/components/Markdown";

export default function AskPage() {
  const { profile: saved } = useProfileContext();
  const profile = saved ?? DEFAULT_PROFILE;
  const m = useMetrics(profile);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const history = messages;
    setMessages([...history, { role: "user", text }]); setInput(""); setBusy(true);
    try {
      const reply = await askAdvisor(profile, m, text, history);
      setMessages((cur) => [...cur, { role: "ai", text: reply || "No response — please try again." }]);
    } catch (err) {
      setMessages((cur) => [...cur, { role: "ai", text: err instanceof Error ? err.message : "Connection error. Please try again." }]);
    }
    setBusy(false);
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontFamily: FONT_HEAD, fontSize: 30, color: C.ink, margin: "0 0 6px" }}>Ask MicroBiz AI</h1>
      <p style={{ color: C.mist, marginBottom: 24 }}>
        {saved
          ? "Answers are grounded in your saved business profile."
          : "General small-business guidance for now — complete the assessment for advice tailored to your own numbers."}
      </p>
      <Card>
        <div style={{ maxHeight: 480, overflowY: "auto", display: "grid", gap: 10, marginBottom: 12 }}>
          {messages.length === 0 && (
            <div style={{ color: C.mist, fontSize: 14, background: C.paper, borderRadius: 8, padding: 16 }}>
              Ask about pricing, hiring, financing, marketing — anything on your mind.
            </div>
          )}
          {messages.map((mm, i) => (
            <div key={i} style={{
              justifySelf: mm.role === "user" ? "end" : "start", maxWidth: "85%",
              background: mm.role === "user" ? C.ink : C.paper, color: mm.role === "user" ? "#fff" : C.ink,
              borderRadius: 10, padding: "10px 14px", fontSize: 14, lineHeight: 1.5,
            }}>
              {mm.role === "ai" ? <Markdown>{mm.text}</Markdown> : <span style={{ whiteSpace: "pre-wrap" }}>{mm.text}</span>}
            </div>
          ))}
          {busy && <div style={{ color: C.mist, fontSize: 13 }}><RefreshCw size={13} style={{ verticalAlign: -2 }} className="spin" /> Thinking…</div>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...inputStyle, flex: 1 }} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)} placeholder="e.g., Should I raise my prices 5%?" />
          <Btn tone="green" onClick={() => send(input)} disabled={busy}><Send size={15} /></Btn>
        </div>
      </Card>
    </div>
  );
}
