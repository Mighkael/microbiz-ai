"use client";

import { useState } from "react";
import { Search, Info } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import { INDUSTRIES } from "@/lib/data";
import { Card, H, Btn, inputStyle } from "./ui";
import CommunityPanel from "./CommunityPanel";

type DataPoint = {
  value: number | null;
  status: "observed" | "suppressed" | "calculated" | "unavailable";
  source: string;
  vintage: string;
  geography: string;
  note?: string;
};

type Activity = {
  geography: string;
  sector: { code: string; label: string };
  establishments: DataPoint;
  employees: DataPoint;
  annualPayroll: DataPoint;
} | null;

type Demographics = {
  geography: string;
  population: DataPoint;
  medianHouseholdIncome: DataPoint;
} | null;

type MarketResult = {
  geography: { displayName: string; zip: string | null; county: string | null; state: string };
  sector: { code: string; label: string };
  demographics: { zip: Demographics; county: Demographics };
  activity: { zip: Activity; county: Activity; countyAllSectors: Activity };
};

const fmtNum = (n: number) => n.toLocaleString("en-US");
const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Renders a figure with its provenance, or explains honestly why it's missing. */
function Figure({ label, point, format }: { label: string; point: DataPoint | undefined; format: (n: number) => string }) {
  if (!point) return null;
  const missing = point.value === null;

  return (
    <div style={{ padding: "14px 0", borderBottom: `1px solid ${C.line}` }}>
      <div style={{
        fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase",
        color: C.mist, fontWeight: 600, marginBottom: 6,
      }}>{label}</div>

      {missing ? (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
          <Info size={14} color={C.signal} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontFamily: FONT_HEAD, fontSize: 14, fontWeight: 600, color: C.signal }}>
              {point.status === "suppressed" ? "Withheld by Census" : "Not available"}
            </div>
            {point.note && (
              <div style={{ fontSize: 12, color: C.mist, marginTop: 3, lineHeight: 1.5 }}>{point.note}</div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 600, color: C.ink }}>
          {format(point.value as number)}
        </div>
      )}

      <div style={{ fontSize: 11, color: C.mist, marginTop: 6 }}>
        {point.source} · {point.vintage} · {point.geography}
      </div>
    </div>
  );
}

export default function MarketSnapshot() {
  const [location, setLocation] = useState("");
  const [industry, setIndustry] = useState("Retail");
  const [result, setResult] = useState<MarketResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!location.trim() || busy) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const params = new URLSearchParams({ location: location.trim(), industry });
      const res = await fetch(`/api/market?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed. Please try again.");
    }
    setBusy(false);
  }

  return (
    <>
      <Card>
      <H>Market snapshot</H>
      <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 16px", maxWidth: 620, lineHeight: 1.55 }}>
        Live figures from the US Census Bureau for any city or ZIP code — who lives there, and how many businesses
        operate in your sector. Every number shows its source and year.
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <input
          style={{ ...inputStyle, flex: "2 1 220px" }}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Clarksville, TN  ·  or  37040"
          aria-label="City and state, or ZIP code"
        />
        <select
          style={{ ...inputStyle, flex: "1 1 190px" }}
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          aria-label="Industry"
        >
          {Object.keys(INDUSTRIES).map((i) => <option key={i}>{i}</option>)}
        </select>
        <Btn tone="green" onClick={run} disabled={busy}>
          <Search size={15} style={{ verticalAlign: -3, marginRight: 6 }} />
          {busy ? "Looking up…" : "Look up"}
        </Btn>
      </div>

      {error && <div style={{ color: C.alert, fontSize: 13.5, marginTop: 10 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 18 }}>
          <div style={{
            background: C.paper, borderRadius: 8, padding: "12px 14px", marginBottom: 18,
            fontSize: 13, color: C.ink2,
          }}>
            <b style={{ fontFamily: FONT_HEAD }}>{result.geography.displayName}</b>
            <div style={{ color: C.mist, marginTop: 3, fontSize: 12.5 }}>
              Sector: {result.sector.label} (NAICS {result.sector.code})
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 26 }}>
            {result.geography.zip && (
              <div>
                <div style={{
                  fontFamily: FONT_HEAD, fontSize: 14, fontWeight: 700,
                  color: C.ink, marginBottom: 2,
                }}>ZIP {result.geography.zip}</div>
                <div style={{ fontSize: 12, color: C.mist, marginBottom: 8 }}>Neighborhood level</div>
                <Figure label="Population" point={result.demographics.zip?.population} format={fmtNum} />
                <Figure label="Median household income" point={result.demographics.zip?.medianHouseholdIncome} format={fmtUsd} />
                <Figure label="Businesses in sector" point={result.activity.zip?.establishments} format={fmtNum} />
                <Figure label="Employees in sector" point={result.activity.zip?.employees} format={fmtNum} />
              </div>
            )}

            <div>
              <div style={{
                fontFamily: FONT_HEAD, fontSize: 14, fontWeight: 700,
                color: C.ink, marginBottom: 2,
              }}>{result.geography.county ?? "County"}</div>
              <div style={{ fontSize: 12, color: C.mist, marginBottom: 8 }}>County level</div>
              <Figure label="Population" point={result.demographics.county?.population} format={fmtNum} />
              <Figure label="Median household income" point={result.demographics.county?.medianHouseholdIncome} format={fmtUsd} />
              <Figure label="Businesses in sector" point={result.activity.county?.establishments} format={fmtNum} />
              <Figure label="Employees in sector" point={result.activity.county?.employees} format={fmtNum} />
              <Figure label="Annual payroll in sector" point={result.activity.county?.annualPayroll} format={fmtUsd} />
              <Figure label="All businesses, every sector" point={result.activity.countyAllSectors?.establishments} format={fmtNum} />
            </div>
          </div>
        </div>
      )}
    </Card>

      {result && (
        <div style={{ marginTop: 16 }}>
          <CommunityPanel
            location={location}
            industry={industry}
            compact
            heading="Who lives in this market"
          />
        </div>
      )}
    </>
  );
}
