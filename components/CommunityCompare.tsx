"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lightbulb, AlertTriangle, Eye, ArrowUpRight, Info } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import type { CommunityProfile } from "@/lib/community/types";
import type { Implication } from "@/lib/community/implications";
import type { CommunityScore } from "@/lib/community/score";
import { Card, H } from "./ui";
import CommunityScoreBlock from "./CommunityScoreBlock";

type Loaded = CommunityProfile & {
  industry: string | null;
  score: CommunityScore | null;
  implications: Implication[];
  implicationCaveat: string;
};

type Entry = { location: string; data: Loaded | null; error: string };

/**
 * The two scores answer different questions, so they are reported together
 * rather than averaged — spending power feeds both, and a blended number
 * would hide which half is carrying it.
 */
function readTogether(market: number, conditions: number): string {
  const strong = (n: number) => n >= 55;
  const weak = (n: number) => n < 45;
  if (strong(market) && strong(conditions)) return "The sector earns well here and conditions support it.";
  if (strong(market) && weak(conditions)) return "The sector earns well despite demanding conditions — check what local operators do differently.";
  if (weak(market) && strong(conditions)) return "Conditions are favorable but the sector earns below average here — worth asking why before assuming it's an opening.";
  if (weak(market) && weak(conditions)) return "Both the sector's earnings and local conditions are below average. A harder place to start.";
  return "Both sit near the national middle.";
}

const KIND: Record<Implication["kind"], { label: string; color: string; Icon: typeof Lightbulb }> = {
  opportunity: { label: "Opportunity", color: C.ledger, Icon: Lightbulb },
  challenge: { label: "Harder here", color: C.alert, Icon: AlertTriangle },
  watch: { label: "Worth knowing", color: C.ink2, Icon: Eye },
};

function Findings({ items, kind, limit }: { items: Implication[]; kind: Implication["kind"]; limit: number }) {
  const matching = items.filter((i) => i.kind === kind).slice(0, limit);
  if (matching.length === 0) return null;
  const k = KIND[kind];
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FONT_MONO, fontSize: 10.5,
        fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: k.color, marginBottom: 6,
      }}>
        <k.Icon size={11} /> {k.label}
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 7 }}>
        {matching.map((i) => (
          <li key={i.id} style={{ fontSize: 13, color: C.ink, lineHeight: 1.5 }}>
            {i.title}
            <div style={{ fontSize: 11.5, color: C.mist, fontFamily: FONT_MONO, marginTop: 2, lineHeight: 1.45 }}>{i.basis}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Several places, one basis for comparison.
 *
 * Each column scores the same five pillars and lists what stands out, so two
 * markets can be read against each other rather than one at a time. Loaded in
 * parallel; a place that fails says so in its own column instead of emptying
 * the comparison.
 */
export default function CommunityCompare({
  locations, industry, marketScores, heading = "The communities behind the scores",
}: {
  locations: string[];
  industry?: string;
  /** The market Opportunity Score per location, where the page has one. */
  marketScores?: Record<string, number | null>;
  heading?: string;
}) {
  const wanted = locations.map((l) => l.trim()).filter((l) => l.length >= 3);
  const key = `${wanted.join("|")}#${industry ?? ""}`;
  const [result, setResult] = useState<{ key: string; entries: Entry[] }>({ key: "", entries: [] });

  useEffect(() => {
    if (!key.startsWith("#") && wanted.length === 0) return;
    let cancelled = false;
    Promise.all(
      wanted.map(async (location): Promise<Entry> => {
        try {
          const qs = new URLSearchParams({ location });
          if (industry) qs.set("industry", industry);
          const res = await fetch(`/api/community?${qs}`);
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Couldn't load this community.");
          return { location, data: json as Loaded, error: "" };
        } catch (e) {
          return { location, data: null, error: e instanceof Error ? e.message : "Couldn't load this community." };
        }
      }),
    ).then((entries) => { if (!cancelled) setResult({ key, entries }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (wanted.length === 0) return null;

  const loading = result.key !== key;
  if (loading) {
    return <Card><div style={{ fontSize: 13.5, color: C.mist }}>Loading community figures for {wanted.join(" and ")}…</div></Card>;
  }

  const loaded = result.entries.filter((e) => e.data);
  if (loaded.length === 0) {
    return <Card><div style={{ fontSize: 13.5, color: C.mist }}>{result.entries[0]?.error ?? "No community figures available."}</div></Card>;
  }

  // The best and worst conditions score, so the comparison has a conclusion.
  const scored = loaded.filter((e) => e.data?.score).sort((a, b) => (b.data!.score!.score) - (a.data!.score!.score));
  const best = scored[0];
  const gap = scored.length > 1 ? scored[0].data!.score!.score - scored[scored.length - 1].data!.score!.score : 0;

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
        <H>{heading}</H>
        <div style={{ fontSize: 12.5, color: C.mist }}>
          Conditions scored on the same five pillars · 50 = typical US county
        </div>
      </div>

      {scored.length > 1 && (
        <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.6, marginTop: 6, maxWidth: 760 }}>
          On operating conditions{industry ? ` for a ${industry.toLowerCase()} business` : ""},{" "}
          <b>{best.data!.geography.label}</b> comes out ahead at {best.data!.score!.score}
          {gap <= 4
            ? " — but the gap is small enough that it shouldn't decide anything on its own."
            : `, ${gap} points above the lowest here.`}{" "}
          The market scores above and these conditions answer different questions; read them together.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${loaded.length > 2 ? 260 : 300}px, 1fr))`, gap: 16, marginTop: 16 }}>
        {result.entries.map((entry) => {
          if (!entry.data) {
            return (
              <div key={entry.location} style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 15, color: C.ink }}>{entry.location}</div>
                <div style={{ fontSize: 12.5, color: C.mist, marginTop: 6, lineHeight: 1.5 }}>{entry.error}</div>
              </div>
            );
          }
          const d = entry.data;
          const market = marketScores?.[entry.location] ?? null;
          return (
            <div key={entry.location} style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column" }}>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 15.5, color: C.ink }}>{d.geography.label}</div>
              <div style={{ fontSize: 12, color: C.mist, marginBottom: 10 }}>
                {entry.location}
                {d.population != null && <> · {Math.round(d.population).toLocaleString("en-US")} residents</>}
              </div>

              {market != null && d.score && (
                <div style={{
                  display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap",
                  padding: "8px 10px", marginBottom: 10, background: "#fff",
                  border: `1px solid ${C.line}`, borderRadius: 9,
                }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: C.ink }}>
                    Market {market} · Conditions {d.score.score}
                  </span>
                  <span style={{ fontSize: 12, color: C.mist, flex: "1 1 140px" }}>{readTogether(market, d.score.score)}</span>
                </div>
              )}

              {d.score
                ? <CommunityScoreBlock score={d.score} compact />
                : <div style={{ fontSize: 12.5, color: C.mist }}>Not enough published figures to score this county.</div>}

              <Findings items={d.implications} kind="challenge" limit={3} />
              <Findings items={d.implications} kind="opportunity" limit={3} />

              <div style={{ marginTop: "auto", paddingTop: 12 }}>
                <Link
                  href={`/data/community?location=${encodeURIComponent(entry.location)}${industry ? `&industry=${encodeURIComponent(industry)}` : ""}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, color: C.ledger, fontWeight: 600, fontSize: 13, textDecoration: "none" }}
                >
                  Every figure for this county <ArrowUpRight size={14} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 7, marginTop: 14, alignItems: "flex-start" }}>
        <Info size={13} color={C.signal} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 11.5, color: C.mist, lineHeight: 1.55 }}>
          {loaded[0].data!.implicationCaveat} Health figures are model-based estimates from CDC PLACES, and every
          figure describes the whole county rather than a particular street.
        </div>
      </div>
    </Card>
  );
}
