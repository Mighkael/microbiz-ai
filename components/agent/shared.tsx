"use client";

import { useCallback, useMemo, useState } from "react";
import { C, FONT_MONO } from "@/lib/theme";
import { useLocalState, clearLocalState } from "@/lib/useLocalState";
import { emptyAgentData, sanitizeAgentData, type AgentData } from "@/lib/agent/types";
import type { Severity } from "@/lib/agent/analysis";
import { inputStyle } from "../ui";

export const AGENT_STORAGE_KEY = "microbiz.agent";

/** Today in the owner's own time zone, as YYYY-MM-DD. */
export const todayISO = () => new Date().toLocaleDateString("en-CA");

/**
 * The owner's agent workspace — plan, monthly figures, obligations, sharing
 * choices. Kept in this browser only; see lib/agent/types.ts.
 */
export function useAgentWorkspace() {
  const year = new Date().getFullYear();
  const [raw, setRaw, hydrated] = useLocalState<AgentData>(AGENT_STORAGE_KEY, emptyAgentData(year));
  const data = useMemo(() => sanitizeAgentData(raw, year), [raw, year]);

  const update = useCallback(
    (fn: (d: AgentData) => AgentData) =>
      setRaw((prev) => ({ ...fn(sanitizeAgentData(prev, year)), updatedAt: new Date().toISOString() })),
    [setRaw, year],
  );

  const replace = useCallback((next: AgentData) => setRaw(next), [setRaw]);

  const clear = useCallback(() => {
    clearLocalState(AGENT_STORAGE_KEY);
    setRaw(emptyAgentData(year));
  }, [setRaw, year]);

  return { data, update, replace, clear, hydrated };
}

export const parseMoney = (s: string): number | null => {
  const cleaned = s.replace(/[$,\s]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const formatMoney = (n: number | null) => (n == null ? "" : n.toLocaleString("en-US", { maximumFractionDigits: 2 }));

/**
 * A dollar field that stores `null` when empty — "not entered" and "zero" are
 * different things to the agent. Shows the typed text while editing and a
 * tidy number once the field loses focus.
 */
export function MoneyInput({
  value, onChange, placeholder, label, compact, allowNegative,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  label: string;
  compact?: boolean;
  allowNegative?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div style={{ position: "relative" }}>
      <span style={{
        position: "absolute", left: compact ? 8 : 11, top: "50%", transform: "translateY(-50%)",
        color: C.mist, fontSize: compact ? 12.5 : 14, pointerEvents: "none",
      }}>$</span>
      <input
        aria-label={label}
        inputMode="decimal"
        placeholder={placeholder}
        value={draft ?? formatMoney(value)}
        onFocus={() => setDraft(formatMoney(value))}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = parseMoney(e.target.value);
          onChange(v != null && !allowNegative && v < 0 ? Math.abs(v) : v);
        }}
        onBlur={() => setDraft(null)}
        style={{
          ...inputStyle,
          paddingLeft: compact ? 20 : 24,
          ...(compact ? { padding: "7px 8px 7px 20px", fontSize: 13, fontFamily: FONT_MONO, textAlign: "right" as const } : {}),
        }}
      />
    </div>
  );
}

export const SEVERITY: Record<Severity, { label: string; color: string; bg: string }> = {
  high: { label: "Act now", color: C.alert, bg: "#F9E9E6" },
  medium: { label: "Watch", color: "#A86D0B", bg: "#FBF1E1" },
  low: { label: "Note", color: C.ink2, bg: C.paper },
  good: { label: "On track", color: C.ledger, bg: C.ledgerSoft },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEVERITY[severity];
  return (
    <span style={{
      fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
      color: s.color, background: s.bg, borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap",
    }}>{s.label}</span>
  );
}

export function Toggle({
  checked, onChange, label, description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="mb-toggle" style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer", position: "relative" }}>
      <input
        type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)}
        style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
      />
      <span aria-hidden="true" style={{
        flexShrink: 0, width: 38, height: 22, borderRadius: 999, marginTop: 1,
        background: checked ? C.ledger : "#C9D3D0", position: "relative", transition: "background .15s",
      }}>
        <span style={{
          position: "absolute", top: 3, left: checked ? 19 : 3, width: 16, height: 16, borderRadius: "50%",
          background: "#fff", transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
        }} />
      </span>
      <span>
        <span style={{ display: "block", fontSize: 14, color: C.ink, fontWeight: 600 }}>{label}</span>
        {description && <span style={{ display: "block", fontSize: 12.5, color: C.mist, lineHeight: 1.5, marginTop: 2 }}>{description}</span>}
      </span>
    </label>
  );
}

/** Starts a browser download of text content. */
export function downloadText(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
