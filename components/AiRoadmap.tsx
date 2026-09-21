"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Sparkles, ChevronDown, ChevronRight, Copy, Check, FileDown, Printer, RotateCcw,
  Info, ShieldCheck, GraduationCap, Wrench, ListChecks, ArrowRight, Bot,
} from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import { INDUSTRIES } from "@/lib/data";
import type { Profile } from "@/lib/data";
import {
  DEFAULT_ANSWERS, FOCUS_OPTIONS, RECORDS_OPTIONS, TOOL_OPTIONS, DEVICE_OPTIONS,
  EXPERIENCE_OPTIONS, BUDGET_OPTIONS, costLabel, timeLabel,
  type ReadinessAnswers, type ReadinessContext, type AdoptionPlan, type MatchedUseCase, type ToolKey, type FocusArea,
} from "@/lib/aiReadiness";
import { useLocalState } from "@/lib/useLocalState";
import { Card, H, Btn, Label, ScoreRing, inputStyle } from "./ui";
import Markdown from "./Markdown";

type Saved = {
  context: ReadinessContext;
  answers: ReadinessAnswers;
  plan: AdoptionPlan;
  summary: string | null;
  done: Record<string, boolean>;
  savedAt: string;
};

const STORAGE_KEY = "microbiz.aiRoadmap.v1";

/* ---------- small controls ---------- */

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} style={{
      textAlign: "left", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, lineHeight: 1.3,
      padding: "9px 13px", borderRadius: 999,
      border: `1px solid ${on ? C.ledger : C.line}`,
      background: on ? C.ledgerSoft : "#fff", color: on ? C.ledger : C.ink, fontWeight: on ? 600 : 400,
    }}>{on ? "✓ " : ""}{children}</button>
  );
}

function Choice({ on, onClick, label, hint }: { on: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={onClick} role="radio" aria-checked={on} style={{
      textAlign: "left", cursor: "pointer", fontFamily: "inherit", padding: "10px 13px", borderRadius: 10,
      border: `1px solid ${on ? C.ledger : C.line}`, background: on ? C.ledgerSoft : "#fff",
    }}>
      <div style={{ fontSize: 14, fontWeight: on ? 600 : 500, color: on ? C.ledger : C.ink }}>{label}</div>
      {hint && <div style={{ fontSize: 12, color: C.mist, marginTop: 2 }}>{hint}</div>}
    </button>
  );
}

function Question({ n, title, note, children }: { n: number; title: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "18px 0", borderTop: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.mist }}>{n}</span>
        <div>
          <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 15, color: C.ink }}>{title}</div>
          {note && <div style={{ fontSize: 12.5, color: C.mist, marginTop: 2 }}>{note}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

const badge = (color: string): React.CSSProperties => ({
  fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: "0.05em", textTransform: "uppercase",
  color, border: `1px solid ${C.line}`, borderRadius: 999, padding: "2px 9px", background: "#fff", whiteSpace: "nowrap",
});

/* ---------- use-case card ---------- */

function UseCaseCard({ uc, index }: { uc: MatchedUseCase; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(uc.promptFilled);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked: the text is selectable on screen */ }
  }

  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: "#fff" }}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} style={{
        width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left",
        padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start",
      }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: C.ledger, fontWeight: 700, width: 18 }}>{index + 1}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 15, color: C.ink }}>{uc.title}</span>
          <span style={{ display: "block", fontSize: 13, color: C.mist, lineHeight: 1.5, marginTop: 3 }}>{uc.what}</span>
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            <span style={badge(uc.cost === "free" ? C.ledger : C.signal)}>{costLabel(uc.cost)}</span>
            <span style={badge(C.mist)}>{timeLabel(uc.timeToValue)}</span>
          </span>
        </span>
        {open ? <ChevronDown size={16} color={C.mist} style={{ marginTop: 3 }} /> : <ChevronRight size={16} color={C.mist} style={{ marginTop: 3 }} />}
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px 46px", display: "grid", gap: 12, fontSize: 13.5, lineHeight: 1.55, color: C.ink }}>
          <div>
            <Label>Why this fits you</Label>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{uc.because.map((b) => <li key={b}>{b}</li>)}</ul>
          </div>
          <div><Label>Your first step</Label>{uc.firstStep}</div>
          <div>
            <Label>Try this request</Label>
            <div style={{
              background: C.paper, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px",
              fontSize: 13, lineHeight: 1.55, userSelect: "text",
            }}>{uc.promptFilled}</div>
            <button onClick={copy} style={{
              marginTop: 8, display: "inline-flex", gap: 6, alignItems: "center", cursor: "pointer",
              background: "none", border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 11px",
              fontSize: 12.5, color: C.ink, fontFamily: FONT_HEAD, fontWeight: 500,
            }}>{copied ? <Check size={13} color={C.ledger} /> : <Copy size={13} />} {copied ? "Copied" : "Copy request"}</button>
            <span style={{ fontSize: 12, color: C.mist, marginLeft: 10 }}>Fill in the [brackets] with your own details.</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <ShieldCheck size={15} color={C.signal} style={{ marginTop: 2, flexShrink: 0 }} />
            <div><b>Keep in mind:</b> {uc.guardrail}</div>
          </div>
          <div><Label>How you will know it worked</Label>{uc.measure}</div>
          {uc.link && (
            <Link href={uc.link.href} style={{ color: C.ledger, fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
              {uc.link.label} <ArrowRight size={13} style={{ verticalAlign: -2 }} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- main ---------- */

export default function AiRoadmap({ profile }: { profile: Profile | null }) {
  const [saved, setSaved, hydrated] = useLocalState<Saved | null>(STORAGE_KEY, null);
  const [answers, setAnswers] = useState<ReadinessAnswers>(DEFAULT_ANSWERS);
  const [industry, setIndustry] = useState(profile?.industry ?? "Retail");
  const [employees, setEmployees] = useState(profile?.employees ?? "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const context: ReadinessContext = useMemo(() => ({
    industry: profile?.industry ?? industry,
    employees: +(profile?.employees ?? employees) || 0,
    location: profile?.location ?? "",
    marketing: profile?.marketing ?? "",
    operations: profile?.operations ?? "",
  }), [profile, industry, employees]);

  const set = <K extends keyof ReadinessAnswers>(k: K, v: ReadinessAnswers[K]) => setAnswers((a) => ({ ...a, [k]: v }));

  const toggleFocus = (k: FocusArea) =>
    set("focus", answers.focus.includes(k) ? answers.focus.filter((x) => x !== k) : answers.focus.length >= 3 ? answers.focus : [...answers.focus, k]);

  const toggleTool = (k: ToolKey | "none") => {
    if (k === "none") return set("tools", []);
    set("tools", answers.tools.includes(k) ? answers.tools.filter((x) => x !== k) : [...answers.tools, k]);
  };

  async function build() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/ai-roadmap", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, answers }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't build the plan.");
      setSaved({
        context, answers, plan: json.plan as AdoptionPlan, summary: (json.summary ?? null) as string | null,
        done: saved?.done ?? {}, savedAt: new Date().toISOString(),
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't build the plan. Please try again.");
    }
    setBusy(false);
  }

  function startOver() {
    if (saved) setAnswers(saved.answers);
    setEditing(true);
  }

  function toggleDone(id: string) {
    if (!saved) return;
    setSaved({ ...saved, done: { ...saved.done, [id]: !saved.done[id] } });
  }

  async function exportWord() {
    if (!saved) return;
    setExporting(true);
    try {
      const { plan, summary, context: ctx } = saved;
      const res = await fetch("/api/report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "AI Adoption Plan",
          subtitle: `${ctx.industry}${ctx.location ? ` · ${ctx.location}` : ""}`,
          sections: [
            {
              heading: "Executive summary",
              paragraphs: [
                `AI readiness: ${plan.readiness.overall}/100 — ${plan.readiness.stageLabel}. ${plan.readiness.stageBlurb}`,
                ...(summary ? summary.split(/\n\s*\n/) : []),
              ],
            },
            {
              heading: "Readiness by area",
              table: {
                columns: ["Area", "Score", "What it means"],
                rows: plan.readiness.dimensions.map((d) => [d.label, `${d.score}/100`, d.reading]),
              },
            },
            {
              heading: "Where to start",
              table: {
                columns: ["Use", "Cost", "Time to a first result", "First step"],
                rows: plan.start.map((u) => [u.title, costLabel(u.cost), timeLabel(u.timeToValue), u.firstStep]),
              },
            },
            ...(plan.foundations.length
              ? [{ heading: "Put these in place first", paragraphs: plan.foundations.map((f) => `${f.title}. ${f.detail}`) }]
              : []),
            {
              heading: "Learning path",
              paragraphs: plan.training.map((t) => `${t.title} (${t.minutes} min). ${t.detail}`),
            },
            ...plan.roadmap.map((p) => ({
              heading: `${p.label}: ${p.goal}`,
              paragraphs: p.tasks.map((t) => `${saved.done[`${p.id}:${t.id}`] ? "[done]" : "[ ]"} ${t.title} — ${t.detail}`),
            })),
            ...(plan.later.length
              ? [{ heading: "Worth adding later", paragraphs: plan.later.map((l) => `${l.title} — ${l.unlockedBy ? `first: ${l.unlockedBy}.` : ""} ${l.firstStep}`) }]
              : []),
          ],
          sources: [
            "Business details and answers: supplied by the business owner.",
            "Readiness score: calculated by MicroBiz AI from those answers. It is self-reported, not a measurement.",
            "Recommended uses: MicroBiz AI's curated catalog of everyday AI uses, matched to the answers. Cost and timing are qualitative; no savings are claimed.",
          ],
          limitations:
            "This plan is educational and based only on what the owner reported. AI tools make mistakes: check every fact, price and date before use, and do not share customers' personal or payment details. Not financial, legal, tax, or investment advice.",
        }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "ai-adoption-plan.docx";
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch {
      alert("Couldn't build the Word document. Please try again.");
    }
    setExporting(false);
  }

  if (!hydrated) return null;

  /* ---------------- intake ---------------- */
  if (!saved || editing) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Card>
          <H>Business AI Assessment</H>
          <div style={{ fontSize: 13.5, color: C.mist, margin: "4px 0 6px", maxWidth: 680, lineHeight: 1.55 }}>
            Seven quick questions, about two minutes. There are no wrong answers, and &ldquo;none of these&rdquo; or
            &ldquo;$0&rdquo; is a perfectly good place to start — the plan is built around where your business is today.
          </div>

          <div style={{ marginTop: 10, padding: "12px 14px", background: C.paper, borderRadius: 8, fontSize: 13, color: C.ink }}>
            {profile ? (
              <>
                <b>Already known from your business assessment:</b> {profile.industry}
                {profile.location ? ` · ${profile.location}` : ""} · {profile.employees || "0"} employee{+profile.employees === 1 ? "" : "s"}
                {profile.marketing || profile.operations ? " · your marketing and operations challenges" : ""}.
                {" "}We won&apos;t ask for these again.
              </>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
                <div>
                  <Label>Type of business</Label>
                  <select style={inputStyle} value={industry} onChange={(e) => setIndustry(e.target.value)}>
                    {Object.keys(INDUSTRIES).map((i) => <option key={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Employees (including you)</Label>
                  <input style={inputStyle} type="number" value={employees} onChange={(e) => setEmployees(e.target.value)} placeholder="3" />
                </div>
                <div style={{ gridColumn: "1 / -1", fontSize: 12.5, color: C.mist }}>
                  Tip: the <Link href="/assessment" style={{ color: C.ledger }}>Business Assessment</Link> lets us tailor this further using your challenges.
                </div>
              </div>
            )}
          </div>

          <Question n={1} title="Where does most of your repetitive time go?" note="Pick up to three.">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {FOCUS_OPTIONS.map((o) => (
                <Chip key={o.key} on={answers.focus.includes(o.key)} onClick={() => toggleFocus(o.key)}>
                  {o.label} <span style={{ color: C.mist, fontWeight: 400 }}>— {o.hint}</span>
                </Chip>
              ))}
            </div>
          </Question>

          <Question n={2} title="How do you keep track of sales and expenses today?">
            <div role="radiogroup" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>
              {RECORDS_OPTIONS.map((o) => (
                <Choice key={o.key} on={answers.records === o.key} onClick={() => set("records", o.key)} label={o.label} hint={o.hint} />
              ))}
            </div>
          </Question>

          <Question n={3} title="Which of these do you already use?" note="Tick any that apply. Having none is fine.">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {TOOL_OPTIONS.map((o) => (
                <Chip key={o.key} on={o.key === "none" ? answers.tools.length === 0 : answers.tools.includes(o.key as ToolKey)} onClick={() => toggleTool(o.key)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </Question>

          <Question n={4} title="What do you mostly work from?">
            <div role="radiogroup" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {DEVICE_OPTIONS.map((o) => <Chip key={o.key} on={answers.device === o.key} onClick={() => set("device", o.key)}>{o.label}</Chip>)}
            </div>
          </Question>

          <Question n={5} title="Have you used AI tools such as ChatGPT or Claude?">
            <div role="radiogroup" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
              {EXPERIENCE_OPTIONS.map((o) => (
                <Choice key={o.key} on={answers.experience === o.key} onClick={() => set("experience", o.key)} label={o.label} hint={o.hint} />
              ))}
            </div>
          </Question>

          <Question n={6} title="What could you spend on new tools each month?">
            <div role="radiogroup" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
              {BUDGET_OPTIONS.map((o) => (
                <Choice key={o.key} on={answers.budget === o.key} onClick={() => set("budget", o.key)} label={o.label} hint={o.hint} />
              ))}
            </div>
          </Question>

          <Question n={7} title="One task you repeat every week (optional)" note="In your own words — it helps us pick the right first step.">
            <input style={inputStyle} value={answers.repetitive} maxLength={300}
              onChange={(e) => set("repetitive", e.target.value)} placeholder="e.g., answering the same questions on WhatsApp; writing up quotes" />
          </Question>

          {error && <div style={{ color: C.alert, fontSize: 13.5, marginTop: 4 }}>{error}</div>}
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 10 }}>
            {saved && <Btn tone="ghost" onClick={() => setEditing(false)}>Cancel</Btn>}
            <Btn tone="green" onClick={build} disabled={busy}>
              <Sparkles size={15} style={{ verticalAlign: -3, marginRight: 7 }} />
              {busy ? "Building your plan…" : "Build my AI plan"}
            </Btn>
          </div>
        </Card>
        <div style={{ fontSize: 12, color: C.mist }}>
          Your answers stay in this browser. They are sent to MicroBiz AI only when you build the plan, and are not stored on our servers.
        </div>
      </div>
    );
  }

  /* ---------------- results ---------------- */
  const { plan, summary } = saved;
  const allTasks = plan.roadmap.flatMap((p) => p.tasks.map((t) => `${p.id}:${t.id}`));
  const doneCount = allTasks.filter((k) => saved.done[k]).length;
  const pctDone = allTasks.length ? Math.round((doneCount / allTasks.length) * 100) : 0;
  const stageColor = plan.readiness.stage === "scale" ? C.ledger : plan.readiness.stage === "starter" ? C.signal : C.mist;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "center" }}>
          <ScoreRing score={plan.readiness.overall} caption="AI READINESS" />
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ ...badge(stageColor), display: "inline-block", marginBottom: 8 }}>{plan.readiness.stageLabel}</div>
            <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 19, color: C.ink, marginBottom: 6 }}>
              Your AI adoption plan for a {saved.context.industry.toLowerCase()} business
            </div>
            <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.6 }}>{plan.readiness.stageBlurb}</div>
            <div style={{ fontSize: 11.5, color: C.mist, marginTop: 8 }}>
              Calculated from your own answers on {new Date(saved.savedAt).toLocaleDateString("en-US", { dateStyle: "medium" })} — self-reported, not measured.
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, marginTop: 20 }}>
          {plan.readiness.dimensions.map((d) => (
            <div key={d.key}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontFamily: FONT_HEAD, fontWeight: 600, color: C.ink }}>
                <span>{d.label}</span><span style={{ fontFamily: FONT_MONO, color: C.mist }}>{d.score}</span>
              </div>
              <div style={{ height: 6, background: C.line, borderRadius: 3, margin: "6px 0" }}>
                <div style={{ width: `${d.score}%`, height: "100%", background: d.score >= 65 ? C.ledger : d.score >= 35 ? C.signal : C.alert, borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 12.5, color: C.mist, lineHeight: 1.5 }}>{d.reading}</div>
            </div>
          ))}
        </div>
      </Card>

      {summary && (
        <Card>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <Sparkles size={15} color={C.ledger} /><H size={15}>In plain words</H>
          </div>
          <div style={{ fontSize: 14.5, lineHeight: 1.65 }}><Markdown>{summary}</Markdown></div>
          <div style={{ fontSize: 11.5, color: C.mist, marginTop: 8 }}>
            Written by Claude from the results on this page only. It cannot add tools, prices or savings that are not in the plan.
          </div>
        </Card>
      )}

      {plan.foundations.length > 0 && (
        <Card style={{ borderLeft: `3px solid ${C.signal}` }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <Wrench size={16} color={C.signal} /><H size={16}>Put these in place first</H>
          </div>
          <div style={{ fontSize: 13, color: C.mist, marginBottom: 10 }}>
            None of this needs new software or money — just a habit. It is what lets AI help with your real numbers later.
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {plan.foundations.map((f) => (
              <div key={f.id} style={{ fontSize: 13.5, lineHeight: 1.55 }}><b>{f.title}.</b> {f.detail}</div>
            ))}
          </div>
        </Card>
      )}

      <div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "6px 0 10px" }}>
          <Sparkles size={16} color={C.ledger} /><H size={17}>Start with these</H>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {plan.start.map((u, i) => <UseCaseCard key={u.id} uc={u} index={i} />)}
        </div>
      </div>

      <Card>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
          <GraduationCap size={16} color={C.ledger} /><H size={16}>How to learn it</H>
        </div>
        <div style={{ fontSize: 13, color: C.mist, marginBottom: 12 }}>
          About {plan.training.reduce((s, t) => s + t.minutes, 0)} minutes in total, done in short sittings. Use a free AI assistant on your phone or computer.
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {plan.training.map((t) => (
            <div key={t.id} style={{ fontSize: 13.5, lineHeight: 1.55 }}>
              <b>{t.title}</b> <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.mist }}>{t.minutes} min</span>
              <div style={{ color: C.ink }}>{t.detail}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <ListChecks size={16} color={C.ledger} /><H size={16}>Your 30-60-90 day roadmap</H>
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.mist }}>{doneCount} of {allTasks.length} done · {pctDone}%</div>
        </div>
        <div style={{ height: 6, background: C.line, borderRadius: 3, marginBottom: 16 }}>
          <div style={{ width: `${pctDone}%`, height: "100%", background: C.ledger, borderRadius: 3, transition: "width .2s" }} />
        </div>
        <div style={{ display: "grid", gap: 20 }}>
          {plan.roadmap.map((p) => (
            <div key={p.id}>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14.5, color: C.ink }}>
                {p.label} <span style={{ color: C.mist, fontWeight: 400 }}>· {p.goal}</span>
              </div>
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {p.tasks.map((t) => {
                  const key = `${p.id}:${t.id}`;
                  const on = !!saved.done[key];
                  return (
                    <label key={key} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", fontSize: 13.5, lineHeight: 1.5 }}>
                      <input type="checkbox" checked={on} onChange={() => toggleDone(key)} style={{ marginTop: 3, accentColor: C.ledger }} />
                      <span style={{ opacity: on ? 0.55 : 1 }}>
                        <b style={{ textDecoration: on ? "line-through" : "none" }}>{t.title}</b>
                        <span style={{ display: "block", color: C.mist }}>{t.detail}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {plan.later.length > 0 && (
        <Card>
          <H size={16}>Worth adding later</H>
          <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 10px" }}>
            Good fits for your business that need one thing in place first. They are not a step back — they are next.
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {plan.later.map((l) => (
              <div key={l.id} style={{ fontSize: 13.5, lineHeight: 1.55 }}>
                <b>{l.title}</b> — {l.unlockedBy ? <>first, it {l.unlockedBy}.</> : null} {l.what}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card style={{ background: C.ledgerSoft, borderColor: "#BFDCD0" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ maxWidth: 560 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
              <Bot size={16} color={C.ledger} /><H size={15}>Keep going with the MicroBiz Agent</H>
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>
              Ask the Strategy &amp; Operations assistant to help you put the next step into practice, or use the Financial
              assistant for the monthly cash check-in from your roadmap.
            </div>
          </div>
          <Link href="/ask?assistant=strategy" style={{
            textDecoration: "none", background: C.ledger, color: "#fff", borderRadius: 8, padding: "10px 16px",
            fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14, whiteSpace: "nowrap",
          }}>Open the Agent</Link>
        </div>
      </Card>

      <div className="no-print" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Btn tone="green" onClick={exportWord} disabled={exporting}>
          <FileDown size={15} style={{ verticalAlign: -3, marginRight: 7 }} />{exporting ? "Building…" : "Download plan (Word)"}
        </Btn>
        <Btn tone="ghost" onClick={() => window.print()}><Printer size={15} style={{ verticalAlign: -3, marginRight: 7 }} />Print / save as PDF</Btn>
        <Btn tone="ghost" onClick={startOver}><RotateCcw size={15} style={{ verticalAlign: -3, marginRight: 7 }} />Change my answers</Btn>
      </div>

      <div style={{ display: "flex", gap: 8, fontSize: 12, color: C.mist, lineHeight: 1.55 }}>
        <Info size={14} style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          This plan is built only from what you told us. AI tools make mistakes — check every fact, price and date, and never share
          customers&apos; personal or payment details. Cost and timing labels are general, not quotes, and no savings are promised.
          Educational tool, not financial, legal, tax, or investment advice.
        </div>
      </div>
    </div>
  );
}
