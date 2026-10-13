"use client";

import { useState } from "react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import type { CommunityScore, Pillar } from "@/lib/community/score";

/** Colour by distance from the national middle, not by good or bad. */
export function scoreColor(score: number) {
  if (score >= 62) return C.ledger;
  if (score >= 45) return C.ink2;
  if (score >= 35) return C.signal;
  return C.alert;
}

export function PillarBar({ pillar, compact }: { pillar: Pillar; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const score = Math.round(pillar.score);
  return (
    <div style={{ borderBottom: compact ? "none" : `1px solid ${C.line}`, padding: compact ? "5px 0" : "9px 0" }}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left",
          display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "baseline",
        }}
      >
        <span style={{ fontSize: compact ? 12.5 : 13.5, color: C.ink }}>{pillar.label}</span>
        <span style={{
          fontFamily: FONT_MONO, fontSize: compact ? 13 : 14.5, fontWeight: 600,
          color: scoreColor(pillar.score), fontVariantNumeric: "tabular-nums",
        }}>{score}</span>
      </button>

      {/* 50 is the national middle, marked so the bar can be read at a glance. */}
      <div style={{ position: "relative", height: 5, background: C.paper, borderRadius: 999, marginTop: 5 }}>
        <div style={{ position: "absolute", inset: 0, width: `${Math.max(2, Math.min(100, score))}%`, background: scoreColor(pillar.score), borderRadius: 999 }} />
        <div style={{ position: "absolute", left: "50%", top: -2, width: 1, height: 9, background: C.mist, opacity: 0.6 }} />
      </div>

      {!compact && (
        <div style={{ fontSize: 11.5, color: C.mist, marginTop: 5, lineHeight: 1.5 }}>
          {pillar.reading}{" "}
          <button onClick={() => setOpen(!open)} style={{ background: "none", border: "none", color: C.ledger, cursor: "pointer", fontSize: 11.5, padding: 0 }}>
            {open ? "Hide the figures" : "Show the figures"}
          </button>
        </div>
      )}

      {open && (
        <ul style={{ margin: "6px 0 2px", paddingLeft: 16, display: "grid", gap: 3 }}>
          {pillar.drivers.map((d, i) => (
            <li key={i} style={{ fontSize: 12, color: C.ink2, lineHeight: 1.5 }}>{d}</li>
          ))}
          <li style={{ fontSize: 11, color: C.mist, listStyle: "none", marginLeft: -16 }}>
            Weight in the overall score: {Math.round(pillar.weight * 100)}% ·{" "}
            {pillar.basis === "national" ? "50 = the typical US county" : pillar.basis === "banded" ? "banded by count" : "stated rules"}
          </li>
        </ul>
      )}
    </div>
  );
}

export default function CommunityScoreBlock({
  score, compact, counts,
}: {
  score: CommunityScore;
  compact?: boolean;
  /** Opportunities and challenges found, so the number has a conclusion beside it. */
  counts?: { opportunities: number; challenges: number };
}) {
  return (
    <div style={{ background: C.paper, borderRadius: 12, padding: compact ? "14px 16px" : "18px 20px" }}>
      <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ textAlign: "center", minWidth: 76 }}>
          <div style={{
            fontFamily: FONT_MONO, fontSize: compact ? 36 : 44, fontWeight: 700, lineHeight: 1,
            color: scoreColor(score.score), fontVariantNumeric: "tabular-nums",
          }}>{score.score}</div>
          <div style={{
            fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase",
            color: C.mist, marginTop: 5,
          }}>Conditions</div>
        </div>

        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: compact ? 15 : 16.5, color: C.ink }}>
            {score.band.label}
          </div>
          <div style={{ fontSize: 13, color: C.ink2, lineHeight: 1.55, marginTop: 3 }}>{score.band.blurb}</div>
          <div style={{ fontSize: 12.5, color: C.mist, marginTop: 5 }}>
            {score.verdict}
            {counts && (counts.opportunities > 0 || counts.challenges > 0) && (
              <> · {counts.opportunities} opening{counts.opportunities === 1 ? "" : "s"}, {counts.challenges} strain{counts.challenges === 1 ? "" : "s"} below.</>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {score.pillars.map((p) => <PillarBar key={p.key} pillar={p} compact={compact} />)}
      </div>

      <div style={{ fontSize: 11, color: C.mist, marginTop: 10, lineHeight: 1.5 }}>
        50 = the typical US county. This scores <b>conditions, not demand</b> — it says how this place compares as
        somewhere to operate, not whether a business will succeed.
        {score.confidence !== "high" && <> Based on {score.pillars.length} pillars, so read it loosely.</>}
      </div>
    </div>
  );
}
