"use client";

import { useEffect, useRef, useState } from "react";
import { Send, RefreshCw, Eye, EyeOff } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import { ROLES, roleLabel, type AgentData, type AssistantRole } from "@/lib/agent/types";
import { Card, Btn, inputStyle } from "../ui";
import Markdown from "../Markdown";
import EvidenceTrail from "../EvidenceTrail";
import type { ChatMsg } from "./useAgentChat";

export default function AssistantPanel({
  data, role, onRoleChange, chat, onGoTo,
}: {
  data: AgentData;
  role: AssistantRole;
  onRoleChange: (r: AssistantRole) => void;
  chat: { messages: ChatMsg[]; busy: boolean; send: (role: AssistantRole, text: string) => void; reset: () => void };
  onGoTo: (tab: "sharing") => void;
}) {
  const { messages, busy } = chat;
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const current = ROLES.find((r) => r.key === role)!;

  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [messages, busy]);

  function send(text: string) {
    if (!text.trim() || busy) return;
    chat.send(role, text);
    setInput("");
  }

  const shared = [
    { on: data.permissions.profile, label: "Business profile" },
    { on: data.permissions.financials, label: "Plan & figures" },
    { on: data.permissions.obligations, label: "Obligations" },
  ];

  return (
    <Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 5 }}>
          <span style={{ fontSize: 12.5, color: C.mist }}>Assistant</span>
          <select style={inputStyle} value={role} onChange={(e) => onRoleChange(e.target.value as AssistantRole)} aria-label="Choose an assistant">
            {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </label>
        <div style={{ fontSize: 13, color: C.ink2, lineHeight: 1.5, paddingBottom: 4 }}>{current.blurb}</div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", margin: "12px 0 14px", fontSize: 12 }}>
        <span style={{ color: C.mist }}>This assistant can see:</span>
        {shared.map((s) => (
          <span key={s.label} style={{
            display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 999, padding: "3px 9px",
            background: s.on ? C.ledgerSoft : C.paper, color: s.on ? C.ledger : C.mist,
          }}>
            {s.on ? <Eye size={12} /> : <EyeOff size={12} />} {s.label}
          </span>
        ))}
        <button onClick={() => onGoTo("sharing")} style={{ background: "none", border: "none", color: C.ledger, fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
          Change
        </button>
      </div>

      <div style={{ maxHeight: 520, overflowY: "auto", display: "grid", gap: 10, marginBottom: 12 }}>
        {messages.length === 0 && (
          <div style={{ background: C.paper, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 14, color: C.ink, marginBottom: 10 }}>
              Ask anything about running the business — or start with one of these:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {current.starters.map((s) => (
                <button key={s} onClick={() => send(s)} style={{
                  fontSize: 13, color: C.ink, background: "#fff", border: `1px solid ${C.line}`,
                  borderRadius: 999, padding: "6px 12px", cursor: "pointer", textAlign: "left",
                }}>{s}</button>
              ))}
            </div>
            {!data.permissions.financials && (
              <div style={{ fontSize: 12.5, color: C.mist, marginTop: 12, lineHeight: 1.5 }}>
                To compare your plan with what&apos;s actually happening, add your figures in Plan &amp; actuals and allow
                the assistant to see them in Sharing.
              </div>
            )}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{
            justifySelf: m.role === "user" ? "end" : "start", maxWidth: "88%",
            background: m.role === "user" ? C.ink : C.paper, color: m.role === "user" ? "#fff" : C.ink,
            borderRadius: 10, padding: "10px 14px", fontSize: 14, lineHeight: 1.55,
          }}>
            {m.role === "ai" && m.assistant && (
              <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: C.ledger, marginBottom: 4, fontWeight: 600 }}>
                {roleLabel(m.assistant)}
              </div>
            )}
            {m.role === "ai" ? <Markdown>{m.text}</Markdown> : <span style={{ whiteSpace: "pre-wrap" }}>{m.text}</span>}
            {m.role === "ai" && <EvidenceTrail evidence={m.evidence ?? []} />}
          </div>
        ))}
        {busy && (
          <div style={{ color: C.mist, fontSize: 13 }}>
            <RefreshCw size={13} style={{ verticalAlign: -2, marginRight: 4 }} className="spin" />
            {current.label} assistant is working it out…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} style={{ display: "flex", gap: 8 }}>
        <input
          style={{ ...inputStyle, flex: 1 }} value={input} onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask the ${current.label} assistant…`} aria-label="Your question" maxLength={4000}
        />
        <Btn tone="green" disabled={busy || !input.trim()}><Send size={15} /><span className="sr-only">Send</span></Btn>
      </form>

      <div style={{ fontSize: 11.5, color: C.mist, marginTop: 10, lineHeight: 1.5 }}>
        When you ask a question, only the parts shown as visible above are sent to our AI provider to answer it.
        Answers can be wrong — check anything important. {" "}
        <span style={{ fontFamily: FONT_HEAD }}>Not financial, legal or tax advice.</span>
      </div>
    </Card>
  );
}
