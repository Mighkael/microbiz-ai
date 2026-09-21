"use client";

import { useRef, useState } from "react";
import { Upload, Download, Info, Check } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import { MONTH_NAMES, MONTH_SHORT, emptyMonth, type AgentData, type MonthEntry } from "@/lib/agent/types";
import { Card, H, Btn } from "../ui";
import { MoneyInput, parseMoney, downloadText } from "./shared";

type Field = keyof MonthEntry;

const COLUMNS: { key: Field; label: string; hint: string }[] = [
  { key: "plannedRevenue", label: "Planned revenue", hint: "What you aimed to sell that month" },
  { key: "revenue", label: "Actual revenue", hint: "What you actually sold" },
  { key: "expenses", label: "Expenses", hint: "Everything you spent running the business" },
  { key: "cash", label: "Cash at month end", hint: "Money in the business account(s)" },
];

/* ------------------------------------------------------------------ */
/* CSV import                                                          */
/* ------------------------------------------------------------------ */

/** Minimal CSV reader that understands quoted fields such as "$1,200". */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** "2026-03", "3", "Mar", "March", "03/2026" → 2 (zero-based), or null. */
function monthIndex(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  const iso = s.match(/^\d{4}[-/](\d{1,2})/);
  if (iso) return +iso[1] - 1;
  const us = s.match(/^(\d{1,2})[-/]\d{4}$/);
  if (us) return +us[1] - 1;
  if (/^\d{1,2}$/.test(s)) return +s - 1;
  const byName = MONTH_NAMES.findIndex((m) => s.startsWith(m.toLowerCase().slice(0, 3)));
  return byName >= 0 ? byName : null;
}

const HEADER_MATCH: Record<Field, RegExp> = {
  plannedRevenue: /plan|target|budget.*rev/i,
  revenue: /^(actual.*)?(revenue|sales|income)/i,
  expenses: /expense|cost|spend/i,
  cash: /cash|balance|bank/i,
};

type Parsed = { rows: { month: number; values: Partial<MonthEntry> }[]; columns: Field[]; skipped: number };

function interpret(text: string): Parsed | string {
  const table = parseCsv(text);
  if (table.length < 2) return "The file needs a header row and at least one month.";
  const header = table[0].map((h) => h.trim());
  const monthCol = header.findIndex((h) => /month|period|date/i.test(h));
  if (monthCol < 0) return "Couldn't find a Month column. The first row should name the columns, e.g. Month, Revenue, Expenses, Cash.";

  const cols = new Map<Field, number>();
  header.forEach((h, i) => {
    if (i === monthCol) return;
    // Planned revenue is checked first so "Planned revenue" isn't read as actual revenue.
    for (const f of ["plannedRevenue", "revenue", "expenses", "cash"] as Field[]) {
      if (!cols.has(f) && HEADER_MATCH[f].test(h)) { cols.set(f, i); break; }
    }
  });
  if (cols.size === 0) return "Couldn't find any Revenue, Expenses or Cash columns.";

  let skipped = 0;
  const rows = table.slice(1).flatMap((r) => {
    const m = monthIndex(r[monthCol] ?? "");
    if (m == null || m < 0 || m > 11) { skipped++; return []; }
    const values: Partial<MonthEntry> = {};
    for (const [f, i] of cols) values[f] = parseMoney(r[i] ?? "");
    return [{ month: m, values }];
  });
  if (rows.length === 0) return "None of the rows had a month we could read.";
  return { rows, columns: [...cols.keys()], skipped };
}

const TEMPLATE = "Month,Planned revenue,Revenue,Expenses,Cash\nJanuary,,,,\nFebruary,,,,\nMarch,,,,\n";

/* ------------------------------------------------------------------ */

export default function PlanPanel({
  data, update,
}: {
  data: AgentData;
  update: (fn: (d: AgentData) => AgentData) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Parsed | null>(null);
  const [importError, setImportError] = useState("");
  const [saved, setSaved] = useState(false);

  const setPlan = (key: "revenueTarget" | "expenseBudget" | "cashFloor", v: number | null) =>
    update((d) => ({ ...d, plan: { ...d.plan, [key]: v } }));

  const setCell = (month: number, field: Field, v: number | null) =>
    update((d) => ({ ...d, months: d.months.map((m, i) => (i === month ? { ...m, [field]: v } : m)) }));

  function spreadTarget() {
    const t = data.plan.revenueTarget;
    if (t == null) return;
    update((d) => ({ ...d, months: d.months.map((m) => ({ ...m, plannedRevenue: Math.round((t / 12) * 100) / 100 })) }));
  }

  async function onFile(file: File) {
    setImportError(""); setPreview(null);
    if (file.size > 200_000) { setImportError("That file is too large for a monthly summary."); return; }
    const result = interpret(await file.text());
    if (typeof result === "string") setImportError(result);
    else setPreview(result);
  }

  function applyImport() {
    if (!preview) return;
    update((d) => {
      const months = d.months.map((m) => ({ ...m }));
      for (const r of preview.rows) {
        for (const [k, v] of Object.entries(r.values) as [Field, number | null][]) {
          // An empty cell in the file leaves what's already there.
          if (v != null) months[r.month][k] = v;
        }
      }
      return { ...d, months };
    });
    setPreview(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const plannedSum = data.months.reduce((s, m) => s + (m.plannedRevenue ?? 0), 0);
  const hasMonthlyPlan = data.months.some((m) => m.plannedRevenue != null);
  const planMismatch = hasMonthlyPlan && data.plan.revenueTarget != null
    && Math.abs(plannedSum - data.plan.revenueTarget) > Math.max(1, data.plan.revenueTarget * 0.01);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <H>Your plan for {data.plan.year}</H>
        <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 16px", lineHeight: 1.55, maxWidth: 680 }}>
          Set the targets the agent should hold you to. Leave anything you haven&apos;t decided blank — the agent
          only compares against what you set.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 12.5, color: C.mist }}>Revenue target for the year</span>
            <MoneyInput label="Revenue target" value={data.plan.revenueTarget} onChange={(v) => setPlan("revenueTarget", v)} placeholder="e.g. 500,000" />
          </label>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 12.5, color: C.mist }}>Expense budget for the year</span>
            <MoneyInput label="Expense budget" value={data.plan.expenseBudget} onChange={(v) => setPlan("expenseBudget", v)} placeholder="optional" />
          </label>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 12.5, color: C.mist }}>Lowest cash balance you&apos;re comfortable with</span>
            <MoneyInput label="Minimum cash" value={data.plan.cashFloor} onChange={(v) => setPlan("cashFloor", v)} placeholder="optional" />
          </label>
        </div>
        {data.plan.revenueTarget != null && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
            <Btn tone="ghost" onClick={spreadTarget}>Spread the target evenly across months</Btn>
            <span style={{ fontSize: 12.5, color: C.mist }}>
              Seasonal business? Enter a planned revenue for each month below instead — the comparison will be fairer.
            </span>
          </div>
        )}
        {planMismatch && (
          <div style={{ fontSize: 12.5, color: "#A86D0B", marginTop: 10 }}>
            Your monthly plan adds up to {plannedSum.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })},
            which differs from the annual target. The agent uses the monthly figures for plan-to-date.
          </div>
        )}
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <H>Month by month</H>
            <div style={{ fontSize: 13, color: C.mist, marginTop: 4, lineHeight: 1.55, maxWidth: 560 }}>
              Type your figures, or upload a spreadsheet saved as CSV. Once a month is enough — the agent re-checks
              everything as soon as a number changes.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn tone="ghost" onClick={() => fileRef.current?.click()}>
              <Upload size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Upload CSV
            </Btn>
            <Btn tone="ghost" onClick={() => downloadText("microbiz-monthly-template.csv", TEMPLATE, "text/csv")}>
              <Download size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Template
            </Btn>
          </div>
          <input
            ref={fileRef} type="file" accept=".csv,text/csv" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
          />
        </div>

        {importError && <div role="alert" style={{ fontSize: 13, color: C.alert, marginTop: 12 }}>{importError}</div>}
        {saved && (
          <div style={{ fontSize: 13, color: C.ledger, marginTop: 12 }}>
            <Check size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Figures imported.
          </div>
        )}

        {preview && (
          <div style={{ marginTop: 14, background: C.paper, borderRadius: 10, padding: 14 }}>
            <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14, color: C.ink }}>
              Check before importing: {preview.rows.length} month{preview.rows.length === 1 ? "" : "s"} found
            </div>
            <div style={{ fontSize: 12.5, color: C.mist, margin: "4px 0 10px" }}>
              Columns read: {preview.columns.map((c) => COLUMNS.find((x) => x.key === c)!.label).join(", ")}.
              {preview.skipped > 0 && ` ${preview.skipped} row${preview.skipped === 1 ? "" : "s"} without a readable month will be skipped.`}
              {" "}Empty cells leave what&apos;s already entered.
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12.5, minWidth: 420 }}>
                <thead><tr>
                  <th style={{ textAlign: "left", padding: "4px 10px 4px 0" }}>Month</th>
                  {preview.columns.map((c) => <th key={c} style={{ textAlign: "right", padding: "4px 10px" }}>{COLUMNS.find((x) => x.key === c)!.label}</th>)}
                </tr></thead>
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: "3px 10px 3px 0" }}>{MONTH_NAMES[r.month]}</td>
                      {preview.columns.map((c) => (
                        <td key={c} style={{ textAlign: "right", padding: "3px 10px", fontFamily: FONT_MONO }}>
                          {r.values[c] == null ? "—" : (r.values[c] as number).toLocaleString("en-US")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Btn tone="green" onClick={applyImport}>Import into {data.plan.year}</Btn>
              <Btn tone="ghost" onClick={() => setPreview(null)}>Cancel</Btn>
            </div>
          </div>
        )}

        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", fontSize: 12, color: C.mist, fontWeight: 600, padding: "0 8px 8px 0" }}>Month</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} title={c.hint} style={{ textAlign: "right", fontSize: 12, color: C.mist, fontWeight: 600, padding: "0 0 8px 8px" }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.months.map((m, i) => (
                <tr key={i}>
                  <td style={{ padding: "3px 8px 3px 0", fontSize: 13.5, color: C.ink, whiteSpace: "nowrap" }}>{MONTH_SHORT[i]}</td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} style={{ padding: "3px 0 3px 8px" }}>
                      <MoneyInput
                        compact allowNegative={false}
                        label={`${c.label}, ${MONTH_NAMES[i]}`}
                        value={m[c.key]}
                        onChange={(v) => setCell(i, c.key, v)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 7, marginTop: 14, alignItems: "flex-start" }}>
          <Info size={13} color={C.signal} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 12, color: C.mist, lineHeight: 1.55 }}>
            A blank cell means &quot;not entered&quot;, not zero — the agent skips it rather than treating it as a month
            with no sales. Your figures are saved in this browser on this device.
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <button
            onClick={() => { if (confirm("Clear every monthly figure for this year? Your targets stay.")) update((d) => ({ ...d, months: d.months.map(emptyMonth) })); }}
            style={{ background: "none", border: "none", color: C.mist, fontSize: 12.5, textDecoration: "underline", cursor: "pointer", padding: 0 }}
          >
            Clear all monthly figures
          </button>
        </div>
      </Card>
    </div>
  );
}

