"use client";

import { useState } from "react";
import { MapPin, Plus, X, Search, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import { INDUSTRIES } from "@/lib/data";
import { Card, H, Btn, inputStyle } from "./ui";
import ComparisonMap, { PIN_COLORS, type MapPoint } from "./ComparisonMap";

type Factor = {
  key: string;
  label: string;
  subscore: number | null;
  direction: "positive" | "neutral" | "negative";
  reading: string;
};

type Result = {
  query: string;
  error: string | null;
  profile: {
    geography: { label: string; displayName: string; lat: number; lon: number };
  } | null;
  score: {
    score: number | null;
    factors: Factor[];
    positives: string[];
    negatives: string[];
    basis: number;
    confidence: "high" | "moderate" | "limited";
  } | null;
};

type Response = {
  sector: { label: string; code: string; benchmarkNote?: string };
  results: Result[];
};

const DIRECTION_COLOR = {
  positive: C.ledger,
  neutral: C.mist,
  negative: C.alert,
} as const;

function DirectionIcon({ d }: { d: Factor["direction"] }) {
  if (d === "positive") return <TrendingUp size={14} color={DIRECTION_COLOR.positive} />;
  if (d === "negative") return <TrendingDown size={14} color={DIRECTION_COLOR.negative} />;
  return <Minus size={14} color={DIRECTION_COLOR.neutral} />;
}

function scoreColor(score: number) {
  if (score >= 60) return C.ledger;
  if (score >= 45) return C.signal;
  return C.alert;
}

export default function LocationIntelligence() {
  const [locations, setLocations] = useState<string[]>(["", ""]);
  const [industry, setIndustry] = useState("Retail");
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const setAt = (i: number, v: string) =>
    setLocations((cur) => cur.map((x, j) => (j === i ? v : x)));

  const filled = locations.filter((l) => l.trim().length >= 3);

  async function compare() {
    if (filled.length === 0 || busy) return;
    setBusy(true); setError(""); setData(null);
    try {
      const params = new URLSearchParams({ locations: filled.join("|"), industry });
      const res = await fetch(`/api/location-intel?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Lookup failed.");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed. Please try again.");
    }
    setBusy(false);
  }

  const points: MapPoint[] = (data?.results ?? [])
    .map((r, i) => (r.profile ? { lat: r.profile.geography.lat, lon: r.profile.geography.lon, label: r.profile.geography.label, rank: i } : null))
    .filter((p): p is MapPoint => p !== null);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <H>Compare locations</H>
        <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 16px", maxWidth: 640, lineHeight: 1.55 }}>
          Score up to three markets on spending power, what businesses there actually earn, how much room is left, and
          whether the population is growing. A crowded market is not automatically a weak one — a busy market where
          businesses earn well scores highly.
        </div>

        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
          {locations.map((loc, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{
                width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                background: PIN_COLORS[i % PIN_COLORS.length],
              }} />
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={loc}
                onChange={(e) => setAt(i, e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && compare()}
                placeholder={i === 0 ? "Clarksville, TN" : "Nashville, TN  ·  or a ZIP code"}
                aria-label={`Location ${i + 1}`}
              />
              {locations.length > 1 && (
                <button
                  onClick={() => setLocations((cur) => cur.filter((_, j) => j !== i))}
                  aria-label={`Remove location ${i + 1}`}
                  style={{
                    background: "transparent", border: `1px solid ${C.line}`, borderRadius: 8,
                    padding: 8, cursor: "pointer", display: "flex", color: C.mist,
                  }}
                ><X size={14} /></button>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {locations.length < 3 && (
            <Btn tone="ghost" onClick={() => setLocations((cur) => [...cur, ""])}>
              <Plus size={14} style={{ verticalAlign: -2, marginRight: 5 }} />Add location
            </Btn>
          )}
          <select
            style={{ ...inputStyle, width: "auto", flex: "1 1 190px" }}
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            aria-label="Industry"
          >
            {Object.keys(INDUSTRIES).map((i) => <option key={i}>{i}</option>)}
          </select>
          <Btn tone="green" onClick={compare} disabled={busy || filled.length === 0}>
            <Search size={15} style={{ verticalAlign: -3, marginRight: 6 }} />
            {busy ? "Comparing…" : "Compare"}
          </Btn>
        </div>

        {busy && (
          <div style={{ fontSize: 13, color: C.mist, marginTop: 14 }}>
            Pulling Census figures for each market. The first lookup for a new area takes a few seconds.
          </div>
        )}
        {error && <div style={{ fontSize: 13.5, color: C.alert, marginTop: 14 }}>{error}</div>}
      </Card>

      {points.length > 0 && (
        <Card>
          <H size={15}><MapPin size={15} style={{ verticalAlign: -2, marginRight: 6 }} color={C.ledger} />Where these markets are</H>
          <div style={{ marginTop: 12 }}><ComparisonMap points={points} /></div>
        </Card>
      )}

      {data && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit,minmax(300px,1fr))`, gap: 16 }}>
          {data.results.map((r, i) => {
            if (r.error || !r.profile || !r.score) {
              return (
                <Card key={r.query}>
                  <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 15 }}>{r.query}</div>
                  <div style={{ fontSize: 13, color: C.alert, marginTop: 6 }}>{r.error ?? "No data available."}</div>
                </Card>
              );
            }

            const s = r.score;
            return (
              <Card key={r.query} style={{ borderTop: `3px solid ${PIN_COLORS[i % PIN_COLORS.length]}` }}>
                <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 16, color: C.ink }}>
                  {r.profile.geography.label}
                </div>
                <div style={{ fontSize: 12, color: C.mist, marginTop: 2, marginBottom: 14 }}>
                  {data.sector.label}
                </div>

                {s.score !== null && (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 38, fontWeight: 700, color: scoreColor(s.score) }}>
                      {s.score}
                    </span>
                    <span style={{ fontSize: 12.5, color: C.mist, lineHeight: 1.4 }}>
                      Opportunity score<br />
                      <span style={{ fontSize: 11 }}>50 = national average · {s.confidence} confidence</span>
                    </span>
                  </div>
                )}

                <div style={{ display: "grid", gap: 12 }}>
                  {s.factors.map((f) => (
                    <div key={f.key}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                        <DirectionIcon d={f.direction} />
                        <span style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 13, color: C.ink }}>
                          {f.label}
                        </span>
                        {f.subscore !== null && (
                          <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.mist, marginLeft: "auto" }}>
                            {Math.round(f.subscore)}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: C.mist, lineHeight: 1.5, paddingLeft: 21 }}>
                        {f.reading}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {data && (
        <div style={{ fontSize: 11.5, color: C.mist, lineHeight: 1.6 }}>
          Scores compare each market against the national average using US Census figures — American Community Survey
          for population and income, Economic Census for business revenue. They describe the market, not any particular
          business, and are not a prediction of how a business would perform.
          {data.sector.benchmarkNote ? ` ${data.sector.benchmarkNote}` : ""}
        </div>
      )}
    </div>
  );
}
