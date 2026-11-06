"use client";

import { useEffect, useState } from "react";
import {
  Star, AlertTriangle, Info, RefreshCw, Copy, Check, ClipboardList, Search, ThumbsUp, Target,
} from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import { INDUSTRIES } from "@/lib/data";
import { Card, H, Btn, inputStyle } from "../ui";

/* ------------------------------------------------------------------ */
/* Published records                                                   */
/* ------------------------------------------------------------------ */

type RatedProvider = {
  name: string; city: string; rating: number | null;
  complaintDeficiencies: number | null; fines: number | null; finesDollars: number | null;
};

type RecordsResponse = {
  area: string;
  coverage: "cms" | "cfpb" | "none";
  note: string | null;
  sectors: {
    key: string; label: string; ratingMeans: string;
    providers: RatedProvider[]; averageRating: number | null; weakest: RatedProvider[]; source: string;
  }[];
  complaints: {
    area: string; total: number; since: string;
    topIssues: { issue: string; count: number }[];
    topCompanies: { company: string; count: number }[];
    timelyPercent: number | null;
    responses: { response: string; count: number }[];
    source: string;
  } | null;
  limitations: string[];
};

function Stars({ value }: { value: number | null }) {
  if (value == null) return <span style={{ color: C.mist, fontSize: 12.5 }}>not rated</span>;
  const colour = value <= 2 ? C.alert : value >= 4 ? C.ledger : C.signal;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: colour, fontFamily: FONT_MONO, fontSize: 13, fontWeight: 600 }}>
      <Star size={13} fill={colour} strokeWidth={0} />{value.toFixed(1)}
    </span>
  );
}

function PublishedRecords({ location, industry }: { location: string; industry: string }) {
  const key = location.trim().length >= 3 && industry ? `${location.trim()}|${industry}` : "";
  const [result, setResult] = useState<{ key: string; data: RecordsResponse | null; error: string }>({ key: "", data: null, error: "" });

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const [loc, ind] = key.split("|");
    fetch(`/api/competitors/records?location=${encodeURIComponent(loc)}&industry=${encodeURIComponent(ind)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Couldn't load records.");
        return j as RecordsResponse;
      })
      .then((d) => { if (!cancelled) setResult({ key, data: d, error: "" }); })
      .catch((e) => { if (!cancelled) setResult({ key, data: null, error: e instanceof Error ? e.message : "Couldn't load records." }); });
    return () => { cancelled = true; };
  }, [key]);

  if (!key) return null;
  const loading = result.key !== key;
  const data = result.key === key ? result.data : null;

  if (loading) return <Card><div style={{ fontSize: 13.5, color: C.mist }}>Checking what regulators publish for {industry.toLowerCase()} near {location}…</div></Card>;
  if (!data) return <Card><div style={{ fontSize: 13.5, color: C.mist }}>{result.error}</div></Card>;

  if (data.coverage === "none") {
    return (
      <Card>
        <H size={16}>No official ratings exist for this kind of business</H>
        <div style={{ fontSize: 13.5, color: C.ink2, lineHeight: 1.6, marginTop: 8, maxWidth: 720 }}>{data.note}</div>
      </Card>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {data.sectors.map((sec) => (
        <Card key={sec.key}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
            <H size={16}>{sec.label}</H>
            <div style={{ fontSize: 12.5, color: C.mist }}>
              Average <Stars value={sec.averageRating} /> across {sec.providers.length}
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: C.mist, margin: "4px 0 12px", lineHeight: 1.5 }}>{sec.ratingMeans}</div>

          {sec.weakest.length > 0 && (
            <div style={{ background: "#F9E9E6", borderRadius: 9, padding: "10px 12px", marginBottom: 12 }}>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 13.5, color: C.alert, marginBottom: 4 }}>
                {sec.weakest.length} rated at or below two stars
              </div>
              <div style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.5 }}>
                These are where customers are most likely to be looking for an alternative. Their weak points are
                public: check the inspection findings on Medicare.gov before you pitch against them.
              </div>
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 520 }}>
              <thead>
                <tr>
                  {["Provider", "Town", "Rating", "Complaint findings", "Fines"].map((h) => (
                    <th key={h} style={{
                      textAlign: h === "Provider" || h === "Town" ? "left" : "right",
                      padding: "8px 10px 8px 0", borderBottom: `1px solid ${C.line}`,
                      fontFamily: FONT_HEAD, fontSize: 12.5, color: C.mist,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sec.providers.slice(0, 15).map((p) => (
                  <tr key={`${p.name}-${p.city}`}>
                    <td style={{ padding: "8px 10px 8px 0", borderBottom: `1px solid ${C.line}`, color: C.ink }}>{p.name}</td>
                    <td style={{ padding: "8px 10px 8px 0", borderBottom: `1px solid ${C.line}`, color: C.mist, fontSize: 12.5 }}>{p.city}</td>
                    <td style={{ padding: "8px 10px 8px 0", borderBottom: `1px solid ${C.line}`, textAlign: "right" }}><Stars value={p.rating} /></td>
                    <td style={{ padding: "8px 10px 8px 0", borderBottom: `1px solid ${C.line}`, textAlign: "right", fontFamily: FONT_MONO, fontSize: 12.5, color: p.complaintDeficiencies ? C.alert : C.mist }}>
                      {p.complaintDeficiencies ?? "—"}
                    </td>
                    <td style={{ padding: "8px 0", borderBottom: `1px solid ${C.line}`, textAlign: "right", fontFamily: FONT_MONO, fontSize: 12.5, color: C.mist }}>
                      {p.finesDollars ? `$${Math.round(p.finesDollars).toLocaleString("en-US")}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11.5, color: C.mist, marginTop: 10 }}>{sec.source}</div>
        </Card>
      ))}

      {data.complaints && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
            <H size={16}>What people in {data.complaints.area} complain about</H>
            <div style={{ fontSize: 12.5, color: C.mist }}>
              {data.complaints.total.toLocaleString("en-US")} complaints since {data.complaints.since}
            </div>
          </div>
          <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 14px", lineHeight: 1.55, maxWidth: 700 }}>
            Every complaint consumers filed about a financial product, with the company named. Useful if you handle
            anyone&apos;s money or credit: these are the failures your customers have already been burned by.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 22 }}>
            <div>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 13.5, color: C.ink, marginBottom: 6 }}>Most common complaints</div>
              {data.complaints.topIssues.map((i) => (
                <div key={i.issue} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: `1px solid ${C.line}`, fontSize: 13 }}>
                  <span style={{ color: C.ink }}>{i.issue}</span>
                  <span style={{ fontFamily: FONT_MONO, color: C.mist }}>{i.count.toLocaleString("en-US")}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 13.5, color: C.ink, marginBottom: 6 }}>Most complained about</div>
              {data.complaints.topCompanies.map((c) => (
                <div key={c.company} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: `1px solid ${C.line}`, fontSize: 13 }}>
                  <span style={{ color: C.ink }}>{c.company}</span>
                  <span style={{ fontFamily: FONT_MONO, color: C.mist }}>{c.count.toLocaleString("en-US")}</span>
                </div>
              ))}
            </div>
          </div>

          {data.complaints.timelyPercent != null && (
            <div style={{ fontSize: 12.5, color: C.mist, marginTop: 12 }}>
              {data.complaints.timelyPercent}% of these were answered by the company within the deadline.
            </div>
          )}
          <div style={{ fontSize: 11.5, color: C.mist, marginTop: 8 }}>{data.complaints.source}</div>
        </Card>
      )}

      <Card>
        <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
          <Info size={14} color={C.signal} style={{ marginTop: 2, flexShrink: 0 }} />
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            {data.limitations.map((l, i) => <li key={i} style={{ fontSize: 12.5, color: C.mist, lineHeight: 1.55 }}>{l}</li>)}
          </ul>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Review analyser                                                     */
/* ------------------------------------------------------------------ */

type Analysis = {
  reviewsSeen: number;
  overallRead: string;
  complaints: { theme: string; mentions: number; severity: "high" | "medium" | "low"; quotes: string[]; whatToDo: string }[];
  praised: { theme: string; note: string }[];
  positioning: { promises: string[]; proof: string[]; profileLine: string };
  caveat: string;
};

const SEVERITY = {
  high: { label: "Costing them customers", color: C.alert, bg: "#F9E9E6" },
  medium: { label: "Irritating", color: "#A86D0B", bg: "#FBF1E1" },
  low: { label: "Minor", color: C.ink2, bg: C.paper },
} as const;

function ReviewAnalyser({ location, industry }: { location: string; industry: string }) {
  const [competitor, setCompetitor] = useState("");
  const [text, setText] = useState("");
  const [data, setData] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function analyse() {
    if (busy || text.trim().length < 120) return;
    setBusy(true); setError(""); setData(null);
    try {
      const res = await fetch("/api/competitors/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry, area: location, competitor, text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "The analysis failed.");
      setData(json as Analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The analysis failed.");
    }
    setBusy(false);
  }

  function copyPlan() {
    if (!data) return;
    const plan = [
      `What competitors near ${location || "you"} keep getting wrong`,
      "",
      ...data.complaints.map((c, i) => `${i + 1}. ${c.theme} (${c.mentions} of ${data.reviewsSeen} reviews)\n   Do instead: ${c.whatToDo}`),
      "",
      "Promises to make:",
      ...data.positioning.promises.map((p) => `- ${p}`),
      "",
      "Proof to show:",
      ...data.positioning.proof.map((p) => `- ${p}`),
      "",
      `Profile line: ${data.positioning.profileLine}`,
    ].join("\n");
    navigator.clipboard?.writeText(plan).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => setError("Couldn't copy — select the text and copy it manually."));
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <H>What are competitors getting wrong?</H>
        <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 14px", maxWidth: 720, lineHeight: 1.55 }}>
          Open the Google, Yelp or Facebook reviews of two or three competitors, copy the ones with something to say —
          good and bad — and paste them here. You get back what customers complain about most, ranked, with what to do
          so nobody says it about you. Ten reviews is enough to see a pattern.
        </div>

        <label style={{ display: "grid", gap: 5, marginBottom: 12 }}>
          <span style={{ fontSize: 12.5, color: C.mist }}>Who are these about? (optional)</span>
          <input style={inputStyle} value={competitor} maxLength={160} onChange={(e) => setCompetitor(e.target.value)} placeholder="One competitor, or several" />
        </label>

        <label style={{ display: "grid", gap: 5 }}>
          <span style={{ fontSize: 12.5, color: C.mist }}>Paste the reviews</span>
          <textarea
            style={{ ...inputStyle, minHeight: 180, resize: "vertical", lineHeight: 1.5, fontSize: 13 }}
            value={text} onChange={(e) => setText(e.target.value)}
            placeholder={"Paste reviews here, one after another. Don't worry about tidying them up."}
          />
        </label>
        <div style={{ fontSize: 11.5, color: C.mist, marginTop: 5 }}>
          {text.trim().length.toLocaleString("en-US")} characters pasted
        </div>

        <div style={{ marginTop: 14 }}>
          <Btn tone="green" onClick={analyse} disabled={busy || text.trim().length < 120}>
            {busy
              ? <><RefreshCw size={15} className="spin" style={{ verticalAlign: -3, marginRight: 6 }} />Reading them…</>
              : <><Search size={15} style={{ verticalAlign: -3, marginRight: 6 }} />Find the weak spots</>}
          </Btn>
        </div>
        {error && <div role="alert" style={{ fontSize: 13.5, color: C.alert, marginTop: 12 }}>{error}</div>}
      </Card>

      {data && (
        <>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
              <H size={16}>Read across {data.reviewsSeen} reviews</H>
              <button onClick={copyPlan} style={{
                display: "inline-flex", alignItems: "center", gap: 5, background: "none",
                border: `1px solid ${C.line}`, borderRadius: 7, padding: "6px 10px",
                color: C.ledger, fontSize: 12.5, cursor: "pointer",
              }}>
                {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy the plan</>}
              </button>
            </div>
            <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.6, marginTop: 8 }}>{data.overallRead}</div>
          </Card>

          {data.complaints.map((c, i) => {
            const s = SEVERITY[c.severity];
            return (
              <Card key={c.theme} style={{ borderLeft: `4px solid ${s.color}` }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: C.mist }}>{i + 1}</span>
                  <span style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 16, color: C.ink }}>{c.theme}</span>
                  <span style={{
                    fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.05em",
                    textTransform: "uppercase", color: s.color, background: s.bg, borderRadius: 999, padding: "3px 9px",
                  }}>{s.label}</span>
                  <span style={{ fontSize: 12.5, color: C.mist }}>
                    {c.mentions} of {data.reviewsSeen} reviews
                  </span>
                </div>

                <div style={{ display: "grid", gap: 6, margin: "10px 0" }}>
                  {c.quotes.map((q) => (
                    <div key={q} style={{
                      fontSize: 13, color: C.ink2, lineHeight: 1.55, paddingLeft: 12,
                      borderLeft: `2px solid ${C.line}`, fontStyle: "italic",
                    }}>“{q}”</div>
                  ))}
                </div>

                <div style={{ background: C.ledgerSoft, borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: C.ledger, fontWeight: 600, marginBottom: 3 }}>
                    What you do instead
                  </div>
                  <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.55 }}>{c.whatToDo}</div>
                </div>
              </Card>
            );
          })}

          {data.praised.length > 0 && (
            <Card>
              <H size={16}>
                <ThumbsUp size={15} style={{ verticalAlign: -2, marginRight: 7 }} color={C.ledger} />
                What they&apos;re already good at
              </H>
              <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 10px" }}>
                You have to match these to be considered at all — attacking the weak spots won&apos;t help if you fall
                short here.
              </div>
              {data.praised.map((p) => (
                <div key={p.theme} style={{ padding: "7px 0", borderBottom: `1px solid ${C.line}` }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5, color: C.ink }}>{p.theme}</span>
                  <span style={{ fontSize: 13, color: C.mist }}> — {p.note}</span>
                </div>
              ))}
            </Card>
          )}

          <Card>
            <H size={16}>
              <Target size={15} style={{ verticalAlign: -2, marginRight: 7 }} color={C.ledger} />
              How you take the business
            </H>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 20, marginTop: 12 }}>
              <div>
                <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 13.5, color: C.ink, marginBottom: 6 }}>Promises to make</div>
                <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 7 }}>
                  {data.positioning.promises.map((p) => <li key={p} style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.5 }}>{p}</li>)}
                </ul>
              </div>
              <div>
                <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 13.5, color: C.ink, marginBottom: 6 }}>Proof to show</div>
                <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 7 }}>
                  {data.positioning.proof.map((p) => <li key={p} style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.5 }}>{p}</li>)}
                </ul>
              </div>
            </div>
            <div style={{ background: C.paper, borderRadius: 8, padding: "10px 12px", marginTop: 14 }}>
              <div style={{ fontSize: 11.5, color: C.mist, marginBottom: 3 }}>For your Google Business Profile</div>
              <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.5 }}>{data.positioning.profileLine}</div>
            </div>
          </Card>

          <Card>
            <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
              <AlertTriangle size={14} color={C.signal} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: 12.5, color: C.mist, lineHeight: 1.55 }}>{data.caveat}</div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function WeakSpotsTab({
  location, industry, onLocation, onIndustry,
}: {
  location: string; industry: string;
  onLocation: (v: string) => void; onIndustry: (v: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <H>Where competitors fall short</H>
        <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 14px", maxWidth: 720, lineHeight: 1.55 }}>
          Find what businesses like yours keep being criticised for nearby, then build your offer around fixing it.
          Two parts: what regulators publish about your sector, and what customers say in reviews you collect.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          <input
            style={inputStyle} value={location} onChange={(e) => onLocation(e.target.value)}
            placeholder="Clarksville, TN  ·  or 37040" aria-label="Your area"
          />
          <select style={inputStyle} value={industry} onChange={(e) => onIndustry(e.target.value)} aria-label="Your industry">
            {Object.keys(INDUSTRIES).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
      </Card>

      <div>
        <div style={{
          fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
          color: C.mist, fontWeight: 600, margin: "4px 0 10px", display: "flex", alignItems: "center", gap: 6,
        }}>
          <ClipboardList size={13} /> On the public record
        </div>
        <PublishedRecords location={location} industry={industry} />
      </div>

      <div>
        <div style={{
          fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
          color: C.mist, fontWeight: 600, margin: "14px 0 10px", display: "flex", alignItems: "center", gap: 6,
        }}>
          <Search size={13} /> From reviews you collect
        </div>
        <ReviewAnalyser location={location} industry={industry} />
      </div>
    </div>
  );
}
