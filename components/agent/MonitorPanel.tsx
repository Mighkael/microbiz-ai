"use client";

import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Activity, MessageCircle, Info } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import { MONTH_SHORT, type AgentData, type AssistantRole } from "@/lib/agent/types";
import { analyze, usd, type Alert } from "@/lib/agent/analysis";
import { Card, H, Btn } from "../ui";
import { SeverityBadge, SEVERITY, todayISO } from "./shared";

const STEPS: { key: keyof Pick<Alert, "plan" | "actual" | "forecast" | "risk" | "action">; label: string }[] = [
  { key: "plan", label: "Plan" },
  { key: "actual", label: "Actual" },
  { key: "forecast", label: "Forecast" },
  { key: "risk", label: "Risk" },
  { key: "action", label: "Recommended action" },
];

const ROLE_FOR_AREA: Record<Alert["area"], AssistantRole> = {
  revenue: "financial", expenses: "financial", profit: "financial", cash: "financial", obligations: "compliance",
};

const compact = (n: number) =>
  Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `$${(n / 1e3).toFixed(0)}k` : `$${Math.round(n)}`;

export default function MonitorPanel({
  data, onAsk, onGoTo,
}: {
  data: AgentData;
  onAsk: (role: AssistantRole, question: string) => void;
  onGoTo: (tab: "plan" | "obligations") => void;
}) {
  // Runs on every render: the "monitoring" is simply that the agent checks
  // again whenever the owner opens this page or changes a figure.
  const a = useMemo(() => analyze(data, todayISO()), [data]);

  const chart = useMemo(() => {
    type Point = { month: string; Plan: number | null; Actual: number | null; Forecast: number | null };
    const rows: Point[] = [];
    let plan = 0;
    let actual = 0;
    for (const r of a.rows) {
      plan += r.planned ?? 0;
      if (r.revenue != null) actual += r.revenue;
      rows.push({
        month: MONTH_SHORT[r.month],
        Plan: r.planned != null ? Math.round(plan) : null,
        Actual: r.month <= a.lastMonth ? Math.round(actual) : null,
        Forecast: null,
      });
    }
    // The forecast continues from the last actual at the recent monthly average.
    if (a.lastMonth >= 0 && a.runRate.revenue != null && a.lastMonth < 11) {
      let f = rows[a.lastMonth].Actual as number;
      rows[a.lastMonth].Forecast = f;
      for (let i = a.lastMonth + 1; i < 12; i++) { f += a.runRate.revenue; rows[i].Forecast = Math.round(f); }
    }
    return rows;
  }, [a]);

  const nothingYet = a.monthsEntered === 0 && data.plan.revenueTarget == null && data.obligations.length === 0;

  if (nothingYet) {
    return (
      <Card>
        <H>Nothing to monitor yet</H>
        <div style={{ fontSize: 14, color: C.mist, lineHeight: 1.6, margin: "8px 0 16px", maxWidth: 620 }}>
          Give the agent a target and a month of figures, and it will compare them, project the year, and tell you
          where you&apos;re off track — with a recommended next step for each. Deadlines work the same way.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn tone="green" onClick={() => onGoTo("plan")}>Set a plan and enter a month</Btn>
          <Btn tone="ghost" onClick={() => onGoTo("obligations")}>Add deadlines</Btn>
        </div>
      </Card>
    );
  }

  const needsAttention = a.alerts.filter((x) => x.severity === "high" || x.severity === "medium").length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
          <H>
            <Activity size={17} style={{ verticalAlign: -3, marginRight: 7 }} color={C.ledger} />
            {needsAttention ? `${needsAttention} thing${needsAttention === 1 ? "" : "s"} need${needsAttention === 1 ? "s" : ""} your attention` : "Everything is on track"}
          </H>
          <div style={{ fontSize: 12.5, color: C.mist }}>Checked just now against your {a.year} plan</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginTop: 14 }}>
          <Stat label="Revenue to date" value={a.monthsEntered ? usd(a.ytd.revenue) : "—"}
            sub={a.revenueGap != null ? `${a.revenueGap >= 0 ? "+" : "−"}${Math.abs(a.revenueGap * 100).toFixed(0)}% against plan` : "No plan to compare"}
            tone={a.revenueGap == null ? undefined : a.revenueGap <= -0.05 ? C.alert : C.ledger} />
          <Stat label="Year-end forecast" value={a.forecast.revenue != null ? usd(a.forecast.revenue) : "—"}
            sub={data.plan.revenueTarget != null ? `Target ${usd(data.plan.revenueTarget)}` : "At the recent pace"} />
          <Stat label="Needed per month" value={a.requiredMonthly != null && a.lastMonth < 11 ? usd(a.requiredMonthly) : "—"}
            sub={a.runRate.revenue != null ? `Recent average ${usd(a.runRate.revenue)}` : "To reach the target"} />
          <Stat label="Cash" value={a.latestCash != null ? usd(a.latestCash) : "—"}
            sub={a.runwayMonths != null ? `≈ ${a.runwayMonths.toFixed(1)} months at the recent loss` : a.latestCash != null ? "Not shrinking" : "Enter month-end cash"}
            tone={a.runwayMonths != null && a.runwayMonths < 6 ? C.alert : undefined} />
        </div>
      </Card>

      {a.alerts.map((x) => (
        <Card key={x.id} style={{ borderLeft: `4px solid ${SEVERITY[x.severity].color}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <SeverityBadge severity={x.severity} />
              <span style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 16, color: C.ink }}>{x.title}</span>
            </div>
            {x.severity !== "good" && (
              <button
                onClick={() => onAsk(ROLE_FOR_AREA[x.area], `${x.title}. What exactly should I do about it this week?`)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${C.line}`,
                  borderRadius: 8, padding: "6px 10px", fontSize: 12.5, color: C.ledger, cursor: "pointer", fontWeight: 600,
                }}
              >
                <MessageCircle size={14} /> Ask the agent
              </button>
            )}
          </div>

          <div style={{ display: "grid", gap: 0, marginTop: 12 }}>
            {STEPS.map((s, i) => (
              <div key={s.key} style={{
                display: "grid", gridTemplateColumns: "minmax(96px, 150px) 1fr", gap: 12,
                padding: "8px 0", borderTop: i ? `1px solid ${C.line}` : "none",
              }}>
                <div style={{
                  fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase",
                  color: s.key === "action" ? C.ledger : C.mist, fontWeight: 600, paddingTop: 2,
                }}>{s.label}</div>
                <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.55, fontWeight: s.key === "action" ? 500 : 400 }}>{x[s.key]}</div>
              </div>
            ))}
          </div>
        </Card>
      ))}

      {a.lastMonth >= 0 && chart.some((r) => r.Plan != null) && (
        <Card>
          <H size={16}>Revenue so far against plan</H>
          <div style={{ fontSize: 12.5, color: C.mist, margin: "4px 0 12px" }}>Running totals for {a.year}.</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chart} margin={{ left: 4, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
              <XAxis dataKey="month" tick={{ fontSize: 11.5 }} />
              <YAxis tick={{ fontSize: 11, fontFamily: FONT_MONO }} tickFormatter={compact} width={52} />
              <Tooltip formatter={(v) => (typeof v === "number" ? usd(v) : "—")} />
              <Legend />
              <Line type="monotone" dataKey="Plan" stroke={C.mist} strokeDasharray="5 4" dot={false} strokeWidth={2} connectNulls />
              <Line type="monotone" dataKey="Actual" stroke={C.ledger} strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Forecast" stroke={C.signal} strokeDasharray="3 3" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card>
        <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
          <Info size={14} color={C.signal} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14, color: C.ink, marginBottom: 6 }}>How the agent checks</div>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
              {a.methods.map((m) => <li key={m} style={{ fontSize: 12.5, color: C.mist, lineHeight: 1.55 }}>{m}</li>)}
              <li style={{ fontSize: 12.5, color: C.mist, lineHeight: 1.55 }}>
                The agent re-checks every time you open this page or change a figure. It doesn&apos;t connect to your
                bank or accounting software, so it only knows what you enter.
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div style={{ background: C.paper, borderRadius: 9, padding: "10px 12px" }}>
      <div style={{ fontSize: 11.5, color: C.mist }}>{label}</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 600, color: C.ink, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: tone ?? C.mist, marginTop: 2 }}>{sub}</div>
    </div>
  );
}
