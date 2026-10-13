"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, HelpCircle, Circle, Sparkles, FileSearch } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import { INDUSTRIES } from "@/lib/data";
import { Card, H, Btn, Field, inputStyle } from "./ui";
import Markdown from "./Markdown";
import CommunityPanel from "./CommunityPanel";

type CheckStatus = "strong" | "workable" | "stretch" | "unknown";

type Check = {
  key: string;
  label: string;
  status: CheckStatus;
  headline: string;
  detail: string;
  source?: string;
};

type StudyResponse = {
  sector: { label: string; benchmarkNote?: string };
  profile: { geography: { label: string } };
  result: {
    checks: Check[];
    outlook: "encouraging" | "mixed" | "challenging" | "insufficient_data";
    marketScore: number | null;
  };
  summary: string | null;
};

const STATUS_STYLE: Record<CheckStatus, { color: string; bg: string; Icon: typeof CheckCircle2; word: string }> = {
  strong: { color: C.ledger, bg: C.ledgerSoft, Icon: CheckCircle2, word: "Strong" },
  workable: { color: C.signal, bg: "#FBF1E1", Icon: Circle, word: "Workable" },
  stretch: { color: C.alert, bg: "#F9E9E6", Icon: AlertTriangle, word: "Stretch" },
  unknown: { color: C.mist, bg: C.paper, Icon: HelpCircle, word: "No data" },
};

const OUTLOOK: Record<StudyResponse["result"]["outlook"], { label: string; color: string; blurb: string }> = {
  encouraging: {
    label: "Encouraging",
    color: C.ledger,
    blurb: "Your assumptions sit within what this market demonstrably supports.",
  },
  mixed: {
    label: "Mixed",
    color: C.signal,
    blurb: "Some assumptions hold up against the market; others are ambitious.",
  },
  challenging: {
    label: "Challenging",
    color: C.alert,
    blurb: "Several assumptions sit well outside what this market currently supports.",
  },
  insufficient_data: {
    label: "Not enough data",
    color: C.mist,
    blurb: "Too little is published for this sector and area to draw a conclusion.",
  },
};

export default function FeasibilityStudy({
  defaultLocation = "",
  defaultIndustry = "Restaurant / Food service",
}: {
  defaultLocation?: string;
  /** Set when arriving from the Opportunity Finder, so the sector carries over. */
  defaultIndustry?: string;
}) {
  const [location, setLocation] = useState(defaultLocation);
  const [industry, setIndustry] = useState(
    defaultIndustry in INDUSTRIES ? defaultIndustry : "Restaurant / Food service",
  );
  const [expectedRevenue, setExpectedRevenue] = useState("");
  const [employees, setEmployees] = useState("");
  const [startupCapital, setStartupCapital] = useState("");
  const [data, setData] = useState<StudyResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    if (location.trim().length < 3 || busy) return;
    setBusy(true); setError(""); setData(null);
    try {
      const res = await fetch("/api/feasibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: location.trim(),
          industry,
          expectedRevenue: +expectedRevenue || 0,
          employees: +employees || 0,
          startupCapital: +startupCapital || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Study failed.");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Study failed. Please try again.");
    }
    setBusy(false);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <H>Your plan</H>
        <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 18px", maxWidth: 640, lineHeight: 1.55 }}>
          Describe what you&apos;re considering. We&apos;ll test it against what businesses in that sector and market
          actually report to the Census — not against a forecast.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 16 }}>
          <Field label="Business type">
            <select style={inputStyle} value={industry} onChange={(e) => setIndustry(e.target.value)}>
              {Object.keys(INDUSTRIES).map((i) => <option key={i}>{i}</option>)}
            </select>
          </Field>
          <Field label="Target location">
            <input style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()} placeholder="Clarksville, TN  ·  or 37040" />
          </Field>
          <Field label="Expected annual revenue ($)">
            <input style={inputStyle} type="number" value={expectedRevenue}
              onChange={(e) => setExpectedRevenue(e.target.value)} placeholder="600000" />
          </Field>
          <Field label="Planned employees">
            <input style={inputStyle} type="number" value={employees}
              onChange={(e) => setEmployees(e.target.value)} placeholder="8" />
          </Field>
          <Field label="Starting capital ($)">
            <input style={inputStyle} type="number" value={startupCapital}
              onChange={(e) => setStartupCapital(e.target.value)} placeholder="120000" />
          </Field>
        </div>

        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <Btn tone="green" onClick={run} disabled={busy || location.trim().length < 3}>
            <FileSearch size={15} style={{ verticalAlign: -3, marginRight: 7 }} />
            {busy ? "Running the study…" : "Run feasibility study"}
          </Btn>
        </div>

        {busy && (
          <div style={{ fontSize: 13, color: C.mist, marginTop: 14 }}>
            Pulling Census figures for this market and writing the summary. First run for a new area takes a few seconds.
          </div>
        )}
        {error && <div style={{ fontSize: 13.5, color: C.alert, marginTop: 14 }}>{error}</div>}
      </Card>

      {data && (
        <>
          <Card style={{ borderLeft: `4px solid ${OUTLOOK[data.result.outlook].color}` }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <div style={{
                fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 700,
                color: OUTLOOK[data.result.outlook].color,
              }}>{OUTLOOK[data.result.outlook].label}</div>
              <div style={{ fontSize: 13, color: C.mist }}>
                {data.sector.label} · {data.profile.geography.label}
              </div>
            </div>
            <div style={{ fontSize: 13.5, color: C.ink2, marginTop: 6 }}>
              {OUTLOOK[data.result.outlook].blurb}
            </div>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
            {data.result.checks.map((c) => {
              const s = STATUS_STYLE[c.status];
              return (
                <Card key={c.key}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <s.Icon size={17} color={s.color} />
                    <span style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14.5, color: C.ink }}>
                      {c.label}
                    </span>
                    <span style={{
                      marginLeft: "auto", fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.05em",
                      textTransform: "uppercase", color: s.color, background: s.bg,
                      borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap",
                    }}>{s.word}</span>
                  </div>
                  <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 13.5, color: s.color, marginBottom: 5 }}>
                    {c.headline}
                  </div>
                  <div style={{ fontSize: 13, color: C.mist, lineHeight: 1.55 }}>{c.detail}</div>
                  {c.source && (
                    <div style={{ fontSize: 11, color: C.mist, marginTop: 8, opacity: 0.85 }}>{c.source}</div>
                  )}
                </Card>
              );
            })}
          </div>

          {data.summary && (
            <Card>
              <H size={15}>
                <Sparkles size={15} style={{ verticalAlign: -2, marginRight: 6 }} color={C.ledger} />
                Executive summary
              </H>
              <div style={{ marginTop: 10 }}><Markdown>{data.summary}</Markdown></div>
              <div style={{ fontSize: 11, color: C.mist, marginTop: 12, lineHeight: 1.55 }}>
                Written by Claude from the figures above only. It cannot introduce numbers that aren&apos;t in the data.
              </div>
            </Card>
          )}

          {/* The market says whether the numbers work; the community says who they'd work among. */}
          <CommunityPanel
            location={location}
            industry={industry}
            compact
            heading="The community you'd be trading in"
          />

          <div style={{ fontSize: 11.5, color: C.mist, lineHeight: 1.6 }}>
            This study compares your assumptions against published Census figures for businesses already operating in
            this market. It is not a prediction and not a promise of results. Startup costs, rent, equipment and
            inventory are deliberately excluded — no free federal source publishes them by sector and area, and
            estimating them here would be guesswork presented as data.
            {data.sector.benchmarkNote ? ` ${data.sector.benchmarkNote}` : ""}
          </div>
        </>
      )}
    </div>
  );
}
