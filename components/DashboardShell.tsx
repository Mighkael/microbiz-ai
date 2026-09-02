"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  LayoutDashboard, Calculator, ShieldAlert, Sparkles, Landmark, Newspaper,
  Rocket, TrendingUp, TrendingDown, RefreshCw, Send, Globe2, Users,
} from "lucide-react";
import { C, FONT_HEAD, FONT_MONO, FONT_BODY, NAV_H, fmt, pct } from "@/lib/theme";
import { FUNDING, BANKS, WORLD } from "@/lib/data";
import type { Profile, Metrics, ChatMessage } from "@/lib/data";
import { useMetrics } from "@/lib/useMetrics";
import { askAdvisor, type Evidence } from "@/lib/api";
import { Card, H, Label, Mono, Btn, ScoreRing, inputStyle } from "./ui";
import NewsPanel from "./NewsPanel";
import OpportunitiesPanel from "./OpportunitiesPanel";
import LocationInsight from "./LocationInsight";
import Markdown from "./Markdown";
import BenchmarkPanel from "./BenchmarkPanel";
import EvidenceTrail from "./EvidenceTrail";
import Copyright from "./Copyright";

/* ---------- tabs ---------- */
function Dashboard({ p, m }: { p: Profile; m: Metrics }) {
  const seasonal = [1, 0.92, 0.97, 1.02, 1.05, 1.08, 1.04, 1.0, 1.03, 1.06, 1.1, 1.18];
  const trend = seasonal.map((s, i) => ({
    month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i],
    Revenue: Math.round(m.mRev * s), Expenses: Math.round(m.mExp * (0.97 + 0.06 * (i % 3 === 0 ? 1 : 0))),
  }));
  const expenseSplit = [
    { name: "Variable (COGS, supplies)", value: Math.round(m.varCosts) },
    { name: "Fixed (rent, salaries, etc.)", value: Math.round(m.fixedCosts) },
  ];
  const kpis = [
    { label: "Net profit (annual)", value: fmt(m.profit), good: m.profit >= 0 },
    { label: "Net margin", value: pct(m.margin), sub: `industry avg ~${pct(m.bench.margin)}`, good: m.margin >= m.bench.margin },
    { label: "Monthly cash flow", value: fmt(m.mCash), good: m.mCash >= 0 },
    { label: "Revenue per employee", value: fmt(m.revPerEmp), good: true },
  ];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, alignItems: "stretch" }}>
        <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <ScoreRing score={m.score} />
          <div style={{ fontSize: 12, color: C.mist, marginTop: 6, textAlign: "center", maxWidth: 160 }}>
            Blends margin vs. industry, cash flow, reserves, and business age.
          </div>
        </Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 16 }}>
          {kpis.map((k) => (
            <Card key={k.label}>
              <Label>{k.label}</Label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Mono color={k.good ? C.ledger : C.alert}>{k.value}</Mono>
                {k.good ? <TrendingUp size={16} color={C.ledger} /> : <TrendingDown size={16} color={C.alert} />}
              </div>
              {k.sub && <div style={{ fontSize: 12, color: C.mist, marginTop: 4 }}>{k.sub}</div>}
            </Card>
          ))}
        </div>
      </div>
      <Card>
        <H>Revenue vs. expenses — illustrative monthly shape</H>
        <div style={{ fontSize: 12, color: C.mist, margin: "4px 0 12px" }}>Your annual figures spread across a typical seasonal pattern. Replace with real monthly data in production.</div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11, fontFamily: FONT_MONO }} tickFormatter={(v) => "$" + (v / 1000).toFixed(0) + "k"} />
            <Tooltip formatter={(v) => fmt(v as number)} />
            <Legend />
            <Area type="monotone" dataKey="Revenue" stroke={C.ledger} fill={C.ledgerSoft} strokeWidth={2} />
            <Area type="monotone" dataKey="Expenses" stroke={C.alert} fill="#F7E6E2" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
      <Card>
        <H>Expense structure (estimated for {p.industry})</H>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={expenseSplit} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
              <Cell fill={C.signal} /><Cell fill={C.ink2} />
            </Pie>
            <Tooltip formatter={(v) => fmt(v as number)} /><Legend />
          </PieChart>
        </ResponsiveContainer>
      </Card>
      {p.location.trim().length >= 3 && <LocationInsight location={p.location} />}
    </div>
  );
}

function Financials({ m }: { m: Metrics }) {
  const [growth, setGrowth] = useState(Math.round(m.bench.growth * 100));
  const proj = Array.from({ length: 12 }, (_, i) => {
    const g = Math.pow(1 + growth / 100, (i + 1) / 12);
    const rev = m.mRev * g, exp = m.mExp * Math.pow(1.02, (i + 1) / 12);
    return { month: "M" + (i + 1), Revenue: Math.round(rev), Expenses: Math.round(exp), "Net cash": Math.round(rev - exp) };
  });
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
        <Card>
          <Label>Break-even revenue (annual)</Label>
          <Mono>{m.breakEven === Infinity ? "n/a" : fmt(m.breakEven)}</Mono>
          <div style={{ fontSize: 12, color: C.mist, marginTop: 6 }}>
            Fixed costs {fmt(m.fixedCosts)} ÷ contribution margin {pct(m.cmRatio)}. You are {m.rev >= m.breakEven ? "above" : "below"} break-even.
          </div>
        </Card>
        <Card>
          <Label>Cash runway</Label>
          <Mono color={m.runway === Infinity ? C.ledger : m.runway > 6 ? C.ledger : m.runway > 3 ? C.signal : C.alert}>
            {m.runway === Infinity ? "Self-sustaining" : m.runway.toFixed(1) + " months"}
          </Mono>
          <div style={{ fontSize: 12, color: C.mist, marginTop: 6 }}>
            {m.runway === Infinity ? "Positive monthly cash flow — reserves are growing." : "Months of cash left at the current burn rate."}
          </div>
        </Card>
        <Card>
          <Label>Monthly cash flow</Label>
          <Mono color={m.mCash >= 0 ? C.ledger : C.alert}>{fmt(m.mCash)}</Mono>
          <div style={{ fontSize: 12, color: C.mist, marginTop: 6 }}>Revenue {fmt(m.mRev)} − expenses {fmt(m.mExp)} per month.</div>
        </Card>
      </div>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <H>12-month projection</H>
          <label style={{ fontSize: 13, color: C.mist }}>
            Annual growth assumption: <span style={{ fontFamily: FONT_MONO, color: C.ink, fontWeight: 600 }}>{growth}%</span>{" "}
            <input type="range" min="-20" max="40" value={growth} onChange={(e) => setGrowth(+e.target.value)} style={{ verticalAlign: "middle", accentColor: C.ledger }} />
          </label>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={proj}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11, fontFamily: FONT_MONO }} tickFormatter={(v) => "$" + (v / 1000).toFixed(0) + "k"} />
            <Tooltip formatter={(v) => fmt(v as number)} /><Legend />
            <ReferenceLine y={0} stroke={C.mist} />
            <Line type="monotone" dataKey="Revenue" stroke={C.ledger} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Expenses" stroke={C.alert} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Net cash" stroke={C.signal} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

function Risk({ m }: { m: Metrics }) {
  const [revDrop, setRevDrop] = useState(15);
  const [expUp, setExpUp] = useState(5);
  const sRev = m.mRev * (1 - revDrop / 100), sExp = m.mExp * (1 + expUp / 100);
  const sCash = sRev - sExp;
  const sRunway = sCash >= 0 ? Infinity : m.cash / Math.abs(sCash);
  const credit = [
    { item: "Positive net profit", ok: m.profit > 0 },
    { item: "2+ years in business", ok: m.age >= 2 },
    { item: "3+ months of cash reserves", ok: m.cash >= m.mExp * 3 },
    { item: "Margin at or above industry average", ok: m.margin >= m.bench.margin },
    { item: "Debt service headroom (est. 10%+ of revenue)", ok: m.profit > m.rev * 0.1 },
  ];
  const creditScore = credit.filter((c) => c.ok).length;
  const macro = [
    { name: "Fed funds rate", note: "Sets the floor for SBA and bank loan pricing — check federalreserve.gov" },
    { name: "CPI inflation", note: "Drives your input costs and pricing power — bls.gov/cpi" },
    { name: "Small Business Optimism Index (NFIB)", note: "Monthly pulse of main-street sentiment — nfib.com" },
    { name: "Unemployment rate", note: "Signals hiring difficulty and consumer demand — bls.gov" },
  ];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <H>Cash-flow stress test</H>
          <div style={{ fontSize: 13, color: C.mist, margin: "6px 0 14px" }}>Drag to simulate a downturn and see what happens to your runway.</div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 10 }}>
            Revenue drops <span style={{ fontFamily: FONT_MONO, fontWeight: 700 }}>{revDrop}%</span><br />
            <input type="range" min="0" max="50" value={revDrop} onChange={(e) => setRevDrop(+e.target.value)} style={{ width: "100%", accentColor: C.alert }} />
          </label>
          <label style={{ display: "block", fontSize: 13, marginBottom: 14 }}>
            Expenses rise <span style={{ fontFamily: FONT_MONO, fontWeight: 700 }}>{expUp}%</span><br />
            <input type="range" min="0" max="30" value={expUp} onChange={(e) => setExpUp(+e.target.value)} style={{ width: "100%", accentColor: C.signal }} />
          </label>
          <div style={{ background: C.paper, borderRadius: 8, padding: 14 }}>
            <Label>Stressed monthly cash flow</Label>
            <Mono color={sCash >= 0 ? C.ledger : C.alert}>{fmt(sCash)}</Mono>
            <div style={{ fontSize: 13, marginTop: 8 }}>
              Runway under stress:{" "}
              <span style={{ fontFamily: FONT_MONO, fontWeight: 700, color: sRunway === Infinity ? C.ledger : sRunway > 4 ? C.signal : C.alert }}>
                {sRunway === Infinity ? "still self-sustaining" : sRunway.toFixed(1) + " months"}
              </span>
            </div>
          </div>
        </Card>
        <Card>
          <H>Credit readiness</H>
          <div style={{ fontSize: 13, color: C.mist, margin: "6px 0 14px" }}>
            {creditScore}/5 lender checkpoints met — {creditScore >= 4 ? "strong position for SBA or bank financing." : creditScore >= 2 ? "fundable with the right lender; CDFIs and microloans are good fits." : "focus on profitability and reserves before applying, or start with a microloan."}
          </div>
          {credit.map((c) => (
            <div key={c.item} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.line}`, fontSize: 14 }}>
              <span style={{ fontFamily: FONT_MONO, fontWeight: 700, color: c.ok ? C.ledger : C.alert, width: 18 }}>{c.ok ? "✓" : "✗"}</span>
              {c.item}
            </div>
          ))}
        </Card>
      </div>
      <Card>
        <H>Macroeconomic indicators to watch</H>
        <div style={{ fontSize: 13, color: C.mist, margin: "6px 0 12px" }}>Live values change constantly — use the AI Advisor&apos;s news briefing to pull today&apos;s numbers, or check the sources below.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
          {macro.map((x) => (
            <div key={x.name} style={{ background: C.paper, borderRadius: 8, padding: 14 }}>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14 }}>{x.name}</div>
              <div style={{ fontSize: 12.5, color: C.mist, marginTop: 4 }}>{x.note}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Advisor({ p, m }: { p: Profile; m: Metrics }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [evidence, setEvidence] = useState<Record<number, Evidence[]>>({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const quicks = [
    { label: "Business plan outline", prompt: "Draft a one-page business plan outline tailored to my business, with the 3 numbers I most need to improve." },
    { label: "Marketing recommendations", prompt: "Give me 5 prioritized marketing moves for my budget and challenge, with rough monthly cost and expected impact for each." },
    { label: "Customer analysis", prompt: "Help me analyze my likely customer segments for this industry and location, and how to learn more about them cheaply." },
    { label: "Operational fixes", prompt: "Give me the top 5 operational improvements for my stated challenge, ordered by effort vs. payoff." },
    { label: "Cut costs safely", prompt: "Where do businesses like mine usually overspend? Suggest cuts that won't hurt revenue." },
  ];

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const history = messages;
    setMessages([...history, { role: "user", text }]); setInput(""); setBusy(true);
    try {
      const { reply, evidence: used } = await askAdvisor(p, m, text, history);
      setMessages((cur) => {
        const next = [...cur, { role: "ai" as const, text: reply || "No response — please try again." }];
        setEvidence((e) => ({ ...e, [next.length - 1]: used }));
        return next;
      });
    } catch (err) {
      setMessages((cur) => [...cur, { role: "ai", text: err instanceof Error ? err.message : "Connection error. Please try again." }]);
    }
    setBusy(false);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <H>Ask your AI advisor</H>
        <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 12px" }}>Powered by Claude, briefed with your full business profile. Try a quick action or ask anything.</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {quicks.map((q) => (
            <Btn key={q.label} tone="ghost" style={{ fontSize: 13, padding: "8px 12px" }} onClick={() => send(q.prompt)} disabled={busy}>
              <Sparkles size={13} style={{ verticalAlign: -2, marginRight: 5, color: C.ledger }} />{q.label}
            </Btn>
          ))}
        </div>
        <div style={{ maxHeight: 420, overflowY: "auto", display: "grid", gap: 10, marginBottom: 12 }}>
          {messages.length === 0 && (
            <div style={{ color: C.mist, fontSize: 14, background: C.paper, borderRadius: 8, padding: 16 }}>
              No conversation yet. Ask about pricing, hiring, financing, marketing — anything on your mind.
            </div>
          )}
          {messages.map((mm, i) => (
            <div key={i} style={{
              justifySelf: mm.role === "user" ? "end" : "start", maxWidth: "85%",
              background: mm.role === "user" ? C.ink : C.paper, color: mm.role === "user" ? "#fff" : C.ink,
              borderRadius: 10, padding: "10px 14px", fontSize: 14, lineHeight: 1.5,
            }}>
              {mm.role === "ai" ? <Markdown>{mm.text}</Markdown> : <span style={{ whiteSpace: "pre-wrap" }}>{mm.text}</span>}
              {mm.role === "ai" && <EvidenceTrail evidence={evidence[i] ?? []} />}
            </div>
          ))}
          {busy && <div style={{ color: C.mist, fontSize: 13 }}><RefreshCw size={13} style={{ verticalAlign: -2 }} className="spin" /> Advisor is thinking…</div>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...inputStyle, flex: 1 }} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)} placeholder="e.g., Should I raise my prices 5%?" />
          <Btn tone="green" onClick={() => send(input)} disabled={busy}><Send size={15} /></Btn>
        </div>
      </Card>
    </div>
  );
}

function Funding({ p, m }: { p: Profile; m: Metrics }) {
  const need = p.financing;
  const matches = FUNDING.filter((f) => need === "None right now" || f.best.some((b) => need.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(need.toLowerCase())));
  const rest = FUNDING.filter((f) => !matches.includes(f));
  const Item = ({ f, matched }: { f: (typeof FUNDING)[number]; matched?: boolean }) => (
    <div style={{ border: `1px solid ${matched ? C.ledger : C.line}`, background: matched ? C.ledgerSoft : "#fff", borderRadius: 10, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 15 }}>{f.name}</div>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12, background: C.ink, color: "#fff", borderRadius: 6, padding: "2px 8px", alignSelf: "start" }}>{f.type} · {f.amount}</span>
      </div>
      <div style={{ fontSize: 13, color: C.ink2, marginTop: 6 }}>{f.notes}</div>
      <div style={{ fontSize: 12, color: C.mist, marginTop: 6 }}>Best for: {f.best.join(", ")} · {f.url}</div>
    </div>
  );
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {need !== "None right now" && (
        <Card style={{ borderLeft: `4px solid ${C.ledger}` }}>
          <H size={15}>Matched to your need: {need}</H>
          <div style={{ fontSize: 13, color: C.mist, marginTop: 2 }}>
            Credit readiness {m.profit > 0 && m.age >= 2 ? "looks solid — SBA and bank routes are realistic." : "is still building — microloans and CDFIs are usually the friendliest starting point."}
          </div>
        </Card>
      )}
      <div style={{ display: "grid", gap: 12 }}>
        {matches.map((f) => <Item key={f.name} f={f} matched />)}
        {rest.map((f) => <Item key={f.name} f={f} />)}
      </div>
      <Card>
        <H><Landmark size={17} style={{ verticalAlign: -3 }} /> Banks known for small-business lending</H>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 12 }}>
          {BANKS.map((b) => (
            <div key={b.name} style={{ background: C.paper, borderRadius: 8, padding: 14 }}>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14 }}>{b.name}</div>
              <div style={{ fontSize: 12.5, color: C.mist, marginTop: 4 }}>{b.note}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <H><Globe2 size={17} style={{ verticalAlign: -3 }} /> Around the world</H>
        <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 12px" }}>Small-business funding routes beyond the US.</div>
        <div style={{ display: "grid", gap: 8 }}>
          {WORLD.map((w) => (
            <div key={w.name} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.line}`, fontSize: 14 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, background: C.paper, borderRadius: 6, padding: "3px 8px", alignSelf: "start", whiteSpace: "nowrap" }}>{w.region}</span>
              <div><b style={{ fontFamily: FONT_HEAD }}>{w.name}</b><div style={{ color: C.mist, fontSize: 13 }}>{w.note}</div></div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: C.mist, marginTop: 12 }}>Program terms change often — always confirm details on the official site before applying.</div>
      </Card>
    </div>
  );
}

/* ---------- shell ---------- */
const TABS = [
  { id: "dash", label: "Dashboard", icon: LayoutDashboard },
  { id: "bench", label: "Where You Stand", icon: Users },
  { id: "fin", label: "Financials", icon: Calculator },
  { id: "risk", label: "Risk", icon: ShieldAlert },
  { id: "ai", label: "AI Advisor", icon: Sparkles },
  { id: "fund", label: "Funding", icon: Landmark },
  { id: "news", label: "News & Markets", icon: Newspaper },
  { id: "opp", label: "Opportunities", icon: Rocket },
] as const;

export default function DashboardShell({ profile }: { profile: Profile }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("dash");
  const m = useMetrics(profile);
  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0];
  const sideTop = NAV_H;

  return (
    <div style={{ minHeight: `calc(100vh - ${NAV_H}px)`, background: C.paper, display: "flex", fontFamily: FONT_BODY }}>
      <style>{`
        .spin { animation: sp 1s linear infinite; } @keyframes sp { to { transform: rotate(360deg); } }
        @media (max-width: 820px) { .mb-side { display: none !important; } .mb-topnav { display: flex !important; } }
      `}</style>

      {/* sidebar */}
      <nav className="mb-side" style={{
        width: 216, background: C.ink, color: "#fff", padding: "24px 14px", boxSizing: "border-box",
        position: "sticky", top: sideTop, height: `calc(100vh - ${sideTop}px)`, alignSelf: "flex-start",
      }}>
        <div style={{ fontSize: 11.5, color: "#8CA3B0", marginBottom: 20 }}>{profile.location || "United States"}</div>
        {TABS.map((t) => {
          const Icon = t.icon; const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
              background: active ? "#233845" : "transparent", color: active ? "#fff" : "#AEC0CB",
              border: "none", borderLeft: active ? `3px solid #5FCBA7` : "3px solid transparent",
              borderRadius: 8, padding: "10px 12px", marginBottom: 4, fontSize: 14, fontFamily: FONT_HEAD, fontWeight: 500, cursor: "pointer",
            }}>
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
        <Link href="/assessment" style={{
          marginTop: 20, display: "block", textAlign: "center", textDecoration: "none",
          background: "transparent", border: "1px solid #33505F", color: "#AEC0CB",
          borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: FONT_HEAD,
        }}>
          Edit business profile
        </Link>
      </nav>

      {/* main */}
      <main style={{ flex: 1, padding: "24px 26px", maxWidth: 1120, boxSizing: "border-box" }}>
        {/* mobile nav */}
        <div className="mb-topnav" style={{ display: "none", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 4 }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              whiteSpace: "nowrap", background: tab === t.id ? C.ink : "#fff", color: tab === t.id ? "#fff" : C.ink,
              border: `1px solid ${C.line}`, borderRadius: 20, padding: "7px 13px", fontSize: 13, fontFamily: FONT_HEAD, cursor: "pointer",
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ fontFamily: FONT_HEAD, fontSize: 24, margin: 0, color: C.ink }}>{activeTab.label}</h2>
          <div style={{ fontSize: 13, color: C.mist }}>{profile.industry} · {m.emp} employee{m.emp === 1 ? "" : "s"} · {m.age} yr{m.age === 1 ? "" : "s"} old · revenue {fmt(m.rev)}</div>
        </div>
        {tab === "dash" && <Dashboard p={profile} m={m} />}
        {tab === "bench" && <BenchmarkPanel profile={profile} />}
        {tab === "fin" && <Financials m={m} />}
        {tab === "risk" && <Risk m={m} />}
        {tab === "ai" && <Advisor p={profile} m={m} />}
        {tab === "fund" && <Funding p={profile} m={m} />}
        {tab === "news" && <NewsPanel p={profile} />}
        {tab === "opp" && <OpportunitiesPanel p={profile} />}
        <div style={{ fontSize: 11.5, color: C.mist, marginTop: 28, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
          <Copyright /> · estimates based on your inputs and industry averages · educational tool, not financial, legal, tax, or investment advice.
        </div>
      </main>
    </div>
  );
}
