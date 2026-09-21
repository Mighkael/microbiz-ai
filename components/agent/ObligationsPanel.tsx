"use client";

import { useState } from "react";
import { Plus, Check, Trash2, RotateCw, Info } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import {
  OBLIGATION_KINDS, type AgentData, type Obligation, type ObligationKind, type Recurrence,
} from "@/lib/agent/types";
import { nextDueDate, nextEstimatedTaxDate, usd } from "@/lib/agent/analysis";
import { Card, H, Btn, inputStyle } from "../ui";
import { MoneyInput, todayISO } from "./shared";

const RECURRENCES: { key: Recurrence; label: string }[] = [
  { key: "none", label: "One-off" },
  { key: "monthly", label: "Every month" },
  { key: "quarterly", label: "Every quarter" },
  { key: "annual", label: "Every year" },
  { key: "estimated_tax", label: "Federal estimated tax dates" },
];

type Suggestion = { label: string; kind: ObligationKind; recurrence: Recurrence; date?: (today: string) => string; note: string };

const SUGGESTIONS: Suggestion[] = [
  {
    // The one suggestion with dates attached: the federal schedule is the same for everyone.
    label: "Federal estimated tax payment", kind: "tax", recurrence: "estimated_tax", date: (t) => nextEstimatedTaxDate(t),
    note: "If you expect to owe tax for the year. Confirm the date on IRS.gov — it moves when it falls on a weekend or holiday.",
  },
  { label: "Sales tax return", kind: "tax", recurrence: "monthly", note: "Your state sets how often you file. Check with your state revenue department." },
  { label: "Business license renewal", kind: "license", recurrence: "annual", note: "Check the renewal date with your city or county." },
  { label: "Business insurance renewal", kind: "insurance", recurrence: "annual", note: "The date is on your policy." },
  { label: "Rent", kind: "lease", recurrence: "monthly", note: "" },
  { label: "Loan payment", kind: "loan", recurrence: "monthly", note: "Lender reports use loan payments you record here." },
];

const kindLabel = (k: ObligationKind) => OBLIGATION_KINDS.find((x) => x.key === k)?.label ?? k;

function daysAway(date: string, today: string) {
  const a = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const b = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

function when(days: number) {
  if (days < 0) return { text: `${-days} day${days === -1 ? "" : "s"} overdue`, color: C.alert };
  if (days === 0) return { text: "Due today", color: C.alert };
  if (days <= 7) return { text: `In ${days} day${days === 1 ? "" : "s"}`, color: "#A86D0B" };
  if (days <= 30) return { text: `In ${days} days`, color: C.ink2 };
  return { text: `In ${days} days`, color: C.mist };
}

type Draft = { label: string; kind: ObligationKind; dueDate: string; amount: number | null; recurrence: Recurrence };
const EMPTY_DRAFT: Draft = { label: "", kind: "tax", dueDate: "", amount: null, recurrence: "none" };

export default function ObligationsPanel({
  data, update,
}: {
  data: AgentData;
  update: (fn: (d: AgentData) => AgentData) => void;
}) {
  const today = todayISO();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [note, setNote] = useState("");
  const [showDone, setShowDone] = useState(false);

  const open = data.obligations.filter((o) => !o.done).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const done = data.obligations.filter((o) => o.done).sort((a, b) => b.dueDate.localeCompare(a.dueDate));

  function add() {
    if (!draft.label.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(draft.dueDate)) return;
    const item: Obligation = { id: `o${Date.now().toString(36)}`, ...draft, label: draft.label.trim(), done: false };
    update((d) => ({ ...d, obligations: [...d.obligations, item] }));
    setDraft(EMPTY_DRAFT);
    setNote("");
  }

  /** Paid: a recurring item rolls forward to its next date; a one-off is marked done. */
  function markPaid(o: Obligation) {
    const next = nextDueDate(o);
    update((d) => ({
      ...d,
      obligations: next
        ? [
            ...d.obligations.map((x) => (x.id === o.id ? { ...x, done: true } : x)),
            { ...o, id: `o${Date.now().toString(36)}`, dueDate: next, done: false },
          ]
        : d.obligations.map((x) => (x.id === o.id ? { ...x, done: true } : x)),
    }));
  }

  const remove = (id: string) => update((d) => ({ ...d, obligations: d.obligations.filter((x) => x.id !== id) }));
  const reopen = (id: string) => update((d) => ({ ...d, obligations: d.obligations.map((x) => (x.id === id ? { ...x, done: false } : x)) }));

  function suggest(s: Suggestion) {
    setDraft({ label: s.label, kind: s.kind, recurrence: s.recurrence, amount: null, dueDate: s.date ? s.date(today) : "" });
    setNote(s.note);
  }

  const dueSoon = open.filter((o) => daysAway(o.dueDate, today) <= 30);
  const dueSoonTotal = dueSoon.reduce((s, o) => s + (o.amount ?? 0), 0);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10 }}>
          <H>Deadlines and obligations</H>
          {dueSoon.length > 0 && (
            <div style={{ fontSize: 13, color: C.ink2 }}>
              {dueSoon.length} due in the next 30 days{dueSoonTotal > 0 && <> · <span style={{ fontFamily: FONT_MONO }}>{usd(dueSoonTotal)}</span></>}
            </div>
          )}
        </div>
        <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 14px", lineHeight: 1.55, maxWidth: 680 }}>
          Taxes, license renewals, insurance, loan and rent payments. The agent warns you before they&apos;re due and
          checks them against your cash.
        </div>

        {open.length === 0 ? (
          <div style={{ fontSize: 13.5, color: C.mist, background: C.paper, borderRadius: 9, padding: 14 }}>
            Nothing added yet. Start with one of the suggestions below.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 2 }}>
            {open.map((o) => {
              const w = when(daysAway(o.dueDate, today));
              return (
                <div key={o.id} style={{
                  display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                  padding: "11px 4px", borderBottom: `1px solid ${C.line}`,
                }}>
                  <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14, color: C.ink }}>{o.label}</div>
                    <div style={{ fontSize: 12, color: C.mist }}>
                      {kindLabel(o.kind)} · {RECURRENCES.find((r) => r.key === o.recurrence)?.label}
                      {o.amount != null && <> · <span style={{ fontFamily: FONT_MONO }}>{usd(o.amount)}</span></>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.ink }}>{o.dueDate}</div>
                    <div style={{ fontSize: 12, color: w.color, fontWeight: 600 }}>{w.text}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => markPaid(o)} title={o.recurrence === "none" ? "Mark as done" : "Mark as paid and schedule the next one"} style={iconBtn(C.ledger)}>
                      <Check size={15} /> <span style={{ fontSize: 12.5 }}>{o.recurrence === "none" ? "Done" : "Paid"}</span>
                    </button>
                    <button onClick={() => remove(o.id)} aria-label={`Delete ${o.label}`} style={iconBtn(C.mist)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {done.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <button onClick={() => setShowDone(!showDone)} style={{ background: "none", border: "none", color: C.mist, fontSize: 12.5, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
              {showDone ? "Hide" : "Show"} {done.length} completed
            </button>
            {showDone && (
              <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
                {done.map((o) => (
                  <div key={o.id} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12.5, color: C.mist }}>
                    <span style={{ flex: 1, textDecoration: "line-through" }}>{o.label} · {o.dueDate}</span>
                    <button onClick={() => reopen(o.id)} aria-label={`Reopen ${o.label}`} style={iconBtn(C.mist)}><RotateCw size={13} /></button>
                    <button onClick={() => remove(o.id)} aria-label={`Delete ${o.label}`} style={iconBtn(C.mist)}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <H size={16}>Add an obligation</H>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0 14px" }}>
          <span style={{ fontSize: 12, color: C.mist, alignSelf: "center" }}>Common ones:</span>
          {SUGGESTIONS.map((s) => (
            <button key={s.label} onClick={() => suggest(s)} style={{
              fontSize: 12.5, color: C.ink, background: C.paper, border: `1px solid ${C.line}`,
              borderRadius: 999, padding: "5px 11px", cursor: "pointer",
            }}>{s.label}</button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
          <label style={{ display: "grid", gap: 5, gridColumn: "1 / -1" }}>
            <span style={{ fontSize: 12.5, color: C.mist }}>What is it?</span>
            <input style={inputStyle} value={draft.label} maxLength={120} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. City business license renewal" />
          </label>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 12.5, color: C.mist }}>Type</span>
            <select style={inputStyle} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as ObligationKind })}>
              {OBLIGATION_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 12.5, color: C.mist }}>Due date</span>
            <input type="date" style={inputStyle} value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} />
          </label>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 12.5, color: C.mist }}>Amount (if known)</span>
            <MoneyInput label="Amount" value={draft.amount} onChange={(v) => setDraft({ ...draft, amount: v })} />
          </label>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 12.5, color: C.mist }}>Repeats</span>
            <select style={inputStyle} value={draft.recurrence} onChange={(e) => setDraft({ ...draft, recurrence: e.target.value as Recurrence })}>
              {RECURRENCES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </label>
        </div>

        {note && (
          <div style={{ display: "flex", gap: 7, marginTop: 12, alignItems: "flex-start" }}>
            <Info size={13} color={C.signal} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: 12.5, color: C.mist, lineHeight: 1.5 }}>{note}</div>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <Btn tone="green" onClick={add} disabled={!draft.label.trim() || !draft.dueDate}>
            <Plus size={15} style={{ verticalAlign: -3, marginRight: 5 }} />Add
          </Btn>
        </div>
      </Card>
    </div>
  );
}

const iconBtn = (color: string): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 4, background: "#fff", border: `1px solid ${C.line}`,
  borderRadius: 7, padding: "5px 8px", color, cursor: "pointer",
});
