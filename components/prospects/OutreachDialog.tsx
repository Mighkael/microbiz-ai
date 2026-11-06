"use client";

import { useState } from "react";
import { Copy, Check, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import { CAN_SPAM_RULES, CAN_SPAM_NOTE, type PipelineEntry, type SenderDetails } from "@/lib/prospects/types";
import Modal from "../Modal";
import { Btn, inputStyle } from "../ui";

type Draft = { subject: string; body: string; whyThisOne: string };

export default function OutreachDialog({
  open, onClose, prospect, sender, location, onSent,
}: {
  open: boolean;
  onClose: () => void;
  prospect: PipelineEntry | null;
  sender: SenderDetails;
  location: string;
  /** Called when the owner says they've sent it, so the stage can move. */
  onSent: (id: string) => void;
}) {
  // The parent remounts this per prospect, so a draft can never be shown
  // against the wrong business.
  const [goal, setGoal] = useState("a short call this week");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"subject" | "body" | null>(null);

  if (!prospect) return null;

  async function write() {
    if (busy || !prospect) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/prospects/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { ...sender, location },
          prospect: {
            name: prospect.name, category: prospect.category, address: prospect.address,
            distanceMiles: prospect.distanceMiles, website: prospect.website,
          },
          goal,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "The draft couldn't be written.");
      setDraft(json as Draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The draft couldn't be written.");
    }
    setBusy(false);
  }

  function copy(what: "subject" | "body") {
    if (!draft) return;
    navigator.clipboard?.writeText(what === "subject" ? draft.subject : draft.body).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    }).catch(() => setError("Couldn't copy — select the text and copy it manually."));
  }

  const mailto = draft && prospect.email
    ? `mailto:${encodeURIComponent(prospect.email)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`
    : null;

  return (
    <Modal open={open} onClose={onClose} title={`Write to ${prospect.name}`} width={620}>
      <div style={{ fontSize: 13, color: C.mist, lineHeight: 1.55, marginBottom: 12 }}>
        {prospect.category}
        {prospect.address ? ` · ${prospect.address}` : ""}
        {prospect.email ? <> · <span style={{ fontFamily: FONT_MONO }}>{prospect.email}</span></> : " · no published email"}
      </div>

      <label style={{ display: "grid", gap: 5 }}>
        <span style={{ fontSize: 12.5, color: C.mist }}>What do you want from this email?</span>
        <input style={inputStyle} value={goal} maxLength={200} onChange={(e) => setGoal(e.target.value)} />
      </label>

      <div style={{ marginTop: 12 }}>
        <Btn tone="green" onClick={write} disabled={busy}>
          {busy
            ? <><RefreshCw size={15} className="spin" style={{ verticalAlign: -3, marginRight: 6 }} />Writing…</>
            : <>{draft ? "Write another version" : "Draft the email"}</>}
        </Btn>
      </div>

      {error && <div role="alert" style={{ fontSize: 13, color: C.alert, marginTop: 10 }}>{error}</div>}

      {draft && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
            <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14, color: C.ink }}>Subject</div>
            <button onClick={() => copy("subject")} style={linkBtn}>
              {copied === "subject" ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
            </button>
          </div>
          <div style={{ background: C.paper, borderRadius: 8, padding: "9px 12px", fontSize: 14, color: C.ink, marginTop: 4 }}>
            {draft.subject}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginTop: 14 }}>
            <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14, color: C.ink }}>Message</div>
            <button onClick={() => copy("body")} style={linkBtn}>
              {copied === "body" ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
            </button>
          </div>
          <div style={{
            background: C.paper, borderRadius: 8, padding: "12px 14px", fontSize: 13.5, color: C.ink,
            marginTop: 4, whiteSpace: "pre-wrap", lineHeight: 1.6, maxHeight: 280, overflowY: "auto",
          }}>{draft.body}</div>

          <div style={{ fontSize: 12, color: C.mist, marginTop: 8, lineHeight: 1.5 }}>
            <b>Why this angle:</b> {draft.whyThisOne} Read it before you send — change anything that isn&apos;t true of
            your business, and add anything you know about them that we don&apos;t.
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            {mailto && (
              <a href={mailto} style={{
                display: "inline-flex", alignItems: "center", gap: 6, background: C.ledger, color: "#fff",
                borderRadius: 8, padding: "10px 16px", fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14,
                textDecoration: "none",
              }}>
                <Mail size={15} /> Open in your email app
              </a>
            )}
            <Btn tone="ghost" onClick={() => { onSent(prospect.id); onClose(); }}>I&apos;ve sent this</Btn>
          </div>

          {!prospect.email && (
            <div style={{ fontSize: 12.5, color: C.mist, marginTop: 10, lineHeight: 1.5 }}>
              This business hasn&apos;t published an email address. Copy the message and send it through the contact
              form on {prospect.website ? "their website" : "their website or by phone"}.
            </div>
          )}
        </div>
      )}

      <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 18, paddingTop: 12 }}>
        <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
          <ShieldCheck size={14} color={C.ledger} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 13.5, color: C.ink, marginBottom: 5 }}>
              You are the sender, so these are your duties
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 4 }}>
              {CAN_SPAM_RULES.map((r) => (
                <li key={r} style={{ fontSize: 12, color: C.mist, lineHeight: 1.5 }}>{r}</li>
              ))}
            </ul>
            <div style={{ fontSize: 11.5, color: C.mist, marginTop: 7 }}>{CAN_SPAM_NOTE}</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const linkBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none",
  color: C.ledger, fontSize: 12.5, cursor: "pointer", padding: 0,
};
