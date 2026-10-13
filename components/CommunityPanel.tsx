"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Users, HeartPulse, CloudSun, ShieldAlert, Info, TrendingUp, TrendingDown, Minus,
  Lightbulb, AlertTriangle, Eye, ArrowUpRight,
} from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import type { CommunityProfile, Indicator, IndicatorGroup } from "@/lib/community/types";
import type { Implication } from "@/lib/community/implications";
import { HIGHER_IS_BETTER } from "@/lib/community/health";
import { Card, H } from "./ui";

type Response = CommunityProfile & {
  industry: string | null;
  implications: Implication[];
  implicationCaveat: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatValue(i: Indicator): string {
  if (i.value == null) return "—";
  switch (i.unit) {
    case "percent": return `${i.value.toFixed(1)}%`;
    case "dollars": return i.value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    case "people": return i.value >= 1000 ? Math.round(i.value).toLocaleString("en-US") : i.value.toFixed(2);
    case "minutes": return `${i.value.toFixed(0)} min`;
    case "years": return `${i.value.toFixed(1)} yrs`;
    case "degreesF": return `${Math.round(i.value)}°F`;
    case "inches": return `${i.value.toFixed(1)} in`;
    default: return String(i.value);
  }
}

const formatNational = (i: Indicator) =>
  i.national == null ? null : formatValue({ ...i, value: i.national });

/** Grey, not green or red: "more than average" is only good or bad in context. */
function ComparisonMark({ i }: { i: Indicator }) {
  if (!i.comparison || i.comparison === "similar") {
    return (
      <span title="About the same as the national figure" style={{ color: C.mist, display: "inline-flex", alignItems: "center", gap: 3 }}>
        <Minus size={12} /> same
      </span>
    );
  }
  const up = i.comparison === "higher";
  const Icon = up ? TrendingUp : TrendingDown;
  // Where a high number is the good news (check-ups, screening), flip the colour.
  const good = HIGHER_IS_BETTER.has(i.key) ? up : undefined;
  const color = good === undefined ? C.ink2 : good ? C.ledger : C.signal;
  return (
    <span title={`${up ? "Higher" : "Lower"} than the national figure`} style={{ color, display: "inline-flex", alignItems: "center", gap: 3 }}>
      <Icon size={12} /> {up ? "higher" : "lower"}
    </span>
  );
}

function IndicatorRow({ i }: { i: Indicator }) {
  const national = formatNational(i);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.line}`, alignItems: "baseline" }}>
      <div>
        <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.4 }}>{i.label}</div>
        {national && (
          <div style={{ fontSize: 11.5, color: C.mist, marginTop: 1 }}>
            National {national} · <ComparisonMark i={i} />
          </div>
        )}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 15, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        {formatValue(i)}
      </div>
    </div>
  );
}

function Group({ group, Icon }: { group: IndicatorGroup; Icon: typeof Users }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
        <Icon size={15} color={C.ledger} />
        <span style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14.5, color: C.ink }}>{group.label}</span>
      </div>
      <div style={{ fontSize: 12.5, color: C.mist, lineHeight: 1.5, marginBottom: 6 }}>{group.blurb}</div>
      {group.indicators.map((i) => <IndicatorRow key={i.key} i={i} />)}
    </div>
  );
}

const KIND: Record<Implication["kind"], { label: string; color: string; bg: string; Icon: typeof Lightbulb }> = {
  opportunity: { label: "Opportunity", color: C.ledger, bg: C.ledgerSoft, Icon: Lightbulb },
  challenge: { label: "Harder here", color: C.alert, bg: "#F9E9E6", Icon: AlertTriangle },
  watch: { label: "Worth knowing", color: C.ink2, bg: C.paper, Icon: Eye },
};

function ImplicationCard({ item }: { item: Implication }) {
  const k = KIND[item.kind];
  return (
    <div style={{ border: `1px solid ${C.line}`, borderLeft: `4px solid ${k.color}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4, fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 600,
          letterSpacing: "0.05em", textTransform: "uppercase", color: k.color, background: k.bg,
          borderRadius: 999, padding: "3px 9px",
        }}>
          <k.Icon size={11} /> {k.label}
        </span>
        {item.forIndustry && (
          <span style={{ fontSize: 11, color: C.mist }}>for your industry</span>
        )}
      </div>
      <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14.5, color: C.ink, lineHeight: 1.4 }}>{item.title}</div>
      <div style={{ fontSize: 12.5, color: C.mist, margin: "5px 0 7px", fontFamily: FONT_MONO, lineHeight: 1.5 }}>{item.basis}</div>
      <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.6 }}>{item.consider}</div>
    </div>
  );
}

export default function CommunityPanel({
  location, industry, compact = false, heading = "The community around this business",
}: {
  location: string;
  industry?: string;
  /** Compact: the headline findings only, with a link to the full profile. */
  compact?: boolean;
  heading?: string;
}) {
  const key = location.trim().length >= 3 ? `${location.trim()}|${industry ?? ""}` : "";
  const [result, setResult] = useState<{ key: string; data: Response | null; error: string }>({ key: "", data: null, error: "" });
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const [loc, ind] = key.split("|");
    const qs = new URLSearchParams({ location: loc });
    if (ind) qs.set("industry", ind);
    fetch(`/api/community?${qs}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Couldn't load community data.");
        return j as Response;
      })
      .then((j) => { if (!cancelled) setResult({ key, data: j, error: "" }); })
      .catch((e) => { if (!cancelled) setResult({ key, data: null, error: e instanceof Error ? e.message : "Couldn't load community data." }); });
    return () => { cancelled = true; };
  }, [key]);

  const loading = key !== "" && result.key !== key;
  const data = result.key === key ? result.data : null;
  const error = result.key === key ? result.error : "";

  const hasPrecip = Boolean(data?.climate?.months.some((m) => m.precipIn != null));
  const climateChart = useMemo(
    () => data?.climate?.months.map((m) => ({
      month: MONTHS[m.month - 1],
      "Avg temp (°F)": m.avgTempF,
      "Rain/snow (in)": m.precipIn,
    })) ?? [],
    [data],
  );

  if (!key) return null;
  if (loading) {
    return <Card><div style={{ fontSize: 13.5, color: C.mist }}>Loading community figures for {location}…</div></Card>;
  }
  if (error) {
    return <Card><div style={{ fontSize: 13.5, color: C.mist }}>{error}</div></Card>;
  }
  if (!data) return null;

  const shownImplications = compact && !showAll ? data.implications.slice(0, 3) : data.implications;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
          <H>{heading}</H>
          <div style={{ fontSize: 12.5, color: C.mist }}>
            {data.geography.label}
            {data.population != null && <> · {Math.round(data.population).toLocaleString("en-US")} residents</>}
          </div>
        </div>

        {data.implications.length > 0 ? (
          <>
            <div style={{ fontSize: 13, color: C.mist, margin: "6px 0 14px", lineHeight: 1.55, maxWidth: 700 }}>
              What stands out about this place{data.industry ? ` for a ${data.industry.toLowerCase()} business` : ""}, and what each thing is
              worth checking before committing money.
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {shownImplications.map((item) => <ImplicationCard key={item.id} item={item} />)}
            </div>
            {compact && data.implications.length > 3 && (
              <button
                onClick={() => setShowAll(!showAll)}
                style={{ background: "none", border: "none", color: C.ledger, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "10px 0 0" }}
              >
                {showAll ? "Show fewer" : `Show ${data.implications.length - 3} more`}
              </button>
            )}
          </>
        ) : (
          <div style={{ fontSize: 13.5, color: C.mist, marginTop: 8, lineHeight: 1.55 }}>
            Nothing here stands out sharply against the national picture — this county sits close to average on the
            measures we check. The figures below are still worth a look.
          </div>
        )}

        <div style={{ display: "flex", gap: 7, marginTop: 14, alignItems: "flex-start" }}>
          <Info size={13} color={C.signal} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 11.5, color: C.mist, lineHeight: 1.55 }}>{data.implicationCaveat}</div>
        </div>

        {compact && (
          <div style={{ marginTop: 14 }}>
            <Link
              href={`/data/community?location=${encodeURIComponent(location)}${industry ? `&industry=${encodeURIComponent(industry)}` : ""}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, color: C.ledger, fontWeight: 600, fontSize: 13.5, textDecoration: "none" }}
            >
              See every figure for {data.geography.label} <ArrowUpRight size={15} />
            </Link>
          </div>
        )}
      </Card>

      {!compact && (
        <>
          <Card>
            <H size={16}>Who lives here, and what they can spend</H>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 24, marginTop: 12 }}>
              {data.people.map((g) => <Group key={g.key} group={g} Icon={Users} />)}
            </div>
          </Card>

          {data.health.length > 0 && (
            <Card>
              <H size={16}>
                <HeartPulse size={16} style={{ verticalAlign: -3, marginRight: 7 }} color={C.ledger} />
                Community health
              </H>
              <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 12px", lineHeight: 1.55, maxWidth: 700 }}>
                Estimated share of adults in this county. These come from the CDC&apos;s PLACES program, which models
                local figures from a national survey — they show what stands out, rather than measuring the people here.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 24 }}>
                {data.health.map((g) => <Group key={g.key} group={g} Icon={HeartPulse} />)}
              </div>
            </Card>
          )}

          {data.hazards && data.hazards.total > 0 && (
            <Card>
              <H size={16}>
                <ShieldAlert size={16} style={{ verticalAlign: -3, marginRight: 7 }} color={C.ledger} />
                Disasters declared since {data.hazards.sinceYear}
              </H>
              <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 12px" }}>
                {data.hazards.total} federally declared {data.hazards.total === 1 ? "disaster" : "disasters"} affecting this county.
              </div>
              <div style={{ display: "grid", gap: 2 }}>
                {data.hazards.types.map((t) => (
                  <div key={t.type} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${C.line}`, fontSize: 13.5 }}>
                    <span style={{ color: C.ink }}>{t.type}</span>
                    <span style={{ color: C.mist, fontFamily: FONT_MONO, fontSize: 12.5 }}>
                      {t.count}× · most recent {t.latestYear}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {data.climate && (
            <Card>
              <H size={16}>
                <CloudSun size={16} style={{ verticalAlign: -3, marginRight: 7 }} color={C.ledger} />
                A typical year
              </H>
              <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 12px", lineHeight: 1.55 }}>
                Thirty-year averages from {data.climate.station.name}
                {data.climate.station.distanceMiles >= 1 && <>, about {Math.round(data.climate.station.distanceMiles)} miles away</>}.
                {data.climate.annualPrecipIn != null
                  ? <> About {data.climate.annualPrecipIn} inches of rain and snow a year.</>
                  : <> This station reports temperature only.</>}
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <ComposedChart data={climateChart} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11.5 }} />
                  <YAxis yAxisId="t" tick={{ fontSize: 11, fontFamily: FONT_MONO }} width={38} />
                  {hasPrecip && <YAxis yAxisId="p" orientation="right" tick={{ fontSize: 11, fontFamily: FONT_MONO }} width={32} />}
                  <Tooltip />
                  {hasPrecip && <Bar yAxisId="p" dataKey="Rain/snow (in)" fill="#AED8C8" radius={[3, 3, 0, 0]} />}
                  <Line yAxisId="t" type="monotone" dataKey="Avg temp (°F)" stroke={C.signal} strokeWidth={2.5} dot={{ r: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Card>
            <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
              <Info size={14} color={C.signal} style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14, color: C.ink, marginBottom: 6 }}>
                  How to read these figures
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
                  {data.limitations.map((l, i) => <li key={i} style={{ fontSize: 12.5, color: C.mist, lineHeight: 1.55 }}>{l}</li>)}
                  {data.unavailable.length > 0 && (
                    <li style={{ fontSize: 12.5, color: C.alert, lineHeight: 1.55 }}>
                      Didn&apos;t load this time: {data.unavailable.join(", ").toLowerCase()}.
                    </li>
                  )}
                </ul>
                <div style={{ fontSize: 11.5, color: C.mist, marginTop: 10 }}>{data.sources.join(" · ")}</div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

