"use client";

import { useState } from "react";
import { Truck, Search, Info, MapPin } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import { SUPPLY_CATEGORIES } from "@/lib/sourcing";
import { Card, H, Btn, inputStyle } from "./ui";
import ComparisonMap, { type MapPoint } from "./ComparisonMap";

type Cluster = {
  fips: string;
  county: string;
  state: string;
  establishments: number;
  distanceMiles: number;
  estimatedFreightOneWay: number | null;
  isLocal: boolean;
  lat: number;
  lon: number;
};

type SourcingResponse = {
  category: { label: string; naics: string; note: string };
  origin: { label: string; lat: number; lon: number };
  clusters: Cluster[];
  totalCountiesWithSuppliers: number;
  freight: { dollarsPerMile: number; localRadiusMiles: number; basis: string };
  source: string;
  limitations: string[];
};

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function SourcingPanel({ defaultLocation = "" }: { defaultLocation?: string }) {
  const [location, setLocation] = useState(defaultLocation);
  const [category, setCategory] = useState<string>(SUPPLY_CATEGORIES[10].key);
  const [rankBy, setRankBy] = useState<"distance" | "density">("distance");
  const [data, setData] = useState<SourcingResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    if (location.trim().length < 3 || busy) return;
    setBusy(true); setError(""); setData(null);
    try {
      const params = new URLSearchParams({ location: location.trim(), category, rankBy });
      const res = await fetch(`/api/sourcing?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Lookup failed.");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed. Please try again.");
    }
    setBusy(false);
  }

  const points: MapPoint[] = data
    ? [
        { lat: data.origin.lat, lon: data.origin.lon, label: `You — ${data.origin.label}`, rank: 0 },
        ...data.clusters.slice(0, 5).map((c, i) => ({
          lat: c.lat, lon: c.lon,
          label: `${c.county}, ${c.state} — ${c.establishments} suppliers`,
          rank: i + 1,
        })),
      ]
    : [];

  const selected = SUPPLY_CATEGORIES.find((c) => c.key === category);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <H>What do you need to source?</H>
        <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 16px", maxWidth: 640, lineHeight: 1.55 }}>
          Find where a supplier industry actually clusters, how far each cluster is from you, and roughly what freight
          would add. This shows <b>where suppliers are</b> — not their names or prices, neither of which any free
          federal source publishes.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          <input
            style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Clarksville, TN  ·  or 37040" aria-label="Your location"
          />
          <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Supply category">
            {SUPPLY_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <select style={inputStyle} value={rankBy} onChange={(e) => setRankBy(e.target.value as "distance" | "density")} aria-label="Rank by">
            <option value="distance">Nearest first</option>
            <option value="density">Most suppliers first</option>
          </select>
        </div>

        {selected && (
          <div style={{ fontSize: 12, color: C.mist, marginTop: 8 }}>
            {selected.note} · NAICS {selected.naics}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <Btn tone="green" onClick={run} disabled={busy || location.trim().length < 3}>
            <Search size={15} style={{ verticalAlign: -3, marginRight: 6 }} />
            {busy ? "Searching…" : "Find suppliers"}
          </Btn>
        </div>

        {error && <div style={{ fontSize: 13.5, color: C.alert, marginTop: 12 }}>{error}</div>}
      </Card>

      {data && (
        <>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
              <H size={16}>
                <Truck size={16} style={{ verticalAlign: -3, marginRight: 7 }} color={C.ledger} />
                {data.category.label}
              </H>
              <div style={{ fontSize: 12.5, color: C.mist }}>
                {data.totalCountiesWithSuppliers.toLocaleString("en-US")} counties nationwide have suppliers in this industry
              </div>
            </div>

            <div style={{ overflowX: "auto", marginTop: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 520 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "9px 10px", borderBottom: `1px solid ${C.line}`, fontFamily: FONT_HEAD }}>County</th>
                    <th style={{ textAlign: "right", padding: "9px 10px", borderBottom: `1px solid ${C.line}`, fontFamily: FONT_HEAD }}>Suppliers</th>
                    <th style={{ textAlign: "right", padding: "9px 10px", borderBottom: `1px solid ${C.line}`, fontFamily: FONT_HEAD }}>Distance</th>
                    <th style={{ textAlign: "right", padding: "9px 10px", borderBottom: `1px solid ${C.line}`, fontFamily: FONT_HEAD }}>Est. freight</th>
                  </tr>
                </thead>
                <tbody>
                  {data.clusters.map((c) => (
                    <tr key={c.fips}>
                      <td style={{ padding: "9px 10px", borderBottom: `1px solid ${C.line}` }}>
                        {c.county}, {c.state}
                      </td>
                      <td style={{
                        padding: "9px 10px", borderBottom: `1px solid ${C.line}`, textAlign: "right",
                        fontFamily: FONT_MONO, fontVariantNumeric: "tabular-nums",
                      }}>{c.establishments}</td>
                      <td style={{
                        padding: "9px 10px", borderBottom: `1px solid ${C.line}`, textAlign: "right",
                        fontFamily: FONT_MONO, fontVariantNumeric: "tabular-nums", color: C.mist,
                      }}>{Math.round(c.distanceMiles)} mi</td>
                      <td style={{
                        padding: "9px 10px", borderBottom: `1px solid ${C.line}`, textAlign: "right",
                        fontFamily: FONT_MONO, fontVariantNumeric: "tabular-nums",
                        color: c.isLocal ? C.ledger : C.ink,
                      }}>
                        {c.isLocal ? "local" : `~${usd(c.estimatedFreightOneWay as number)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: 7, marginTop: 14, alignItems: "flex-start" }}>
              <Info size={13} color={C.signal} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: 11.5, color: C.mist, lineHeight: 1.55 }}>
                Freight is estimated at {usd(data.freight.dollarsPerMile)}/mile one way for a truckload.{" "}
                {data.freight.basis} Within {data.freight.localRadiusMiles} miles it shows &quot;local&quot; instead of a
                figure, because short-haul cost is driven by loading and minimum charges rather than distance — a
                per-mile number there would understate it.
              </div>
            </div>
          </Card>

          {points.length > 1 && (
            <Card>
              <H size={15}>
                <MapPin size={15} style={{ verticalAlign: -2, marginRight: 6 }} color={C.ledger} />
                You and the nearest clusters
              </H>
              <div style={{ marginTop: 12 }}><ComparisonMap points={points} /></div>
            </Card>
          )}

          <Card>
            <H size={15}>What this can and can&apos;t tell you</H>
            <ul style={{ margin: "10px 0 0", paddingLeft: 18, display: "grid", gap: 6 }}>
              {data.limitations.map((l, i) => (
                <li key={i} style={{ fontSize: 12.5, color: C.mist, lineHeight: 1.55 }}>{l}</li>
              ))}
            </ul>
            <div style={{ fontSize: 11.5, color: C.mist, marginTop: 12 }}>{data.source}</div>
          </Card>
        </>
      )}
    </div>
  );
}
