"use client";

import { useState } from "react";
import { FileText, FileDown, RefreshCw, Info } from "lucide-react";
import { C, FONT_HEAD } from "@/lib/theme";
import type { Profile } from "@/lib/data";
import type { AgentData } from "@/lib/agent/types";
import { Card, H, Btn, inputStyle } from "../ui";
import { MoneyInput, Toggle, todayISO } from "./shared";

type ReportType = "investor" | "lender";
type Section = { heading: string; paragraphs?: string[]; table?: { columns: string[]; rows: string[][] } };
type Payload = { title: string; subtitle?: string; sections: Section[]; sources?: string[]; limitations?: string };

const TYPES: { key: ReportType; label: string; blurb: string }[] = [
  {
    key: "lender", label: "Bank / Lender report",
    blurb: "Supports a loan application: your results against plan, the estimated payment on the loan you're asking for, how well recent profit covers it, and your obligations.",
  },
  {
    key: "investor", label: "Investor report",
    blurb: "For an investor or partner: traction, results against plan, the local market from Census data, your forecast, and what the money is for.",
  },
];

export default function ReportsPanel({
  data, profile, update,
}: {
  data: AgentData;
  profile: Profile | null;
  update: (fn: (d: AgentData) => AgentData) => void;
}) {
  const [type, setType] = useState<ReportType>("lender");
  const [businessName, setBusinessName] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [termMonths, setTermMonths] = useState("60");
  const [ratePct, setRatePct] = useState("");
  const [purpose, setPurpose] = useState("");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const current = TYPES.find((t) => t.key === type)!;
  const monthsEntered = data.months.filter((m) => m.revenue != null).length;

  async function generate() {
    setBusy(true); setError(""); setPayload(null);
    try {
      const res = await fetch("/api/agent/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type, data, today: todayISO(),
          profile: data.permissions.profile ? profile : null,
          options: { businessName, amount, termMonths, ratePct, purpose },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "The report couldn't be built.");
      setPayload(json.payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The report couldn't be built.");
    }
    setBusy(false);
  }

  async function downloadWord() {
    if (!payload) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/report", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${payload.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}.docx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("The Word file couldn't be created. Please try again.");
    }
    setDownloading(false);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <H>Create a report</H>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, marginTop: 12, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 12.5, color: C.mist }}>Report for</span>
            <select style={inputStyle} value={type} onChange={(e) => { setType(e.target.value as ReportType); setPayload(null); }} aria-label="Report type">
              {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>
          <div style={{ fontSize: 13, color: C.ink2, lineHeight: 1.5, paddingBottom: 4 }}>{current.blurb}</div>
        </div>

        {!data.permissions.financials ? (
          <div style={{ marginTop: 16, background: C.paper, borderRadius: 10, padding: 14 }}>
            <Toggle
              checked={false}
              onChange={(v) => update((d) => ({ ...d, permissions: { ...d.permissions, financials: v } }))}
              label="Allow reports to use my plan and monthly figures"
              description="Reports are built from these. Turning this on also lets the assistant see them; you can switch it off in Sharing at any time."
            />
          </div>
        ) : monthsEntered === 0 ? (
          <div style={{ marginTop: 16, fontSize: 13.5, color: C.mist }}>
            Enter at least one month of revenue in Plan &amp; actuals first. Three or more months make a far stronger report.
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginTop: 16 }}>
              <label style={{ display: "grid", gap: 5 }}>
                <span style={{ fontSize: 12.5, color: C.mist }}>Business name</span>
                <input style={inputStyle} value={businessName} maxLength={120} onChange={(e) => setBusinessName(e.target.value)} placeholder="As it should appear on the report" />
              </label>
              <label style={{ display: "grid", gap: 5 }}>
                <span style={{ fontSize: 12.5, color: C.mist }}>{type === "lender" ? "Loan amount" : "Investment sought"}</span>
                <MoneyInput label={type === "lender" ? "Loan amount" : "Investment sought"} value={amount} onChange={setAmount} placeholder="optional" />
              </label>
              {type === "lender" && (
                <>
                  <label style={{ display: "grid", gap: 5 }}>
                    <span style={{ fontSize: 12.5, color: C.mist }}>Term (months)</span>
                    <input style={inputStyle} inputMode="numeric" value={termMonths} onChange={(e) => setTermMonths(e.target.value.replace(/\D/g, "").slice(0, 3))} />
                  </label>
                  <label style={{ display: "grid", gap: 5 }}>
                    <span style={{ fontSize: 12.5, color: C.mist }}>Interest rate you&apos;ve been quoted (%)</span>
                    <input style={inputStyle} inputMode="decimal" value={ratePct} onChange={(e) => setRatePct(e.target.value.replace(/[^0-9.]/g, "").slice(0, 5))} placeholder="e.g. 9.5" />
                  </label>
                </>
              )}
            </div>
            <label style={{ display: "grid", gap: 5, marginTop: 14 }}>
              <span style={{ fontSize: 12.5, color: C.mist }}>{type === "lender" ? "What the loan is for" : "What the investment is for"}</span>
              <textarea
                style={{ ...inputStyle, minHeight: 70, resize: "vertical", lineHeight: 1.5 }} maxLength={600}
                value={purpose} onChange={(e) => setPurpose(e.target.value)}
                placeholder={type === "lender" ? "e.g. A second oven and working capital for the holiday season" : "e.g. Opening a second location and hiring two staff"}
              />
            </label>
            <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <Btn tone="green" onClick={generate} disabled={busy}>
                {busy
                  ? <><RefreshCw size={15} className="spin" style={{ verticalAlign: -3, marginRight: 6 }} />Building the report…</>
                  : <><FileText size={15} style={{ verticalAlign: -3, marginRight: 6 }} />Build report</>}
              </Btn>
              {monthsEntered < 3 && (
                <span style={{ fontSize: 12.5, color: "#A86D0B" }}>
                  Only {monthsEntered} month{monthsEntered === 1 ? "" : "s"} entered — readers will want at least three.
                </span>
              )}
            </div>
          </>
        )}
        {error && <div role="alert" style={{ fontSize: 13.5, color: C.alert, marginTop: 12 }}>{error}</div>}
      </Card>

      {payload && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12, color: C.mist }}>Preview — check every statement before you share it</div>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 22, color: C.ink, marginTop: 4 }}>{payload.title}</div>
              {payload.subtitle && <div style={{ fontSize: 13, color: C.mist }}>{payload.subtitle}</div>}
            </div>
            <Btn tone="green" onClick={downloadWord} disabled={downloading}>
              <FileDown size={15} style={{ verticalAlign: -3, marginRight: 6 }} />{downloading ? "Preparing…" : "Download Word"}
            </Btn>
          </div>

          <div style={{ display: "grid", gap: 20, marginTop: 20 }}>
            {payload.sections.map((s) => (
              <section key={s.heading}>
                <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 16, color: C.ledger, marginBottom: 6 }}>{s.heading}</div>
                {s.paragraphs?.map((p, i) => <p key={i} style={{ fontSize: 14, color: C.ink, lineHeight: 1.6, margin: "0 0 8px" }}>{p}</p>)}
                {s.table && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 460 }}>
                      {s.table.columns.some(Boolean) && (
                        <thead><tr>{s.table.columns.map((c, i) => (
                          <th key={i} style={{ textAlign: "left", padding: "7px 9px", borderBottom: `1px solid ${C.line}`, fontFamily: FONT_HEAD, background: C.paper }}>{c}</th>
                        ))}</tr></thead>
                      )}
                      <tbody>{s.table.rows.map((r, i) => (
                        <tr key={i}>{r.map((v, j) => (
                          <td key={j} style={{ padding: "7px 9px", borderBottom: `1px solid ${C.line}`, verticalAlign: "top", color: j === 0 ? C.ink2 : C.ink }}>{v}</td>
                        ))}</tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </div>

          {(payload.sources?.length || payload.limitations) && (
            <div style={{ display: "flex", gap: 7, marginTop: 20, alignItems: "flex-start", borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
              <Info size={13} color={C.signal} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: C.mist, lineHeight: 1.55 }}>
                {payload.sources?.map((s) => <div key={s}>{s}</div>)}
                {payload.limitations && <div style={{ marginTop: 6 }}>{payload.limitations}</div>}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
