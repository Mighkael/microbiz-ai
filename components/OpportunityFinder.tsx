"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Lightbulb, Search, Info, AlertTriangle, ChevronDown, ChevronRight, FileSearch,
} from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import { Card, H, Btn, inputStyle } from "./ui";
import CommunityPanel from "./CommunityPanel";

type Factor = {
  key: string;
  label: string;
  subscore: number;
  direction: "positive" | "neutral" | "negative";
  reading: string;
  weight: number;
};

type Opportunity = {
  industry: string;
  sector: { label: string; benchmarkNote?: string };
  score: number;
  factors: Factor[];
  establishments: number;
  revenuePerEstablishment: number | null;
  employeesPerEstablishment: number | null;
  typicalAnnualPayroll: number | null;
  monthsOfPayrollCovered: number | null;
  capitalIsAStretch: boolean;
  confidence: "high" | "moderate" | "limited";
};

type Response = {
  geography: { label: string; displayName: string; population: number | null };
  capital: number | null;
  ranked: Opportunity[];
  outOfReach: Opportunity[];
  unranked: { industry: string; reason: string }[];
  source: string;
  limitations: string[];
};

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const DIRECTION_COLOR = {
  positive: C.ledger,
  neutral: C.mist,
  negative: C.alert,
} as const;

/** Bands describe the score against the national average, not against perfection. */
function band(score: number) {
  if (score >= 65) return { word: "Strong here", color: C.ledger };
  if (score >= 50) return { word: "Above average", color: C.ledger };
  if (score >= 40) return { word: "Near average", color: C.signal };
  return { word: "Below average", color: C.alert };
}

export default function OpportunityFinder({ defaultLocation = "" }: { defaultLocation?: string }) {
  const [location, setLocation] = useState(defaultLocation);
  const [capital, setCapital] = useState("");
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const geoLabel = data?.geography.label ?? "";

  async function run() {
    if (location.trim().length < 3 || busy) return;
    setBusy(true); setError(""); setData(null); setOpen(null);
    try {
      const params = new URLSearchParams({ location: location.trim() });
      if (capital.trim()) params.set("capital", capital.trim());
      const res = await fetch(`/api/opportunities?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Lookup failed.");
      setData(json);
      setOpen(json.ranked[0]?.industry ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed. Please try again.");
    }
    setBusy(false);
  }

  /** One ranked sector. Shared by the main list and the out-of-reach list. */
  function row(o: Opportunity, i: number) {
  const b = band(o.score);
  const isOpen = open === o.industry;
  return (
    <div key={o.industry} style={{ borderBottom: `1px solid ${C.line}` }}>
      <button
        onClick={() => setOpen(isOpen ? null : o.industry)}
        aria-expanded={isOpen}
        style={{
          width: "100%", background: "none", border: "none", padding: "13px 4px",
          display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{
          fontFamily: FONT_MONO, fontSize: 12, color: C.mist, width: 18, flexShrink: 0,
        }}>{i + 1}</span>

        <span style={{
          fontFamily: FONT_MONO, fontSize: 17, fontWeight: 600, color: b.color,
          fontVariantNumeric: "tabular-nums", width: 34, flexShrink: 0,
        }}>{o.score}</span>

        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14.5, color: C.ink,
            display: "block",
          }}>{o.industry}</span>
          <span style={{ fontSize: 12, color: C.mist }}>
            {b.word} · {o.establishments.toLocaleString("en-US")} operating
            {o.revenuePerEstablishment !== null && <> · {usd(o.revenuePerEstablishment)} typical revenue</>}
          </span>
        </span>

        {o.capitalIsAStretch && (
          <AlertTriangle size={14} color={C.alert} style={{ flexShrink: 0 }} aria-label="Capital is a stretch" />
        )}
        {isOpen
          ? <ChevronDown size={16} color={C.mist} style={{ flexShrink: 0 }} />
          : <ChevronRight size={16} color={C.mist} style={{ flexShrink: 0 }} />}
      </button>

      {isOpen && (
        <div style={{ padding: "0 4px 18px 64px" }}>
          <div style={{ display: "grid", gap: 10 }}>
            {o.factors.map((f) => (
              <div key={f.key}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{
                    fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 12.5,
                    color: DIRECTION_COLOR[f.direction],
                  }}>{f.label}</span>
                  <span style={{
                    fontFamily: FONT_MONO, fontSize: 11.5, color: C.mist,
                    fontVariantNumeric: "tabular-nums",
                  }}>{Math.round(f.subscore)}/100 · weight {Math.round(f.weight * 100)}%</span>
                </div>
                <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.55, marginTop: 2 }}>
                  {f.reading}
                </div>
              </div>
            ))}
          </div>

          {o.sector.benchmarkNote && (
            <div style={{ fontSize: 12, color: C.mist, marginTop: 10, lineHeight: 1.5 }}>
              {o.sector.benchmarkNote}
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <Link
              href={`/research/feasibility?location=${encodeURIComponent(geoLabel)}&industry=${encodeURIComponent(o.industry)}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13,
                color: C.ledger, textDecoration: "none", fontWeight: 600,
              }}
            >
              <FileSearch size={14} />
              Test this in a feasibility study
            </Link>
          </div>
        </div>
      )}
    </div>
  );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <H>Where would you be, and what can you put in?</H>
        <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 16px", maxWidth: 640, lineHeight: 1.55 }}>
          This ranks sectors by how they actually perform in that county — what businesses there take in, how
          crowded the field is, and what wages cost — measured against the national figure for the same sector.
          Capital is optional; leave it blank and the ranking simply drops that factor.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          <input
            style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Clarksville, TN  ·  or 37040" aria-label="Location"
          />
          <input
            style={inputStyle} value={capital} onChange={(e) => setCapital(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            inputMode="numeric"
            placeholder="Capital available (optional)" aria-label="Capital available"
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <Btn tone="green" onClick={run} disabled={busy || location.trim().length < 3}>
            <Search size={15} style={{ verticalAlign: -3, marginRight: 6 }} />
            {busy ? "Ranking sectors…" : "Rank opportunities"}
          </Btn>
        </div>

        {error && <div style={{ fontSize: 13.5, color: C.alert, marginTop: 12 }}>{error}</div>}
      </Card>

      {data && (
        <>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
              <H size={16}>
                <Lightbulb size={16} style={{ verticalAlign: -3, marginRight: 7 }} color={C.ledger} />
                Ranked for {data.geography.label}
              </H>
              {data.geography.population !== null && (
                <div style={{ fontSize: 12.5, color: C.mist }}>
                  Population {data.geography.population.toLocaleString("en-US")}
                  {data.capital !== null && <> · capital {usd(data.capital)}</>}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gap: 2, marginTop: 14 }}>
              {data.ranked.map(row)}
            </div>

            <div style={{ fontSize: 11.5, color: C.mist, marginTop: 14, lineHeight: 1.55 }}>
              A score of 50 means this sector performs here exactly as it does nationally. Higher is better than
              the national average for the same sector — not better than the other sectors on this list in
              absolute terms.
            </div>
          </Card>

          {data.outOfReach.length > 0 && (
            <Card>
              <H size={15}>
                <AlertTriangle size={15} style={{ verticalAlign: -2, marginRight: 6 }} color={C.signal} />
                Beyond this budget
              </H>
              <div style={{ fontSize: 13, color: C.mist, margin: "6px 0 6px", lineHeight: 1.55 }}>
                These sectors may do well here, but a typical establishment carries a wage bill your stated
                capital would not cover for a month. They are listed with their figures rather than ranked
                above — the numbers are the reason, and a different budget changes the answer.
              </div>
              <div style={{ display: "grid", gap: 2 }}>
                {data.outOfReach.map(row)}
              </div>
            </Card>
          )}

          {data.unranked.length > 0 && (
            <Card>
              <H size={15}>Not ranked here</H>
              <div style={{ fontSize: 13, color: C.mist, margin: "6px 0 12px", lineHeight: 1.55 }}>
                The Census withholds figures for these sectors in this county — usually because too few
                businesses operate for the data to be published without identifying them. That is not the same
                as an opportunity being absent.
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {data.unranked.map((u) => (
                  <div key={u.industry} style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                    <span style={{ fontFamily: FONT_HEAD, fontWeight: 600, color: C.ink }}>{u.industry}</span>
                    <span style={{ color: C.mist }}> — {u.reason}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* The ranking says what performs here; this says who lives here. */}
          <CommunityPanel location={location} compact heading="What else to know about this community" />

          <Card>
            <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
              <Info size={14} color={C.signal} style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14, color: C.ink, marginBottom: 6 }}>
                  Read this before acting on the ranking
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
                  {data.limitations.map((l, i) => (
                    <li key={i} style={{ fontSize: 12.5, color: C.mist, lineHeight: 1.55 }}>{l}</li>
                  ))}
                </ul>
                <div style={{ fontSize: 11.5, color: C.mist, marginTop: 10 }}>{data.source}</div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
