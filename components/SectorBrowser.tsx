"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Search, Map as MapIcon, Table2, ChartBar, Info, ChevronLeft } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import { US_STATES } from "@/lib/geo/usStates";
import { Card, H, inputStyle } from "./ui";

/* ------------------------------------------------------------------ */
/* Types — mirror lib/census/sectorBrowser.ts                          */
/* ------------------------------------------------------------------ */

type Industry = { code: string; label: string; digits: number; establishments: number };

type Area = {
  fips: string;
  name: string;
  establishments: number;
  employees: number | null;
  annualPayroll: number | null;
  averageWage: number | null;
  population: number | null;
  per10k: number | null;
  share: number;
};

type Distribution = {
  naics: { code: string; label: string };
  scope: { level: "state" | "county"; stateFips: string | null; label: string };
  totals: { establishments: number; employees: number | null; annualPayroll: number | null };
  areas: Area[];
  sizeBands: { label: string; establishments: number }[];
  areasWithoutData: number;
  source: string;
  limitations: string[];
};

type CountyMap = { width: number; height: number; counties: { id: string; name: string; d: string }[] };

type View = "map" | "table" | "chart";
type Metric = "establishments" | "per10k" | "employees" | "averageWage";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const METRICS: { key: Metric; label: string; short: string }[] = [
  { key: "establishments", label: "Number of establishments", short: "Establishments" },
  { key: "per10k", label: "Establishments per 10,000 residents", short: "Per 10k residents" },
  { key: "employees", label: "Employees", short: "Employees" },
  { key: "averageWage", label: "Average annual wage", short: "Avg wage" },
];

const VIEWS: { key: View; label: string; Icon: typeof MapIcon }[] = [
  { key: "map", label: "Map", Icon: MapIcon },
  { key: "table", label: "Table", Icon: Table2 },
  { key: "chart", label: "Chart", Icon: ChartBar },
];

const QUICK_PICKS = ["722511", "722513", "812112", "4451", "811111", "541211", "238", "6212"];

/** Five-step sequential green, light to dark, built from the brand ledger colour. */
const RAMP = ["#DDEFE8", "#AED8C8", "#6FB79C", "#2E9273", "#0B5E48"];
const NO_DATA = "#EEF1F0";
const WITHHELD = "#D5DBD9";

/** The states and DC, alphabetical — the scopes a user can drill into. */
const STATE_OPTIONS = US_STATES
  .filter((s) => Number(s.id) <= 56)
  .map((s) => ({ id: s.id, name: s.name }))
  .sort((a, b) => a.name.localeCompare(b.name));

const stateName = (fips: string | null) => STATE_OPTIONS.find((s) => s.id === fips)?.name ?? "";

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const int = (n: number) => Math.round(n).toLocaleString("en-US");
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compact = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(Math.round(n));

function formatMetric(metric: Metric, v: number | null): string {
  if (v === null) return "withheld";
  if (metric === "averageWage") return usd(v);
  if (metric === "per10k") return v.toFixed(1);
  return int(v);
}

const metricValue = (a: Area, m: Metric): number | null => a[m];

/**
 * Quantile breaks, so colour spreads across the areas actually present rather
 * than one giant state (California) pushing everyone else into the lightest bin.
 */
function quantileBreaks(values: number[]): number[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  return [0.2, 0.4, 0.6, 0.8].map((q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]);
}

function colourFor(v: number | null, breaks: number[]): string {
  if (v === null) return WITHHELD;
  const bin = breaks.findIndex((b) => v < b);
  return RAMP[bin === -1 ? RAMP.length - 1 : bin];
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function SectorBrowser() {
  const params = useSearchParams();

  // Filters live in the URL, so switching views never loses them and any
  // extract can be bookmarked or sent to someone.
  const [naics, setNaics] = useState<string>(params.get("naics") ?? "");
  const [state, setState] = useState<string>(params.get("state") ?? "");
  const [metric, setMetric] = useState<Metric>((params.get("metric") as Metric) || "establishments");
  const [view, setView] = useState<View>((params.get("view") as View) || "map");

  const [industries, setIndustries] = useState<Industry[] | null>(null);
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  // Keyed by the request it answers: "busy" is simply "the latest answer is
  // for a different request", so nothing is set synchronously in an effect.
  const [result, setResult] = useState<{ key: string; data: Distribution | null; error: string }>({
    key: "", data: null, error: "",
  });
  const requestKey = naics ? `${naics}|${state}` : "";
  const busy = requestKey !== "" && result.key !== requestKey;
  const data = requestKey ? result.data : null;
  const error = requestKey && result.key === requestKey ? result.error : "";

  useEffect(() => {
    const next = new URLSearchParams();
    if (naics) next.set("naics", naics);
    if (state) next.set("state", state);
    if (metric !== "establishments") next.set("metric", metric);
    if (view !== "map") next.set("view", view);
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [naics, state, metric, view]);

  useEffect(() => {
    fetch("/api/sectors")
      .then((r) => r.json())
      .then((j) => setIndustries(j.industries ?? []))
      .catch(() => setIndustries([]));
  }, []);

  useEffect(() => {
    if (!requestKey) return;
    let cancelled = false;
    const [code, st] = requestKey.split("|");
    const qs = new URLSearchParams({ naics: code });
    if (st) qs.set("state", st);
    fetch(`/api/sectors?${qs}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Lookup failed.");
        return j as Distribution;
      })
      .then((j) => { if (!cancelled) setResult({ key: requestKey, data: j, error: "" }); })
      .catch((e) => {
        if (!cancelled) {
          setResult({ key: requestKey, data: null, error: e instanceof Error ? e.message : "Lookup failed." });
        }
      });
    return () => { cancelled = true; };
  }, [requestKey]);

  const selectedIndustry = industries?.find((i) => i.code === naics);

  const matches = useMemo(() => {
    if (!industries) return [];
    const q = query.trim().toLowerCase();
    if (!q) return industries.filter((i) => i.digits === 2);
    return industries
      .filter((i) => i.code.startsWith(q) || i.label.toLowerCase().includes(q))
      .slice(0, 40);
  }, [industries, query]);

  function choose(code: string) {
    setNaics(code);
    setQuery("");
    setPickerOpen(false);
  }

  const values = useMemo(
    () => (data ? data.areas.map((a) => metricValue(a, metric)).filter((v): v is number => v !== null) : []),
    [data, metric],
  );
  const breaks = useMemo(() => quantileBreaks(values), [values]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* ---------------- Filters ---------------- */}
      <Card>
        <H>Choose an industry</H>
        <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 14px", maxWidth: 680, lineHeight: 1.55 }}>
          Search any of the {industries ? int(industries.length) : "1,300+"} industries the Census tracks, from broad
          sectors down to specific trades — by name or NAICS code.
        </div>

        <div style={{ position: "relative" }}>
          <Search size={15} color={C.mist} style={{ position: "absolute", left: 12, top: 12 }} />
          <input
            style={{ ...inputStyle, paddingLeft: 34 }}
            value={pickerOpen ? query : selectedIndustry ? `${selectedIndustry.label} · ${selectedIndustry.code}` : query}
            onFocus={() => { setPickerOpen(true); setQuery(""); }}
            onChange={(e) => { setQuery(e.target.value); setPickerOpen(true); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setPickerOpen(false);
              if (e.key === "Enter" && matches[0]) choose(matches[0].code);
            }}
            placeholder={industries ? "e.g. bakeries, dentists, 722511" : "Loading industries…"}
            aria-label="Search industries"
            role="combobox"
            aria-expanded={pickerOpen}
            aria-controls="sector-options"
          />
          {pickerOpen && (
            <>
              <div onClick={() => setPickerOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
              <div
                id="sector-options"
                role="listbox"
                style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 21,
                  background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10,
                  boxShadow: "0 12px 32px rgba(22,36,46,0.12)", maxHeight: 340, overflowY: "auto",
                }}
              >
                {!query.trim() && (
                  <div style={{ padding: "9px 12px 4px", fontSize: 11, color: C.mist, fontFamily: FONT_MONO, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Broad sectors — or type to search all
                  </div>
                )}
                {matches.length === 0 ? (
                  <div style={{ padding: 14, fontSize: 13, color: C.mist }}>
                    {industries ? "No industry matches that." : "Loading…"}
                  </div>
                ) : matches.map((i) => (
                  <button
                    key={i.code}
                    role="option"
                    aria-selected={i.code === naics}
                    onClick={() => choose(i.code)}
                    style={{
                      display: "flex", width: "100%", gap: 10, alignItems: "baseline", textAlign: "left",
                      padding: "8px 12px", paddingLeft: 12 + Math.max(0, i.digits - 2) * 10,
                      border: "none", background: i.code === naics ? C.ledgerSoft : "transparent", cursor: "pointer",
                    }}
                  >
                    <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.mist, minWidth: 50 }}>{i.code}</span>
                    <span style={{ flex: 1, fontSize: 13.5, color: C.ink }}>{i.label}</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.mist }}>{compact(i.establishments)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {!naics && industries && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
            <span style={{ fontSize: 12, color: C.mist, alignSelf: "center", marginRight: 2 }}>Try:</span>
            {QUICK_PICKS.map((code) => {
              const i = industries.find((x) => x.code === code);
              return i ? (
                <button key={code} onClick={() => choose(code)} style={{
                  fontSize: 12.5, color: C.ink, background: C.paper, border: `1px solid ${C.line}`,
                  borderRadius: 999, padding: "5px 11px", cursor: "pointer",
                }}>{i.label}</button>
              ) : null;
            })}
          </div>
        )}

        {naics && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 14 }}>
            <label style={{ display: "grid", gap: 5 }}>
              <span style={{ fontSize: 12, color: C.mist }}>Where</span>
              <select style={inputStyle} value={state} onChange={(e) => setState(e.target.value)} aria-label="Where">
                <option value="">All states — compare states</option>
                {STATE_OPTIONS.map((s) => <option key={s.id} value={s.id}>{s.name} — compare counties</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 5 }}>
              <span style={{ fontSize: 12, color: C.mist }}>Measure</span>
              <select style={inputStyle} value={metric} onChange={(e) => setMetric(e.target.value as Metric)} aria-label="Measure">
                {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </label>
          </div>
        )}
      </Card>

      {error && <Card><div style={{ fontSize: 13.5, color: C.alert }}>{error}</div></Card>}

      {naics && !data && busy && (
        <Card><div style={{ fontSize: 13.5, color: C.mist }}>Loading figures from the Census…</div></Card>
      )}

      {/* ---------------- Results ---------------- */}
      {data && (
        <>
          <Card style={{ opacity: busy ? 0.55 : 1, transition: "opacity .15s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.mist }}>NAICS {data.naics.code}</div>
                <H size={19}>{data.naics.label}</H>
                <div style={{ fontSize: 13, color: C.mist, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                  {state && (
                    <button onClick={() => setState("")} style={{
                      display: "inline-flex", alignItems: "center", gap: 2, border: "none", background: "none",
                      color: C.ledger, cursor: "pointer", fontSize: 13, padding: 0,
                    }}>
                      <ChevronLeft size={14} /> All states
                    </button>
                  )}
                  {state ? `Counties in ${stateName(state) || data.scope.label}` : "States and territories"}
                </div>
              </div>

              {/* View switcher — state above is untouched by it. */}
              <div role="tablist" aria-label="View" style={{
                display: "inline-flex", border: `1px solid ${C.line}`, borderRadius: 9, padding: 3, background: C.paper,
              }}>
                {VIEWS.map(({ key, label, Icon }) => (
                  <button
                    key={key} role="tab" aria-selected={view === key} onClick={() => setView(key)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 7,
                      border: "none", cursor: "pointer", fontFamily: FONT_HEAD, fontSize: 13.5, fontWeight: 600,
                      background: view === key ? "#fff" : "transparent",
                      color: view === key ? C.ink : C.mist,
                      boxShadow: view === key ? "0 1px 3px rgba(22,36,46,0.12)" : "none",
                    }}
                  >
                    <Icon size={15} /> {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, margin: "16px 0 18px" }}>
              <Stat label="Establishments" value={int(data.totals.establishments)} />
              <Stat label="Employees" value={data.totals.employees === null ? "withheld" : int(data.totals.employees)} />
              <Stat
                label="Average wage"
                value={data.totals.employees && data.totals.annualPayroll ? usd(data.totals.annualPayroll / data.totals.employees) : "withheld"}
              />
              <Stat
                label={state ? "Counties with none published" : "States with none published"}
                value={int(data.areasWithoutData)}
              />
            </div>

            {view === "map" && (
              <MapView
                data={data} metric={metric} breaks={breaks}
                onPickState={(fips) => setState(fips)}
              />
            )}
            {view === "table" && (
              <TableView key={metric} data={data} metric={metric} onPickState={state ? undefined : (fips) => setState(fips)} />
            )}
            {view === "chart" && <ChartView data={data} metric={metric} />}
          </Card>

          {data.sizeBands.length > 0 && (
            <Card>
              <H size={15}>How big are these businesses?</H>
              <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 12px" }}>
                Establishments by number of employees, {state ? `across ${stateName(state)}` : "nationally"}.
              </div>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={data.sizeBands} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11.5 }} />
                  <YAxis tick={{ fontSize: 11, fontFamily: FONT_MONO }} tickFormatter={compact} width={44} />
                  <Tooltip formatter={(v) => [int(v as number), "Establishments"]} labelFormatter={(l) => `${l} employees`} />
                  <Bar dataKey="establishments" fill={C.ledger} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {(() => {
                const total = data.sizeBands.reduce((s, b) => s + b.establishments, 0);
                const small = data.sizeBands.slice(0, 2).reduce((s, b) => s + b.establishments, 0);
                return total > 0 ? (
                  <div style={{ fontSize: 12.5, color: C.ink, marginTop: 8 }}>
                    {Math.round((small / total) * 100)}% have fewer than 10 employees.
                  </div>
                ) : null;
              })()}
            </Card>
          )}

          <Card>
            <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
              <Info size={14} color={C.signal} style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14, color: C.ink, marginBottom: 6 }}>
                  What these figures do and don&apos;t cover
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

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: C.paper, borderRadius: 9, padding: "10px 12px" }}>
      <div style={{ fontSize: 11.5, color: C.mist }}>{label}</div>
      <div style={{
        fontFamily: FONT_MONO, fontSize: 17, fontWeight: 600, marginTop: 2, fontVariantNumeric: "tabular-nums",
        color: value === "withheld" ? C.mist : C.ink,
      }}>{value}</div>
    </div>
  );
}

function MapView({
  data, metric, breaks, onPickState,
}: {
  data: Distribution; metric: Metric; breaks: number[]; onPickState: (fips: string) => void;
}) {
  const [loaded, setLoaded] = useState<{ fips: string; map: CountyMap } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; name: string; value: string } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stateFips = data.scope.stateFips;

  useEffect(() => {
    if (!stateFips) return;
    let cancelled = false;
    fetch(`/geo/counties/${stateFips}.json`)
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setLoaded({ fips: stateFips, map: j }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [stateFips]);
  const shapes = stateFips && loaded?.fips === stateFips ? loaded.map : null;

  const byFips = useMemo(() => new Map(data.areas.map((a) => [a.fips, a])), [data]);
  const metricLabel = METRICS.find((m) => m.key === metric)?.short ?? "";

  const regions = stateFips
    ? (shapes?.counties ?? []).map((c) => ({ id: c.id, name: c.name, d: c.d }))
    : US_STATES.map((s) => ({ id: s.id, name: s.name, d: s.d }));

  function track(e: React.MouseEvent, id: string, name: string) {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    const area = byFips.get(id);
    setHover({
      // Clamped here, while the box is measured, so the tooltip never runs off the right edge.
      x: Math.min(e.clientX - box.left + 12, box.width - 190),
      y: e.clientY - box.top,
      name: area?.name ?? name,
      value: area ? `${metricLabel}: ${formatMetric(metric, metricValue(area, metric))}` : "None published",
    });
  }

  if (stateFips && !shapes) {
    return <div style={{ height: 320, display: "grid", placeItems: "center", color: C.mist, fontSize: 13 }}>Loading map…</div>;
  }

  return (
    <div>
      <div ref={wrapRef} style={{ position: "relative" }} onMouseLeave={() => setHover(null)}>
        <svg
          viewBox={`0 0 ${shapes?.width ?? 975} ${shapes?.height ?? 610}`}
          style={{ width: "100%", height: "auto", display: "block" }}
          role="img"
          aria-label={`Map of ${metricLabel.toLowerCase()} by ${stateFips ? "county" : "state"}`}
        >
          {regions.map((r) => {
            const area = byFips.get(r.id);
            const fill = area ? colourFor(metricValue(area, metric), breaks) : NO_DATA;
            return (
              <path
                key={r.id}
                d={r.d}
                fill={fill}
                stroke="#fff"
                strokeWidth={stateFips ? 0.6 : 0.9}
                strokeLinejoin="round"
                style={{ cursor: !stateFips ? "pointer" : "default" }}
                onMouseMove={(e) => track(e, r.id, r.name)}
                onClick={() => { if (!stateFips) onPickState(r.id); }}
              />
            );
          })}
        </svg>

        {hover && (
          <div style={{
            position: "absolute", left: hover.x, top: hover.y + 12,
            background: C.ink, color: "#fff", borderRadius: 7, padding: "7px 10px", fontSize: 12.5,
            pointerEvents: "none", whiteSpace: "nowrap", boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
          }}>
            <div style={{ fontWeight: 600 }}>{hover.name}</div>
            <div style={{ opacity: 0.85, fontFamily: FONT_MONO, fontSize: 11.5 }}>{hover.value}</div>
          </div>
        )}
      </div>

      <Legend metric={metric} breaks={breaks} />
      {!stateFips && (
        <div style={{ fontSize: 12, color: C.mist, marginTop: 8 }}>Click a state to see its counties.</div>
      )}
    </div>
  );
}

function Legend({ metric, breaks }: { metric: Metric; breaks: number[] }) {
  if (breaks.length === 0) return null;
  const edges = [null, ...breaks, null];
  const fmt = (v: number) => (metric === "averageWage" ? `$${compact(v)}` : metric === "per10k" ? v.toFixed(1) : compact(v));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", marginTop: 12, fontSize: 11.5, color: C.mist }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {RAMP.map((colour, i) => (
          <div key={colour} style={{ textAlign: "center" }}>
            <div style={{ width: 44, height: 10, background: colour, borderRadius: 2 }} />
            <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, marginTop: 3 }}>
              {i === 0 ? `<${fmt(edges[1] as number)}` : i === RAMP.length - 1 ? `${fmt(edges[i] as number)}+` : fmt(edges[i] as number)}
            </div>
          </div>
        ))}
      </div>
      <Swatch colour={WITHHELD} label="Withheld" />
      <Swatch colour={NO_DATA} label="None published" border />
    </div>
  );
}

function Swatch({ colour, label, border }: { colour: string; label: string; border?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 12, height: 12, background: colour, borderRadius: 2, border: border ? `1px solid ${C.line}` : "none" }} />
      {label}
    </span>
  );
}

type SortKey = "name" | Metric | "share";

function TableView({
  data, metric, onPickState,
}: {
  data: Distribution; metric: Metric; onPickState?: (fips: string) => void;
}) {
  // Starts sorted by the chosen measure; the parent remounts this on a new
  // measure so the table always leads with it.
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: metric, desc: true });

  const rows = useMemo(() => {
    const copy = [...data.areas];
    copy.sort((a, b) => {
      if (sort.key === "name") return sort.desc ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
      const av = a[sort.key];
      const bv = b[sort.key];
      // Withheld figures always sink to the bottom, whichever way you sort.
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return sort.desc ? bv - av : av - bv;
    });
    return copy;
  }, [data, sort]);

  const columns: { key: SortKey; label: string; align: "left" | "right"; render: (a: Area) => string }[] = [
    { key: "name", label: data.scope.level === "county" ? "County" : "State", align: "left", render: (a) => a.name },
    { key: "establishments", label: "Establishments", align: "right", render: (a) => int(a.establishments) },
    { key: "per10k", label: "Per 10k residents", align: "right", render: (a) => (a.per10k === null ? "—" : a.per10k.toFixed(1)) },
    { key: "employees", label: "Employees", align: "right", render: (a) => formatMetric("employees", a.employees) },
    { key: "averageWage", label: "Avg wage", align: "right", render: (a) => formatMetric("averageWage", a.averageWage) },
    { key: "share", label: "Share", align: "right", render: (a) => `${(a.share * 100).toFixed(1)}%` },
  ];

  return (
    <div style={{ overflowX: "auto", maxHeight: 560, overflowY: "auto", border: `1px solid ${C.line}`, borderRadius: 9 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 640 }}>
        <thead style={{ position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align, padding: 0, borderBottom: `1px solid ${C.line}` }}>
                <button
                  onClick={() => setSort((s) => ({ key: c.key, desc: s.key === c.key ? !s.desc : c.key !== "name" }))}
                  style={{
                    width: "100%", textAlign: c.align, padding: "10px 12px", border: "none", background: "none",
                    cursor: "pointer", fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 13,
                    color: sort.key === c.key || c.key === metric ? C.ink : C.mist, whiteSpace: "nowrap",
                  }}
                >
                  {c.label}{sort.key === c.key ? (sort.desc ? " ↓" : " ↑") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.fips}>
              {columns.map((c) => {
                const text = c.render(a);
                return (
                  <td key={c.key} style={{
                    textAlign: c.align, padding: "8px 12px", borderBottom: `1px solid ${C.line}`,
                    fontFamily: c.align === "right" ? FONT_MONO : undefined, fontVariantNumeric: "tabular-nums",
                    color: text === "withheld" || text === "—" ? C.mist : C.ink,
                    background: c.key === metric ? "rgba(14,123,95,0.04)" : undefined,
                  }}>
                    {c.key === "name" && onPickState && Number(a.fips) <= 56 ? (
                      <button onClick={() => onPickState(a.fips)} style={{
                        border: "none", background: "none", padding: 0, cursor: "pointer",
                        color: C.ledger, fontSize: 13.5, textAlign: "left",
                      }}>{text}</button>
                    ) : text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartView({ data, metric }: { data: Distribution; metric: Metric }) {
  const TOP = 15;
  const ranked = data.areas
    .filter((a) => metricValue(a, metric) !== null)
    .sort((a, b) => (metricValue(b, metric) as number) - (metricValue(a, metric) as number));
  const shown = ranked.slice(0, TOP).map((a) => ({ name: a.name, value: metricValue(a, metric) as number }));
  const withheld = data.areas.length - ranked.length;
  const metricLabel = METRICS.find((m) => m.key === metric)?.label ?? "";

  return (
    <div>
      <div style={{ fontSize: 12.5, color: C.mist, marginBottom: 8 }}>
        Top {shown.length} of {ranked.length} by {metricLabel.toLowerCase()}
        {withheld > 0 && <> · {withheld} withheld and not shown</>}
      </div>
      <ResponsiveContainer width="100%" height={Math.max(220, shown.length * 30 + 30)}>
        <BarChart data={shown} layout="vertical" margin={{ left: 8, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.line} horizontal={false} />
          <XAxis
            type="number" tick={{ fontSize: 11, fontFamily: FONT_MONO }}
            tickFormatter={(v) => (metric === "averageWage" ? `$${compact(v)}` : metric === "per10k" ? String(v) : compact(v))}
          />
          <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} interval={0} />
          <Tooltip formatter={(v) => [formatMetric(metric, v as number), metricLabel]} />
          <Bar dataKey="value" fill={C.ledger} radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
