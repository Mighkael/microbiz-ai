"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Search, TrendingUp, Users, ListChecks, UserCog, Info, Plus, Check, Trash2,
  ExternalLink, Mail, Phone, Download, ShieldAlert,
} from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import { INDUSTRIES } from "@/lib/data";
import type { Profile } from "@/lib/data";
import { useLocalState } from "@/lib/useLocalState";
import {
  STAGES, sanitizeProspectData, emptyProspectData,
  type PipelineEntry, type Prospect, type ProspectData, type Stage,
} from "@/lib/prospects/types";
import { TARGET_CATEGORIES, SUGGESTED_TARGETS } from "@/lib/prospects/categories";
import { Card, H, Btn, inputStyle } from "../ui";
import OutreachDialog from "./OutreachDialog";

const STORAGE_KEY = "microbiz.prospects";
const MAX_TARGETS = 4;

type Tab = "demand" | "find" | "pipeline" | "details";

const TABS: { key: Tab; label: string; Icon: typeof Search }[] = [
  { key: "demand", label: "Is there demand?", Icon: TrendingUp },
  { key: "find", label: "Find prospects", Icon: Search },
  { key: "pipeline", label: "Pipeline", Icon: ListChecks },
  { key: "details", label: "Your details", Icon: UserCog },
];

/* ------------------------------------------------------------------ */
/* Demand                                                              */
/* ------------------------------------------------------------------ */

type DemandResponse = {
  sector: { label: string; code: string };
  geography: { label: string; population: number | null };
  localBusinesses: number | null;
  localPer10k: number | null;
  nationalPer10k: number | null;
  competition: "crowded" | "typical" | "underserved" | null;
  reading: string;
  seasonality: {
    year: number;
    quarters: { quarter: number; label: string; employment: number | null; establishments: number | null }[];
    busiest: { label: string } | null;
    quietest: { label: string } | null;
    swingPercent: number | null;
    source: string;
  } | null;
  sources: string[];
  searchVolumeNote: string;
};

const COMPETITION_STYLE = {
  underserved: { label: "Fewer than average", color: C.ledger, bg: C.ledgerSoft },
  typical: { label: "About average", color: C.ink2, bg: C.paper },
  crowded: { label: "Busier than average", color: C.signal, bg: "#FBF1E1" },
} as const;

function DemandTab({ location, industry, onLocation, onIndustry }: {
  location: string; industry: string;
  onLocation: (v: string) => void; onIndustry: (v: string) => void;
}) {
  const [shown, setShown] = useState<{ location: string; industry: string }>({ location: "", industry: "" });
  const key = shown.location ? `${shown.location}|${shown.industry}` : "";
  const [result, setResult] = useState<{ key: string; data: DemandResponse | null; error: string }>({ key: "", data: null, error: "" });

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const [loc, ind] = key.split("|");
    fetch(`/api/prospects/demand?location=${encodeURIComponent(loc)}&industry=${encodeURIComponent(ind)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Couldn't read demand.");
        return j as DemandResponse;
      })
      .then((d) => { if (!cancelled) setResult({ key, data: d, error: "" }); })
      .catch((e) => { if (!cancelled) setResult({ key, data: null, error: e instanceof Error ? e.message : "Couldn't read demand." }); });
    return () => { cancelled = true; };
  }, [key]);

  const busy = key !== "" && result.key !== key;
  const data = result.key === key ? result.data : null;
  const error = result.key === key ? result.error : "";

  const chart = data?.seasonality?.quarters.map((q) => ({ name: q.label, Employment: q.employment })) ?? [];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <H>How much need is there for this, here?</H>
        <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 14px", maxWidth: 700, lineHeight: 1.55 }}>
          Before chasing anyone, see whether the work exists. This shows how many businesses already serve this need
          locally against the national rate, and when local employment in the trade peaks through the year.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          <input
            style={inputStyle} value={location} onChange={(e) => onLocation(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setShown({ location: location.trim(), industry })}
            placeholder="Clarksville, TN  ·  or 37040" aria-label="Your area"
          />
          <select style={inputStyle} value={industry} onChange={(e) => onIndustry(e.target.value)} aria-label="What you do">
            {Object.keys(INDUSTRIES).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <div>
            <Btn tone="green" onClick={() => setShown({ location: location.trim(), industry })} disabled={location.trim().length < 3 || busy}>
              <TrendingUp size={15} style={{ verticalAlign: -3, marginRight: 6 }} />
              {busy ? "Checking…" : "Check demand"}
            </Btn>
          </div>
        </div>
        {error && <div role="alert" style={{ fontSize: 13.5, color: C.alert, marginTop: 12 }}>{error}</div>}
      </Card>

      {data && (
        <>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
              <H size={16}>{data.sector.label} in {data.geography.label}</H>
              {data.competition && (
                <span style={{
                  fontFamily: FONT_MONO, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
                  textTransform: "uppercase", borderRadius: 999, padding: "4px 11px",
                  color: COMPETITION_STYLE[data.competition].color, background: COMPETITION_STYLE[data.competition].bg,
                }}>{COMPETITION_STYLE[data.competition].label}</span>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, margin: "14px 0" }}>
              <Stat label="Businesses doing this locally" value={data.localBusinesses?.toLocaleString("en-US") ?? "—"} />
              <Stat label="Per 10,000 residents" value={data.localPer10k?.toFixed(1) ?? "—"} sub={`National ${data.nationalPer10k?.toFixed(1) ?? "—"}`} />
              <Stat label="People in the county" value={data.geography.population?.toLocaleString("en-US") ?? "—"} />
              {data.seasonality?.busiest && (
                <Stat label="Busiest quarter locally" value={data.seasonality.busiest.label}
                  sub={data.seasonality.swingPercent != null ? `${data.seasonality.swingPercent}% above the quietest` : undefined} />
              )}
            </div>

            <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.6 }}>{data.reading}</div>
          </Card>

          {chart.length > 0 && (
            <Card>
              <H size={16}>When the work is there</H>
              <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 12px", lineHeight: 1.55 }}>
                People employed in this industry in {data.geography.label}, by quarter of {data.seasonality?.year}. More
                staff on the books means more work about — which is when to be in front of customers, and when to have
                capacity ready.
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chart} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11, fontFamily: FONT_MONO }} width={52} />
                  <Tooltip formatter={(v) => [(v as number).toLocaleString("en-US"), "Employed"]} />
                  <Bar dataKey="Employment" fill={C.ledger} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Card>
            <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
              <Info size={14} color={C.signal} style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14, color: C.ink, marginBottom: 6 }}>
                  About search volumes
                </div>
                <div style={{ fontSize: 12.5, color: C.mist, lineHeight: 1.6 }}>{data.searchVolumeNote}</div>
                <div style={{ fontSize: 11.5, color: C.mist, marginTop: 10 }}>{data.sources.join(" · ")}</div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: C.paper, borderRadius: 9, padding: "10px 12px" }}>
      <div style={{ fontSize: 11.5, color: C.mist }}>{label}</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 17, fontWeight: 600, color: C.ink, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: C.mist, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Find                                                                */
/* ------------------------------------------------------------------ */

type SearchResponse = {
  prospects: Prospect[];
  totalFound: number;
  withEmail: number;
  withWebsite: number;
  withPhone: number;
  radiusMiles: number;
  origin: { label: string; query: string };
  source: string;
  limitations: string[];
};

function FindTab({
  location, industry, inPipeline, onAdd,
}: {
  location: string;
  industry: string;
  inPipeline: Set<string>;
  onAdd: (p: Prospect) => void;
}) {
  const [radius, setRadius] = useState(10);
  const [targets, setTargets] = useState<string[]>(() => SUGGESTED_TARGETS[industry]?.slice(0, 3) ?? ["offices", "retail"]);
  const [contactOnly, setContactOnly] = useState(true);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ key: string; data: SearchResponse | null; error: string }>({ key: "", data: null, error: "" });

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    fetch(`/api/prospects/search?${query}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Search failed.");
        return j as SearchResponse;
      })
      .then((d) => { if (!cancelled) setResult({ key: query, data: d, error: "" }); })
      .catch((e) => { if (!cancelled) setResult({ key: query, data: null, error: e instanceof Error ? e.message : "Search failed." }); });
    return () => { cancelled = true; };
  }, [query]);

  const busy = query !== "" && result.key !== query;
  const data = result.key === query ? result.data : null;
  const error = result.key === query ? result.error : "";

  function toggleTarget(key: string) {
    setTargets((t) => t.includes(key) ? t.filter((x) => x !== key) : t.length >= MAX_TARGETS ? t : [...t, key]);
  }

  function run() {
    if (location.trim().length < 3 || targets.length === 0) return;
    setQuery(new URLSearchParams({
      location: location.trim(),
      radius: String(radius),
      targets: targets.join(","),
      ...(contactOnly ? { contactOnly: "1" } : {}),
    }).toString());
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <H>Who could you sell to near {location || "you"}?</H>
        <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 14px", maxWidth: 700, lineHeight: 1.55 }}>
          Businesses around you, with the contact details they publish themselves on OpenStreetMap. Pick up to{" "}
          {MAX_TARGETS} kinds at a time — the first search for an area can take up to a minute, then it&apos;s instant.
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {TARGET_CATEGORIES.map((t) => {
            const on = targets.includes(t.key);
            return (
              <button
                key={t.key} onClick={() => toggleTarget(t.key)} title={t.hint}
                style={{
                  fontSize: 12.5, borderRadius: 999, padding: "6px 12px", cursor: "pointer",
                  border: `1px solid ${on ? C.ledger : C.line}`,
                  background: on ? C.ledgerSoft : "#fff", color: on ? C.ledger : C.ink,
                  fontWeight: on ? 600 : 400,
                }}
              >{t.label}</button>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 12.5, color: C.mist }}>How far out? {radius} miles</span>
            <input type="range" min={1} max={25} value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Search radius in miles" />
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: C.ink, cursor: "pointer" }}>
            <input type="checkbox" checked={contactOnly} onChange={(e) => setContactOnly(e.target.checked)} />
            Only those with a way to contact them
          </label>
          <div>
            <Btn tone="green" onClick={run} disabled={busy || location.trim().length < 3 || targets.length === 0}>
              <Search size={15} style={{ verticalAlign: -3, marginRight: 6 }} />
              {busy ? "Searching…" : "Find businesses"}
            </Btn>
          </div>
        </div>

        {error && <div role="alert" style={{ fontSize: 13.5, color: C.alert, marginTop: 12 }}>{error}</div>}
        {busy && <div style={{ fontSize: 13, color: C.mist, marginTop: 12 }}>Searching the map for businesses within {radius} miles…</div>}
      </Card>

      {data && (
        <>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
              <H size={16}>{data.prospects.length} to approach</H>
              <div style={{ fontSize: 12.5, color: C.mist }}>
                {data.totalFound} mapped within {data.radiusMiles} miles · {data.withEmail} list an email ·{" "}
                {data.withWebsite} a website · {data.withPhone} a phone
              </div>
            </div>

            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 620 }}>
                <thead>
                  <tr>
                    {["Business", "Kind", "Contact", "Distance", ""].map((h) => (
                      <th key={h} style={{ textAlign: h === "Distance" ? "right" : "left", padding: "8px 10px 8px 0", borderBottom: `1px solid ${C.line}`, fontFamily: FONT_HEAD, fontSize: 12.5, color: C.mist }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.prospects.map((p) => {
                    const added = inPipeline.has(p.id);
                    return (
                      <tr key={p.id}>
                        <td style={{ padding: "9px 10px 9px 0", borderBottom: `1px solid ${C.line}` }}>
                          <div style={{ fontWeight: 600, color: C.ink }}>{p.name}</div>
                          {p.address && <div style={{ fontSize: 11.5, color: C.mist }}>{p.address}</div>}
                        </td>
                        <td style={{ padding: "9px 10px 9px 0", borderBottom: `1px solid ${C.line}`, color: C.mist, fontSize: 12.5 }}>{p.category}</td>
                        <td style={{ padding: "9px 10px 9px 0", borderBottom: `1px solid ${C.line}`, fontSize: 12.5 }}>
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            {p.email && <span style={{ color: C.ledger, display: "inline-flex", gap: 3, alignItems: "center" }}><Mail size={12} />email</span>}
                            {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer" style={{ color: C.ledger, display: "inline-flex", gap: 3, alignItems: "center" }}><ExternalLink size={12} />site</a>}
                            {p.phone && <span style={{ color: C.mist, display: "inline-flex", gap: 3, alignItems: "center" }}><Phone size={12} />{p.phone}</span>}
                            {!p.email && !p.website && !p.phone && <span style={{ color: C.mist }}>none listed</span>}
                          </div>
                        </td>
                        <td style={{ padding: "9px 10px 9px 0", borderBottom: `1px solid ${C.line}`, textAlign: "right", fontFamily: FONT_MONO, fontSize: 12.5, color: C.mist }}>{p.distanceMiles} mi</td>
                        <td style={{ padding: "9px 0", borderBottom: `1px solid ${C.line}`, textAlign: "right" }}>
                          <button
                            onClick={() => onAdd(p)} disabled={added}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 4, border: `1px solid ${added ? C.line : C.ledger}`,
                              background: added ? C.paper : "#fff", color: added ? C.mist : C.ledger,
                              borderRadius: 7, padding: "5px 10px", fontSize: 12.5, cursor: added ? "default" : "pointer", whiteSpace: "nowrap",
                            }}
                          >
                            {added ? <><Check size={13} /> Added</> : <><Plus size={13} /> Add</>}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
              <Info size={14} color={C.signal} style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14, color: C.ink, marginBottom: 6 }}>Where this list comes from</div>
                <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
                  {data.limitations.map((l, i) => <li key={i} style={{ fontSize: 12.5, color: C.mist, lineHeight: 1.55 }}>{l}</li>)}
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
/* Pipeline                                                            */
/* ------------------------------------------------------------------ */

function PipelineTab({
  data, update, onWrite, canDraft,
}: {
  data: ProspectData;
  update: (fn: (d: ProspectData) => ProspectData) => void;
  onWrite: (entry: PipelineEntry) => void;
  canDraft: boolean;
}) {
  const byStage = (stage: Stage) => data.pipeline.filter((p) => p.stage === stage);

  const setStage = (id: string, stage: Stage) =>
    update((d) => ({
      ...d,
      pipeline: d.pipeline.map((p) => p.id === id
        ? { ...p, stage, lastContactedAt: stage === "contacted" ? new Date().toISOString() : p.lastContactedAt }
        : p),
    }));

  const setNotes = (id: string, notes: string) =>
    update((d) => ({ ...d, pipeline: d.pipeline.map((p) => (p.id === id ? { ...p, notes } : p)) }));

  const remove = (id: string) =>
    update((d) => ({ ...d, pipeline: d.pipeline.filter((p) => p.id !== id) }));

  /** Never contact again: drop them and remember the address. */
  const neverContact = (entry: PipelineEntry) =>
    update((d) => ({
      ...d,
      pipeline: d.pipeline.filter((p) => p.id !== entry.id),
      doNotContact: entry.email && !d.doNotContact.includes(entry.email.toLowerCase())
        ? [...d.doNotContact, entry.email.toLowerCase()]
        : d.doNotContact,
    }));

  function exportCsv() {
    const header = ["Business", "Kind", "Address", "Email", "Phone", "Website", "Stage", "Added", "Last contacted", "Notes"];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = data.pipeline.map((p) => [
      p.name, p.category, p.address ?? "", p.email ?? "", p.phone ?? "", p.website ?? "",
      STAGES.find((s) => s.key === p.stage)?.label ?? p.stage,
      p.addedAt.slice(0, 10), p.lastContactedAt?.slice(0, 10) ?? "", p.notes.replace(/\n/g, " "),
    ].map((c) => escape(String(c))).join(","));
    const url = URL.createObjectURL(new Blob([[header.map(escape).join(","), ...rows].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `prospects-${new Date().toLocaleDateString("en-CA")}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (data.pipeline.length === 0) {
    return (
      <Card>
        <H>Nobody in the pipeline yet</H>
        <div style={{ fontSize: 14, color: C.mist, lineHeight: 1.6, marginTop: 8, maxWidth: 620 }}>
          Use <b>Find prospects</b> to pull up businesses near you, then add the ones worth approaching. They stay in
          this browser, on this device — nothing is uploaded.
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
          <H>{data.pipeline.length} in your pipeline</H>
          <Btn tone="ghost" onClick={exportCsv}>
            <Download size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Export CSV
          </Btn>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
          {STAGES.map((s) => (
            <div key={s.key} style={{ fontSize: 12.5, color: C.mist }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 15, fontWeight: 600, color: C.ink, marginRight: 5 }}>
                {byStage(s.key).length}
              </span>
              {s.label}
            </div>
          ))}
        </div>
      </Card>

      {STAGES.map((stage) => {
        const items = byStage(stage.key);
        if (items.length === 0) return null;
        return (
          <Card key={stage.key}>
            <H size={16}>{stage.label}</H>
            <div style={{ fontSize: 12.5, color: C.mist, marginBottom: 10 }}>{stage.blurb}</div>
            <div style={{ display: "grid", gap: 2 }}>
              {items.map((p) => (
                <div key={p.id} style={{ padding: "12px 0", borderBottom: `1px solid ${C.line}` }}>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                      <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14.5, color: C.ink }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: C.mist, marginTop: 2 }}>
                        {p.category}{p.address ? ` · ${p.address}` : ""} · {p.distanceMiles} mi
                      </div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4, fontSize: 12.5 }}>
                        {p.email && <a href={`mailto:${p.email}`} style={{ color: C.ledger }}>{p.email}</a>}
                        {p.phone && <span style={{ color: C.mist }}>{p.phone}</span>}
                        {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer" style={{ color: C.ledger }}>website</a>}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <select
                        value={p.stage} onChange={(e) => setStage(p.id, e.target.value as Stage)}
                        aria-label={`Stage for ${p.name}`}
                        style={{ ...inputStyle, width: "auto", padding: "6px 8px", fontSize: 12.5 }}
                      >
                        {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                      <button
                        onClick={() => onWrite(p)} disabled={!canDraft}
                        title={canDraft ? "Draft an email to this business" : "Add your business details first"}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5, border: `1px solid ${C.line}`,
                          background: "#fff", color: canDraft ? C.ledger : C.mist, borderRadius: 7,
                          padding: "6px 10px", fontSize: 12.5, cursor: canDraft ? "pointer" : "default",
                        }}
                      ><Mail size={13} /> Write</button>
                      <button onClick={() => neverContact(p)} title="They asked not to be contacted" style={iconBtn}>
                        <ShieldAlert size={14} />
                      </button>
                      <button onClick={() => remove(p.id)} aria-label={`Remove ${p.name}`} style={iconBtn}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={p.notes} onChange={(e) => setNotes(p.id, e.target.value)}
                    placeholder="Notes — who you spoke to, what they said, when to follow up"
                    aria-label={`Notes for ${p.name}`}
                    style={{ ...inputStyle, minHeight: 38, marginTop: 8, fontSize: 12.5, resize: "vertical" }}
                  />
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Your details                                                        */
/* ------------------------------------------------------------------ */

function DetailsTab({ data, update }: { data: ProspectData; update: (fn: (d: ProspectData) => ProspectData) => void }) {
  const [newAddress, setNewAddress] = useState("");
  const set = (k: keyof ProspectData["sender"], v: string) =>
    update((d) => ({ ...d, sender: { ...d.sender, [k]: v } }));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <H>Your details</H>
        <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 14px", maxWidth: 680, lineHeight: 1.55 }}>
          These go into every draft. A commercial email must say who sent it and give a real postal address — that is
          the law in the US, not a preference.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 12.5, color: C.mist }}>Business name</span>
            <input style={inputStyle} value={data.sender.businessName} maxLength={120} onChange={(e) => set("businessName", e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 12.5, color: C.mist }}>Reply-to email</span>
            <input style={inputStyle} type="email" value={data.sender.replyEmail} maxLength={254} onChange={(e) => set("replyEmail", e.target.value)} />
          </label>
        </div>
        <label style={{ display: "grid", gap: 5, marginTop: 14 }}>
          <span style={{ fontSize: 12.5, color: C.mist }}>Street address or PO box (required in commercial email)</span>
          <input style={inputStyle} value={data.sender.postalAddress} maxLength={300} onChange={(e) => set("postalAddress", e.target.value)} placeholder="412 Franklin St, Clarksville, TN 37040" />
        </label>
        <label style={{ display: "grid", gap: 5, marginTop: 14 }}>
          <span style={{ fontSize: 12.5, color: C.mist }}>What you offer, in a sentence</span>
          <textarea
            style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} maxLength={400}
            value={data.sender.offer} onChange={(e) => set("offer", e.target.value)}
            placeholder="Commercial cleaning for small offices and clinics, evenings and weekends"
          />
        </label>
      </Card>

      <Card>
        <H size={16}>Do not contact</H>
        <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 12px", maxWidth: 680, lineHeight: 1.55 }}>
          Anyone who asks to be left alone goes here, and must stay here. Removing a prospect with the shield button
          adds them automatically. The law gives you 10 business days to act on an opt-out; doing it immediately is
          simpler and more decent.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            style={{ ...inputStyle, flex: "1 1 240px" }} value={newAddress} placeholder="email@example.com"
            onChange={(e) => setNewAddress(e.target.value)} aria-label="Add an email to the do-not-contact list"
          />
          <Btn tone="ghost" onClick={() => {
            const email = newAddress.trim().toLowerCase();
            if (!email) return;
            update((d) => ({
              ...d,
              doNotContact: d.doNotContact.includes(email) ? d.doNotContact : [...d.doNotContact, email],
              pipeline: d.pipeline.filter((p) => p.email?.toLowerCase() !== email),
            }));
            setNewAddress("");
          }}>Add</Btn>
        </div>
        {data.doNotContact.length > 0 && (
          <div style={{ display: "grid", gap: 4, marginTop: 12 }}>
            {data.doNotContact.map((e) => (
              <div key={e} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, color: C.ink2 }}>
                <span style={{ fontFamily: FONT_MONO }}>{e}</span>
                <button
                  onClick={() => update((d) => ({ ...d, doNotContact: d.doNotContact.filter((x) => x !== e) }))}
                  style={{ background: "none", border: "none", color: C.mist, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
                >Remove</button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  border: `1px solid ${C.line}`, background: "#fff", color: C.mist,
  borderRadius: 7, padding: "6px 8px", cursor: "pointer",
};

/* ------------------------------------------------------------------ */

export default function ProspectWorkspace({ profile }: { profile: Profile | null }) {
  const [raw, setRaw, hydrated] = useLocalState<ProspectData>(STORAGE_KEY, emptyProspectData());
  const data = useMemo(() => sanitizeProspectData(raw), [raw]);

  const [tab, setTab] = useState<Tab>("demand");
  const [location, setLocation] = useState(profile?.location ?? "");
  const [industry, setIndustry] = useState(profile?.industry && profile.industry in INDUSTRIES ? profile.industry : "Retail");
  const [writingTo, setWritingTo] = useState<PipelineEntry | null>(null);

  const update = (fn: (d: ProspectData) => ProspectData) =>
    setRaw((prev) => ({ ...fn(sanitizeProspectData(prev)), updatedAt: new Date().toISOString() }));

  const inPipeline = useMemo(() => new Set(data.pipeline.map((p) => p.id)), [data.pipeline]);
  const canDraft = Boolean(data.sender.businessName.trim() && data.sender.offer.trim() && data.sender.postalAddress.trim());

  function addProspect(p: Prospect) {
    // Anyone on the do-not-contact list never comes back into the pipeline.
    if (p.email && data.doNotContact.includes(p.email.toLowerCase())) return;
    update((d) => d.pipeline.some((x) => x.id === p.id)
      ? d
      : { ...d, pipeline: [...d.pipeline, { ...p, stage: "new", notes: "", addedAt: new Date().toISOString(), lastContactedAt: null }] });
  }

  if (!hydrated) return <div style={{ color: C.mist, fontSize: 14 }}>Loading your pipeline…</div>;

  return (
    <div>
      <div role="tablist" aria-label="Client prospect pipeline" style={{
        display: "flex", gap: 4, overflowX: "auto", borderBottom: `1px solid ${C.line}`, marginBottom: 18,
      }}>
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key} role="tab" aria-selected={active} onClick={() => setTab(key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                padding: "10px 12px", border: "none", background: "none", cursor: "pointer",
                fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14,
                color: active ? C.ink : C.mist,
                borderBottom: `2px solid ${active ? C.ledger : "transparent"}`, marginBottom: -1,
              }}
            >
              <Icon size={15} /> {label}
              {key === "pipeline" && data.pipeline.length > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700, color: "#fff", background: C.ledger,
                  borderRadius: 999, padding: "1px 7px", marginLeft: 2,
                }}>{data.pipeline.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "demand" && (
        <DemandTab location={location} industry={industry} onLocation={setLocation} onIndustry={setIndustry} />
      )}
      {tab === "find" && (
        <FindTab location={location} industry={industry} inPipeline={inPipeline} onAdd={addProspect} />
      )}
      {tab === "pipeline" && (
        <PipelineTab data={data} update={update} onWrite={setWritingTo} canDraft={canDraft} />
      )}
      {tab === "details" && <DetailsTab data={data} update={update} />}

      {tab === "pipeline" && !canDraft && data.pipeline.length > 0 && (
        <div style={{ fontSize: 12.5, color: C.mist, marginTop: 12 }}>
          Add your business name, address and what you offer under{" "}
          <button onClick={() => setTab("details")} style={{ background: "none", border: "none", color: C.ledger, cursor: "pointer", padding: 0, textDecoration: "underline", fontSize: 12.5 }}>
            Your details
          </button>{" "}to draft emails.
        </div>
      )}

      <OutreachDialog
        key={writingTo?.id ?? "none"}
        open={writingTo !== null}
        onClose={() => setWritingTo(null)}
        prospect={writingTo}
        sender={data.sender}
        location={location}
        onSent={(id) => update((d) => ({
          ...d,
          pipeline: d.pipeline.map((p) => (p.id === id ? { ...p, stage: "contacted", lastContactedAt: new Date().toISOString() } : p)),
        }))}
      />

      <div style={{ display: "flex", gap: 7, marginTop: 20, alignItems: "flex-start" }}>
        <Users size={13} color={C.signal} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 11.5, color: C.mist, lineHeight: 1.55 }}>
          This finds <b>businesses</b>, not individual people, and only uses contact details a business published for
          customers to use. It can&apos;t tell you who searched for your service: no search engine publishes that, and
          anyone selling such a list is either guessing or trading data they shouldn&apos;t have. Your pipeline stays in
          this browser, and MicroBiz AI never sends email on your behalf — you send from your own mailbox.
        </div>
      </div>
    </div>
  );
}
