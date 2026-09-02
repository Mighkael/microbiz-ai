"use client";

import { useCallback, useEffect, useState } from "react";
import { Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import type { Profile } from "@/lib/data";
import { Card, H, inputStyle } from "./ui";

type DataPoint = {
  value: number | null;
  status: "observed" | "suppressed" | "calculated" | "unavailable";
  source: string;
  vintage: string;
  geography: string;
  note?: string;
};

type Comparison = {
  key: string;
  label: string;
  yours: number | null;
  benchmark: DataPoint;
  ratio: number | null;
  verdict: "well_above" | "above" | "typical" | "below" | "well_below" | null;
  reading: string;
  format: "currency" | "number";
};

type BenchmarkResult = {
  geography: { displayName: string; county: string | null; state: string };
  level: "county" | "state" | "us";
  sector: { label: string; code: string; benchmarkNote?: string };
  comparisons: Comparison[];
  position: { score: number; basis: number } | null;
};

const LEVELS = [
  { value: "county", label: "My county" },
  { value: "state", label: "My state" },
  { value: "us", label: "Nationwide" },
] as const;

const fmt = (n: number, kind: "currency" | "number") =>
  kind === "currency"
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : n.toLocaleString("en-US", { maximumFractionDigits: 1 });

const VERDICT_COLOR: Record<string, string> = {
  well_above: C.ledger,
  above: C.ledger,
  typical: C.mist,
  below: C.signal,
  well_below: C.alert,
};

function VerdictIcon({ verdict }: { verdict: Comparison["verdict"] }) {
  if (!verdict) return null;
  const color = VERDICT_COLOR[verdict];
  if (verdict === "typical") return <Minus size={15} color={color} />;
  return verdict.includes("above")
    ? <TrendingUp size={15} color={color} />
    : <TrendingDown size={15} color={color} />;
}

export default function BenchmarkPanel({ profile }: { profile: Profile }) {
  const [level, setLevel] = useState<"county" | "state" | "us">("county");
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const hasLocation = profile.location.trim().length >= 3;

  const load = useCallback(async (lvl: string) => {
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({
        location: profile.location,
        industry: profile.industry,
        revenue: String(+profile.revenue || 0),
        employees: String(+profile.employees || 0),
        level: lvl,
      });
      const res = await fetch(`/api/benchmark?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Benchmark lookup failed.");
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Benchmark lookup failed.");
    }
    setBusy(false);
  }, [profile.location, profile.industry, profile.revenue, profile.employees]);

  useEffect(() => {
    if (hasLocation) load(level);
  }, [hasLocation, level, load]);

  if (!hasLocation) {
    return (
      <Card>
        <H>Where you stand</H>
        <div style={{ fontSize: 13.5, color: C.mist, marginTop: 8 }}>
          Add your city and state to your profile to compare against real businesses in your market.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <H>Where you stand</H>
        <label style={{ fontSize: 12.5, color: C.mist, display: "flex", alignItems: "center", gap: 8 }}>
          Compare against
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as typeof level)}
            style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 13 }}
            aria-label="Comparison geography"
          >
            {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </label>
      </div>

      <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 14px", maxWidth: 620, lineHeight: 1.55 }}>
        Your figures measured against published Census data for businesses in your sector and area.
      </div>

      {busy && <div style={{ fontSize: 13.5, color: C.mist }}>Loading market figures…</div>}
      {error && !busy && <div style={{ fontSize: 13.5, color: C.alert }}>{error}</div>}

      {result && !busy && (
        <>
          {result.position && (
            <div style={{
              display: "flex", alignItems: "center", gap: 16,
              background: C.paper, borderRadius: 10, padding: "14px 16px", marginBottom: 16,
            }}>
              <div style={{
                fontFamily: FONT_MONO, fontSize: 30, fontWeight: 700,
                color: result.position.score >= 60 ? C.ledger : result.position.score >= 40 ? C.signal : C.alert,
              }}>{result.position.score}</div>
              <div style={{ fontSize: 12.5, color: C.mist, lineHeight: 1.5 }}>
                <b style={{ color: C.ink, fontFamily: FONT_HEAD }}>Market position score</b><br />
                Where you sit against {result.sector.label.toLowerCase()} businesses{" "}
                {result.level === "us"
                  ? "nationwide"
                  : `in ${result.level === "state" ? result.geography.state : result.geography.county ?? result.geography.state}`}.
                Based on {result.position.basis} comparison{result.position.basis === 1 ? "" : "s"}. 50 is typical.
              </div>
            </div>
          )}

          <div style={{ display: "grid", gap: 2 }}>
            {result.comparisons.map((c) => (
              <div key={c.key} style={{ padding: "13px 0", borderBottom: `1px solid ${C.line}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                  <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14, color: C.ink }}>{c.label}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONT_MONO, fontSize: 13 }}>
                    <span style={{ color: C.ink, fontWeight: 600 }}>
                      {c.yours === null ? "—" : fmt(c.yours, c.format)}
                    </span>
                    <span style={{ color: C.mist }}>vs</span>
                    <span style={{ color: C.mist }}>
                      {c.benchmark.value === null ? "n/a" : fmt(c.benchmark.value, c.format)}
                    </span>
                    <VerdictIcon verdict={c.verdict} />
                  </div>
                </div>
                <div style={{
                  fontSize: 12.5, marginTop: 4, lineHeight: 1.5,
                  color: c.verdict ? VERDICT_COLOR[c.verdict] : C.mist,
                }}>{c.reading}</div>
                <div style={{ fontSize: 11, color: C.mist, marginTop: 4 }}>
                  {c.benchmark.source} · {c.benchmark.vintage} · {c.benchmark.geography}
                  {c.benchmark.status === "calculated" && c.benchmark.note ? ` · ${c.benchmark.note}` : ""}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "flex-start" }}>
            <Info size={14} color={C.mist} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 11.5, color: C.mist, lineHeight: 1.55 }}>
              {result.sector.benchmarkNote ? `${result.sector.benchmarkNote} ` : ""}
              Profit margin is deliberately not benchmarked here: no free federal source publishes profit by sector and
              area, so any such figure would be an estimate rather than a measurement.
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
