import Link from "next/link";
import { Sparkles, BarChart3, Bot, ChevronRight, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { C, FONT_HEAD } from "@/lib/theme";
import { Btn, Card, ScoreRing } from "./ui";

const MISSION = [
  {
    icon: TrendingUp,
    title: "Stronger small businesses",
    body: "Real financial visibility, an AI advisor, and funding matches — the tools bigger companies take for granted, in plain language.",
  },
  {
    icon: Users,
    title: "Safer, more invested communities",
    body: "Business growth is one of the most consistent, well-documented levers for reducing long-term neighborhood crime — more local jobs, more foot traffic, more people with a stake in the block. We built the location and Opportunity Zone check into the assessment for exactly this reason: to point resources toward the communities where new businesses can do double duty.",
  },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI business assessment",
    body: "A structured read on your health score, biggest risk, and top opportunity — from nine quick answers.",
  },
  {
    icon: BarChart3,
    title: "Financial dashboard",
    body: "Revenue trend, expense breakdown, cash-flow projection, and break-even point, updated as you type.",
  },
  {
    icon: Bot,
    title: "AI business assistant",
    body: "Ask questions in plain language and get answers grounded in your own numbers, not generic advice.",
  },
];

function PreviewCard() {
  return (
    <div style={{ position: "relative" }}>
      <div style={{
        position: "absolute", top: -14, right: 16, zIndex: 2,
        background: C.signal, color: "#fff", fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 13,
        padding: "8px 14px", borderRadius: 999, boxShadow: "0 6px 16px rgba(217,154,43,0.35)",
      }}>
        Operating margin 16.0%
      </div>
      <div style={{
        background: C.ink, borderRadius: 16, padding: 24, color: "#fff",
        boxShadow: "0 20px 50px rgba(22,36,46,0.25)",
      }}>
        <div style={{ fontSize: 11.5, letterSpacing: 1.2, textTransform: "uppercase", color: "#8CA3B0", fontWeight: 600, marginBottom: 4 }}>
          Business health
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 18 }}>
          <div style={{ background: "#1E313D", borderRadius: 12, padding: "6px 6px 0" }}>
            <ScoreRing score={91} />
          </div>
          <div style={{ display: "grid", gap: 10, flex: 1 }}>
            {[
              { label: "Monthly cash flow", value: "$6,667" },
              { label: "Break-even revenue", value: "$323,789" },
              { label: "Credit readiness", value: "4 / 5" },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#8CA3B0" }}>{row.label}</span>
                <span style={{ fontFamily: "'IBM Plex Mono','SFMono-Regular',Consolas,monospace", fontWeight: 600 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 56 }}>
          {[38, 46, 42, 55, 50, 62, 58, 70, 66, 78, 74, 88].map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, background: "#5FCBA7", borderRadius: 3, opacity: 0.35 + (i / 24) }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div>
      {/* hero */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "56px 24px 40px" }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 48, alignItems: "center" }}>
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8, border: `1px solid ${C.line}`,
              borderRadius: 999, padding: "6px 14px", fontSize: 12.5, color: C.mist, fontWeight: 600, marginBottom: 20,
            }}>
              <ShieldCheck size={14} color={C.ledger} /> BUILT FOR MAIN-STREET BUSINESSES
            </div>
            <h1 style={{ fontFamily: FONT_HEAD, fontSize: 48, lineHeight: 1.08, color: C.ink, margin: "0 0 16px" }}>
              MicroBiz AI
            </h1>
            <p style={{ fontSize: 17, color: C.mist, lineHeight: 1.6, maxWidth: 480, marginBottom: 28 }}>
              AI-powered business intelligence for small businesses that have historically lacked
              access to advanced technology and financial tools.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <Link href="/assessment" style={{ textDecoration: "none" }}>
                <Btn tone="green" style={{ padding: "13px 22px", fontSize: 15 }}>
                  Start Business Assessment <ChevronRight size={16} style={{ verticalAlign: -3 }} />
                </Btn>
              </Link>
              <Link href="/ask" style={{ textDecoration: "none" }}>
                <Btn tone="ghost" style={{ padding: "13px 22px", fontSize: 15 }}>Ask MicroBiz AI</Btn>
              </Link>
            </div>
            <div style={{ fontSize: 12.5, color: C.mist }}>
              Takes about 4 minutes. No account, no bank connection required.
            </div>
          </div>
          <PreviewCard />
        </div>
      </section>

      {/* mission */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "8px 24px 40px" }}>
        <div style={{
          background: C.ledgerSoft, border: `1px solid #CDE6DB`, borderRadius: 16, padding: "32px 36px",
        }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.ledger, fontWeight: 700,
            letterSpacing: 1, textTransform: "uppercase", marginBottom: 14,
          }}>
            <ShieldCheck size={15} /> Why we built this
          </div>
          <h2 style={{ fontFamily: FONT_HEAD, fontSize: 24, color: C.ink, margin: "0 0 20px", maxWidth: 620 }}>
            MicroBiz AI has two goals: help small businesses grow, and use that growth as a tool against crime.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 20 }}>
            {MISSION.map((m) => (
              <div key={m.title} style={{ display: "flex", gap: 14 }}>
                <m.icon size={22} color={C.ledger} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 15, color: C.ink, marginBottom: 4 }}>{m.title}</div>
                  <div style={{ fontSize: 13.5, color: C.ink2, lineHeight: 1.6 }}>{m.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* what you get */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "40px 24px" }}>
        <h2 style={{ fontFamily: FONT_HEAD, fontSize: 26, color: C.ink, marginBottom: 20 }}>What you get</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <f.icon size={20} color={C.ledger} style={{ marginBottom: 12 }} />
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 16, color: C.ink, marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 13.5, color: C.mist, lineHeight: 1.55 }}>{f.body}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "8px 24px 56px" }}>
        <div style={{
          background: C.ink, borderRadius: 16, padding: "36px 40px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap",
        }}>
          <div style={{ maxWidth: 480 }}>
            <h3 style={{ fontFamily: FONT_HEAD, fontSize: 22, color: "#fff", margin: "0 0 8px" }}>
              Find out where your business really stands.
            </h3>
            <p style={{ color: "#AEC0CB", fontSize: 14, margin: 0 }}>
              Answer a few questions about your operation and finances — MicroBiz AI does the analysis.
            </p>
          </div>
          <Link href="/assessment" style={{ textDecoration: "none" }}>
            <Btn style={{ background: "#fff", color: C.ink, padding: "12px 20px", fontSize: 14 }}>Start Business Assessment</Btn>
          </Link>
        </div>
      </section>

      {/* footer */}
      <footer style={{ borderTop: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "20px 24px", fontSize: 12.5, color: C.mist }}>
          MicroBiz AI — business intelligence for small operators, and a bet that stronger local businesses make safer neighborhoods.
          Educational tool, not financial, legal, tax, or investment advice.
        </div>
      </footer>
    </div>
  );
}
