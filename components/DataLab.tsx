"use client";

import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Search, Download, FileDown, Info } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import { INDUSTRIES } from "@/lib/data";
import { Card, H, Btn, inputStyle } from "./ui";

type SeriesPoint = { year: number; value: number | null };
type Series = {
  indicator: string;
  label: string;
  unit: "count" | "currency";
  source: string;
  geography: string;
  points: SeriesPoint[];
  change: number | null;
};

type LabResponse = {
  geography: { label: string; level: string };
  sector: { label: string; code: string };
  series: Series[];
  methodology: string[];
};

const INDICATOR_OPTIONS = [
  { key: "establishments", label: "Businesses" },
  { key: "employment", label: "Employment" },
  { key: "annual_payroll", label: "Annual payroll" },
  { key: "population", label: "Population" },
  { key: "median_income", label: "Median household income" },
];

const LEVELS = [
  { value: "zip", label: "ZIP code" },
  { value: "county", label: "County" },
  { value: "state", label: "State" },
];

const LINE_COLORS = [C.ledger, C.signal, C.ink2, C.alert, C.mist];

const fmtValue = (v: number | null, unit: "count" | "currency") => {
  if (v === null) return "—";
  return unit === "currency"
    ? v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : v.toLocaleString("en-US");
};

export default function DataLab() {
  const [location, setLocation] = useState("");
  const [level, setLevel] = useState("county");
  const [industry, setIndustry] = useState("Restaurant / Food service");
  const [selected, setSelected] = useState<string[]>(["establishments", "employment"]);
  const [data, setData] = useState<LabResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const toggle = (key: string) =>
    setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));

  async function run() {
    if (location.trim().length < 3 || selected.length === 0 || busy) return;
    setBusy(true); setError(""); setData(null);
    try {
      const params = new URLSearchParams({
        location: location.trim(), level, industry, indicators: selected.join(","),
      });
      const res = await fetch(`/api/timeseries?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Lookup failed.");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed. Please try again.");
    }
    setBusy(false);
  }

  /** Years present across any selected series, so gaps stay visible. */
  const years = data
    ? Array.from(new Set(data.series.flatMap((s) => s.points.map((p) => p.year)))).sort()
    : [];

  const chartData = years.map((year) => {
    const row: Record<string, number | string | null> = { year };
    data?.series.forEach((s) => {
      row[s.label] = s.points.find((p) => p.year === year)?.value ?? null;
    });
    return row;
  });

  function downloadCsv() {
    if (!data) return;
    const header = ["Year", ...data.series.map((s) => s.label)];
    const rows = years.map((y) => [
      String(y),
      ...data.series.map((s) => {
        const v = s.points.find((p) => p.year === y)?.value;
        return v === null || v === undefined ? "" : String(v);
      }),
    ]);
    const meta = [
      [],
      ["Geography", data.geography.label],
      ["Sector", `${data.sector.label} (NAICS ${data.sector.code})`],
      ["Exported", new Date().toISOString().slice(0, 10)],
      ...data.series.map((s) => [`Source — ${s.label}`, s.source]),
    ];
    const csv = [header, ...rows, ...meta]
      .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `microbiz-data-${data.geography.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportReport() {
    if (!data) return;
    setExporting(true);
    try {
      const columns = ["Year", ...data.series.map((s) => s.label)];
      const rows = years.map((y) => [
        String(y),
        ...data.series.map((s) => {
          const pt = s.points.find((p) => p.year === y);
          return fmtValue(pt?.value ?? null, s.unit);
        }),
      ]);

      const trends = data.series
        .filter((s) => s.change !== null)
        .map((s) => `${s.label}: ${s.change! >= 0 ? "+" : ""}${(s.change! * 100).toFixed(1)}% across the period shown.`);

      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Research Data Extract",
          subtitle: `${data.geography.label} · ${data.sector.label}`,
          sections: [
            { heading: "Trends", paragraphs: trends.length ? trends : ["No indicator had enough published data to compute a trend."] },
            { heading: "Data", table: { columns, rows } },
            { heading: "Methodology", paragraphs: data.methodology },
          ],
          sources: data.series.map((s) => `${s.label}: ${s.source} · ${s.geography}`),
          limitations:
            "Figures are as published by the US Census Bureau. Gaps indicate values withheld to protect confidentiality, not zeros. MicroBiz AI is an educational tool and not financial, legal, tax, or investment advice.",
        }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "research-data-extract.docx";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Couldn't build the document. Please try again.");
    }
    setExporting(false);
  }

  return (
    <div style={{ display: "grid", gap: 16 }} className="print-area">
      <Card className="no-print">
        <H>Build a query</H>
        <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 18px", maxWidth: 640, lineHeight: 1.55 }}>
          Pick a place, a sector and the indicators you want, and see how they&apos;ve moved year by year. Business
          figures run 2017–2023; population and income 2018–2023.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginBottom: 16 }}>
          <input
            style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Clarksville, TN  ·  or 37040" aria-label="Location"
          />
          <select style={inputStyle} value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Geography level">
            {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <select style={inputStyle} value={industry} onChange={(e) => setIndustry(e.target.value)} aria-label="Sector">
            {Object.keys(INDUSTRIES).map((i) => <option key={i}>{i}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase",
            color: C.mist, fontWeight: 600, marginBottom: 8,
          }}>Indicators</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {INDICATOR_OPTIONS.map((opt) => {
              const on = selected.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  onClick={() => toggle(opt.key)}
                  aria-pressed={on}
                  style={{
                    fontFamily: FONT_HEAD, fontSize: 13, fontWeight: 500,
                    padding: "7px 13px", borderRadius: 999, cursor: "pointer",
                    border: `1px solid ${on ? C.ledger : C.line}`,
                    background: on ? C.ledgerSoft : "#fff",
                    color: on ? C.ledger : C.mist,
                  }}
                >{opt.label}</button>
              );
            })}
          </div>
          {level === "zip" && (
            <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "flex-start" }}>
              <Info size={13} color={C.signal} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: 11.5, color: C.mist, lineHeight: 1.5 }}>
                At ZIP level Census withholds employment and payroll. Those series will come back empty — switch to
                county to see them.
              </div>
            </div>
          )}
        </div>

        <Btn tone="green" onClick={run} disabled={busy || location.trim().length < 3 || selected.length === 0}>
          <Search size={15} style={{ verticalAlign: -3, marginRight: 6 }} />
          {busy ? "Querying…" : "Run query"}
        </Btn>

        {busy && (
          <div style={{ fontSize: 13, color: C.mist, marginTop: 12 }}>
            Pulling every year for each indicator. The first run for a new area takes a few seconds.
          </div>
        )}
        {error && <div style={{ fontSize: 13.5, color: C.alert, marginTop: 12 }}>{error}</div>}
      </Card>

      {data && (
        <>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <H size={16}>{data.geography.label}</H>
                <div style={{ fontSize: 12.5, color: C.mist, marginTop: 2 }}>
                  {data.sector.label} · NAICS {data.sector.code}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} className="no-print">
                <Btn tone="ghost" onClick={downloadCsv}>
                  <Download size={14} style={{ verticalAlign: -2, marginRight: 6 }} />CSV
                </Btn>
                <Btn tone="green" onClick={exportReport} disabled={exporting}>
                  <FileDown size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                  {exporting ? "Building…" : "Word report"}
                </Btn>
              </div>
            </div>

            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 14 }}>
              {data.series.filter((s) => s.change !== null).map((s, i) => (
                <div key={s.indicator}>
                  <div style={{ fontSize: 11.5, color: C.mist }}>{s.label}</div>
                  <div style={{
                    fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700,
                    color: (s.change as number) >= 0 ? C.ledger : C.alert,
                  }}>
                    {(s.change as number) >= 0 ? "+" : ""}{((s.change as number) * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 11, color: C.mist }}>
                    {s.points.find((p) => p.value !== null)?.year}–{[...s.points].reverse().find((p) => p.value !== null)?.year}
                  </div>
                  <div style={{ height: 2, background: LINE_COLORS[i % LINE_COLORS.length], marginTop: 5, width: 34 }} />
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20 }}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11, fontFamily: FONT_MONO }} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip formatter={(v) => (v as number).toLocaleString("en-US")} />
                  <Legend />
                  {data.series.map((s, i) => (
                    <Line
                      key={s.indicator} type="monotone" dataKey={s.label}
                      stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2}
                      dot={{ r: 3 }} connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <H size={15}>Table</H>
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 460 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "9px 10px", borderBottom: `1px solid ${C.line}`, fontFamily: FONT_HEAD }}>Year</th>
                    {data.series.map((s) => (
                      <th key={s.indicator} style={{
                        textAlign: "right", padding: "9px 10px",
                        borderBottom: `1px solid ${C.line}`, fontFamily: FONT_HEAD,
                      }}>{s.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {years.map((y) => (
                    <tr key={y}>
                      <td style={{ padding: "9px 10px", borderBottom: `1px solid ${C.line}`, fontFamily: FONT_MONO }}>{y}</td>
                      {data.series.map((s) => {
                        const pt = s.points.find((p) => p.year === y);
                        const missing = !pt || pt.value === null;
                        return (
                          <td key={s.indicator} style={{
                            padding: "9px 10px", borderBottom: `1px solid ${C.line}`, textAlign: "right",
                            fontFamily: FONT_MONO, fontVariantNumeric: "tabular-nums",
                            color: missing ? C.mist : C.ink,
                          }}>
                            {missing ? "—" : fmtValue(pt!.value, s.unit)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11.5, color: C.mist, marginTop: 10 }}>
              A dash means the figure was not published for that year and geography — it is not a zero.
            </div>
          </Card>

          <Card>
            <H size={15}>Methodology &amp; sources</H>
            <ul style={{ margin: "10px 0 0", paddingLeft: 18, display: "grid", gap: 6 }}>
              {data.methodology.map((m, i) => (
                <li key={i} style={{ fontSize: 12.5, color: C.mist, lineHeight: 1.55 }}>{m}</li>
              ))}
            </ul>
            <div style={{ marginTop: 12, display: "grid", gap: 4 }}>
              {data.series.map((s) => (
                <div key={s.indicator} style={{ fontSize: 11.5, color: C.mist }}>
                  <b style={{ color: C.ink2 }}>{s.label}</b> — {s.source} · {s.geography}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
