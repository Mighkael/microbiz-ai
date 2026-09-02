"use client";

import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { FileDown, Printer, RotateCcw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import type { Profile } from "@/lib/data";
import { runScenario, compareOutcomes, NO_CHANGE, type Levers } from "@/lib/scenarios";
import { Card, H, Btn, Label } from "./ui";

const SCENARIO_NAMES = ["Scenario A", "Scenario B"] as const;
const SCENARIO_COLORS = [C.signal, C.ink2];

const fmt = {
  currency: (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
  percent: (n: number) => `${(n * 100).toFixed(1)}%`,
  number: (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 }),
  months: (n: number) => `${n.toFixed(1)} mo`,
};

const LEVERS: Array<{
  key: keyof Levers; label: string; min: number; max: number; step: number; suffix: string; hint: string;
}> = [
  { key: "volumeChangePct", label: "Sales volume", min: -50, max: 100, step: 1, suffix: "%", hint: "More or fewer customers, same prices." },
  { key: "priceChangePct", label: "Prices", min: -30, max: 50, step: 1, suffix: "%", hint: "Assumes volume holds — often optimistic." },
  { key: "expenseChangePct", label: "Operating expenses", min: -40, max: 60, step: 1, suffix: "%", hint: "Rent, supplies, utilities and the rest." },
  { key: "employeeDelta", label: "Staff change", min: -10, max: 20, step: 1, suffix: "", hint: "Hires (+) or reductions (−)." },
];

function DeltaIcon({ change, higherIsBetter }: { change: number | null; higherIsBetter: boolean }) {
  if (change === null || Math.abs(change) < 0.0001) return <Minus size={13} color={C.mist} />;
  const good = higherIsBetter ? change > 0 : change < 0;
  const color = good ? C.ledger : C.alert;
  return change > 0 ? <TrendingUp size={13} color={color} /> : <TrendingDown size={13} color={color} />;
}

export default function ScenarioSimulator({ profile }: { profile: Profile }) {
  const [scenarios, setScenarios] = useState<Levers[]>([{ ...NO_CHANGE }]);
  const [exporting, setExporting] = useState(false);

  const base = useMemo(() => runScenario(profile, NO_CHANGE), [profile]);
  const outcomes = useMemo(() => scenarios.map((s) => runScenario(profile, s)), [profile, scenarios]);

  const setLever = (i: number, key: keyof Levers, value: number) =>
    setScenarios((cur) => cur.map((s, j) => (j === i ? { ...s, [key]: value } : s)));

  const chartData = useMemo(() => {
    const rows = [
      { metric: "Revenue", Current: base.revenue },
      { metric: "Expenses", Current: base.expenses },
      { metric: "Profit", Current: base.profit },
    ] as Array<Record<string, string | number>>;
    outcomes.forEach((o, i) => {
      rows[0][SCENARIO_NAMES[i]] = o.revenue;
      rows[1][SCENARIO_NAMES[i]] = o.expenses;
      rows[2][SCENARIO_NAMES[i]] = o.profit;
    });
    return rows;
  }, [base, outcomes]);

  async function exportWord() {
    setExporting(true);
    try {
      const columns = ["Measure", "Current", ...scenarios.map((_, i) => SCENARIO_NAMES[i])];
      const rows = compareOutcomes(base, outcomes[0]).map((d) => {
        const f = fmt[d.format];
        return [
          d.label,
          d.base === null ? "n/a" : f(d.base),
          ...outcomes.map((o) => {
            const v = o[d.key];
            return v === null ? "n/a" : f(v as number);
          }),
        ];
      });

      const assumptions = scenarios.map((s, i) => {
        const parts = [
          s.volumeChangePct ? `sales volume ${s.volumeChangePct > 0 ? "+" : ""}${s.volumeChangePct}%` : null,
          s.priceChangePct ? `prices ${s.priceChangePct > 0 ? "+" : ""}${s.priceChangePct}%` : null,
          s.expenseChangePct ? `operating expenses ${s.expenseChangePct > 0 ? "+" : ""}${s.expenseChangePct}%` : null,
          s.employeeDelta ? `${s.employeeDelta > 0 ? "+" : ""}${s.employeeDelta} staff at ${fmt.currency(s.costPerEmployee)} each` : null,
          s.monthlyAddedCost ? `${fmt.currency(s.monthlyAddedCost)}/month added cost` : null,
        ].filter(Boolean);
        return `${SCENARIO_NAMES[i]}: ${parts.length ? parts.join("; ") : "no changes from current"}.`;
      });

      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Scenario Analysis",
          subtitle: `${profile.industry}${profile.location ? ` · ${profile.location}` : ""}`,
          sections: [
            {
              heading: "Assumptions",
              paragraphs: [
                "Each scenario below applies the following changes to the current figures. These are assumptions supplied by the business owner, not forecasts.",
                ...assumptions,
              ],
            },
            { heading: "Comparison", table: { columns, rows } },
            {
              heading: "How to read this",
              paragraphs: [
                "Revenue moves with sales volume and price together — selling 10% more at 5% higher prices multiplies to 15.5%, not 15%.",
                "Break-even revenue uses the variable-cost ratio typical of this industry, the same split used elsewhere in MicroBiz AI.",
                "A price rise assumes volume holds. In practice raising prices usually costs some volume, so treat price-led scenarios as the optimistic end.",
              ],
            },
          ],
          sources: [
            "Current figures: supplied by the business owner in the MicroBiz AI assessment.",
            "Industry variable-cost ratios: MicroBiz AI internal estimates by sector, not published data.",
          ],
          limitations:
            "These are modelled outcomes of assumptions you chose, not predictions and not a guarantee of results. MicroBiz AI is an educational tool and not financial, legal, tax, or investment advice.",
        }),
      });

      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "scenario-analysis.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Couldn't build the Word document. Please try again.");
    }
    setExporting(false);
  }

  const hasBase = (+profile.revenue || 0) > 0;

  if (!hasBase) {
    return (
      <Card>
        <H>Scenario simulator</H>
        <div style={{ fontSize: 13.5, color: C.mist, marginTop: 8 }}>
          Add your revenue and expenses in the assessment first — scenarios model changes against your actual figures.
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }} className="print-area">
      <Card className="no-print">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <H>What would change?</H>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {scenarios.length < 2 && (
              <Btn tone="ghost" onClick={() => setScenarios((c) => [...c, { ...NO_CHANGE }])}>Add Scenario B</Btn>
            )}
            <Btn tone="ghost" onClick={() => setScenarios((c) => c.map(() => ({ ...NO_CHANGE })))}>
              <RotateCcw size={14} style={{ verticalAlign: -2, marginRight: 5 }} />Reset
            </Btn>
          </div>
        </div>
        <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 18px", maxWidth: 640, lineHeight: 1.55 }}>
          Move the levers and watch the effect on profit, margin, cash flow and break-even. These are your assumptions
          played out in arithmetic — not a forecast of what will happen.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit,minmax(300px,1fr))`, gap: 22 }}>
          {scenarios.map((s, i) => (
            <div key={i} style={{
              border: `1px solid ${C.line}`, borderRadius: 10, padding: 16,
              borderTop: `3px solid ${SCENARIO_COLORS[i]}`,
            }}>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>
                {SCENARIO_NAMES[i]}
              </div>

              <div style={{ display: "grid", gap: 16 }}>
                {LEVERS.map((l) => (
                  <div key={l.key}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 13, color: C.ink }}>{l.label}</span>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, color: SCENARIO_COLORS[i] }}>
                        {s[l.key] > 0 ? "+" : ""}{s[l.key]}{l.suffix}
                      </span>
                    </div>
                    <input
                      type="range" min={l.min} max={l.max} step={l.step} value={s[l.key]}
                      onChange={(e) => setLever(i, l.key, +e.target.value)}
                      style={{ width: "100%", accentColor: SCENARIO_COLORS[i] }}
                      aria-label={`${SCENARIO_NAMES[i]} ${l.label}`}
                    />
                    <div style={{ fontSize: 11.5, color: C.mist }}>{l.hint}</div>
                  </div>
                ))}

                {s.employeeDelta !== 0 && (
                  <div>
                    <Label>Annual cost per employee</Label>
                    <input
                      type="number"
                      value={s.costPerEmployee || ""}
                      onChange={(e) => setLever(i, "costPerEmployee", +e.target.value)}
                      placeholder="45000"
                      style={{
                        width: "100%", padding: "8px 10px", border: `1px solid ${C.line}`,
                        borderRadius: 8, fontSize: 13, boxSizing: "border-box",
                      }}
                      aria-label={`${SCENARIO_NAMES[i]} annual cost per employee`}
                    />
                    <div style={{ fontSize: 11.5, color: C.mist, marginTop: 3 }}>
                      Wages plus payroll taxes and benefits. Staff changes are ignored until this is set.
                    </div>
                  </div>
                )}

                <div>
                  <Label>Added monthly cost</Label>
                  <input
                    type="number"
                    value={s.monthlyAddedCost || ""}
                    onChange={(e) => setLever(i, "monthlyAddedCost", +e.target.value)}
                    placeholder="0"
                    style={{
                      width: "100%", padding: "8px 10px", border: `1px solid ${C.line}`,
                      borderRadius: 8, fontSize: 13, boxSizing: "border-box",
                    }}
                    aria-label={`${SCENARIO_NAMES[i]} added monthly cost`}
                  />
                  <div style={{ fontSize: 11.5, color: C.mist, marginTop: 3 }}>
                    Marketing, delivery, a pricier supplier — anything recurring.
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <H>Side by side</H>
          <div style={{ display: "flex", gap: 8 }} className="no-print">
            <Btn tone="ghost" onClick={() => window.print()}>
              <Printer size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Print / PDF
            </Btn>
            <Btn tone="green" onClick={exportWord} disabled={exporting}>
              <FileDown size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
              {exporting ? "Building…" : "Word"}
            </Btn>
          </div>
        </div>

        <div style={{ overflowX: "auto", marginTop: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 520 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "9px 10px", borderBottom: `1px solid ${C.line}`, fontFamily: FONT_HEAD }}>Measure</th>
                <th style={{ textAlign: "right", padding: "9px 10px", borderBottom: `1px solid ${C.line}`, fontFamily: FONT_HEAD }}>Current</th>
                {scenarios.map((_, i) => (
                  <th key={i} style={{
                    textAlign: "right", padding: "9px 10px", borderBottom: `1px solid ${C.line}`,
                    fontFamily: FONT_HEAD, color: SCENARIO_COLORS[i],
                  }}>{SCENARIO_NAMES[i]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compareOutcomes(base, outcomes[0]).map((d) => {
                const f = fmt[d.format];
                return (
                  <tr key={d.key}>
                    <td style={{ padding: "9px 10px", borderBottom: `1px solid ${C.line}` }}>{d.label}</td>
                    <td style={{
                      padding: "9px 10px", borderBottom: `1px solid ${C.line}`, textAlign: "right",
                      fontFamily: FONT_MONO, fontVariantNumeric: "tabular-nums", color: C.mist,
                    }}>{d.base === null ? "n/a" : f(d.base)}</td>
                    {outcomes.map((o, i) => {
                      const v = o[d.key] as number | null;
                      const change = v === null || d.base === null ? null : v - d.base;
                      return (
                        <td key={i} style={{
                          padding: "9px 10px", borderBottom: `1px solid ${C.line}`, textAlign: "right",
                          fontFamily: FONT_MONO, fontVariantNumeric: "tabular-nums", color: C.ink, fontWeight: 600,
                        }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                            {v === null ? "n/a" : f(v)}
                            <DeltaIcon change={change} higherIsBetter={d.higherIsBetter} />
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 22 }}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
              <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11, fontFamily: FONT_MONO }} tickFormatter={(v) => "$" + (v / 1000).toFixed(0) + "k"} />
              <Tooltip formatter={(v) => fmt.currency(v as number)} />
              <Legend />
              <ReferenceLine y={0} stroke={C.mist} />
              <Bar dataKey="Current" fill={C.ledger} />
              {scenarios.map((_, i) => (
                <Bar key={i} dataKey={SCENARIO_NAMES[i]} fill={SCENARIO_COLORS[i]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ fontSize: 11.5, color: C.mist, marginTop: 16, lineHeight: 1.6 }}>
          Modelled from the assumptions you set against your own figures — not a prediction. A price rise assumes
          volume holds, which is usually optimistic. Break-even uses the variable-cost ratio typical of your industry,
          which is a MicroBiz AI estimate rather than published data.
        </div>
      </Card>
    </div>
  );
}
