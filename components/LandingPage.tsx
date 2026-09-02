import Link from "next/link";
import { ChevronRight, TrendingUp, Users } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO, NAV_H } from "@/lib/theme";
import UsMapBackdrop from "./UsMapBackdrop";
import Copyright from "./Copyright";

/**
 * Homepage (V2 §2). Removed from V1 per spec: the Business Assessment card,
 * the Business Health / Operating Margin panel, and the "What You Get"
 * section. The "Find Out Where Your Business Really Stands" line was also
 * removed at the client's direction, which overrides §2's hero-message note.
 */

const MISSION = [
  {
    Icon: TrendingUp,
    title: "Stronger small businesses",
    body: "Financial visibility, benchmarking against real markets, and an AI advisor — the tools bigger companies take for granted.",
  },
  {
    Icon: Users,
    title: "Safer, more invested communities",
    body: "Business growth is one of the most consistent levers against long-term neighborhood crime: more local jobs, more foot traffic, more people with a stake in the block.",
  },
];

export default function LandingPage() {
  return (
    <div>
      {/* hero */}
      <section style={{
        position: "relative",
        minHeight: `calc(100vh - ${NAV_H}px)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "72px 24px", overflow: "hidden",
      }}>
        <UsMapBackdrop />

        <div style={{ position: "relative", textAlign: "center", maxWidth: 760 }}>
          <div style={{
            fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.22em",
            textTransform: "uppercase", color: C.ledger, fontWeight: 600, marginBottom: 22,
          }}>
            Built for main-street businesses
          </div>

          <h1 style={{
            fontFamily: FONT_HEAD,
            fontSize: "clamp(46px, 9vw, 92px)",
            lineHeight: 1.02,
            letterSpacing: "-0.03em",
            color: C.ink,
            margin: "0 0 20px",
          }}>
            MicroBiz <span style={{ color: C.ledger }}>AI</span>
          </h1>

          <p style={{
            fontSize: "clamp(16px, 2.2vw, 20px)",
            color: C.ink2, lineHeight: 1.5, margin: "0 auto 38px", maxWidth: 520,
          }}>
            AI-powered intelligence for America&apos;s small businesses.
          </p>

          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/business" style={{ textDecoration: "none" }}>
              <button style={{
                display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
                background: C.ledger, color: "#fff", border: `1px solid ${C.ledger}`, borderRadius: 10,
                padding: "16px 38px", fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 16,
                letterSpacing: "0.04em", cursor: "pointer", lineHeight: 1.2,
                boxShadow: "0 10px 28px rgba(14,123,95,0.24)",
              }}>
                BEGIN <ChevronRight size={17} />
              </button>
            </Link>
            <Link href="/ask" style={{ textDecoration: "none" }}>
              <button style={{
                display: "inline-flex", alignItems: "center", whiteSpace: "nowrap",
                background: "#fff", color: C.ink, border: `1px solid ${C.line}`, borderRadius: 10,
                padding: "16px 32px", fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 16,
                letterSpacing: "0.04em", cursor: "pointer", lineHeight: 1.2,
              }}>
                ASK MICROBIZ AI
              </button>
            </Link>
          </div>

          <div style={{ fontSize: 12.5, color: C.mist, marginTop: 22 }}>
            Takes about 4 minutes. No account, no bank connection required.
          </div>
        </div>
      </section>

      {/* why we built this — compact band per §2 */}
      <section style={{ background: C.ink, color: "#fff" }}>
        <div style={{
          maxWidth: 1080, margin: "0 auto", padding: "40px 24px",
          display: "grid", gridTemplateColumns: "auto 1fr", gap: 40, alignItems: "start",
        }} className="mb-mission">
          <div style={{ maxWidth: 230 }}>
            <div style={{
              fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.16em",
              textTransform: "uppercase", color: "#8FE0C4", fontWeight: 600, marginBottom: 10,
            }}>
              Why we built this
            </div>
            <div style={{ fontFamily: FONT_HEAD, fontSize: 17, fontWeight: 600, lineHeight: 1.35 }}>
              Two goals: help small businesses grow, and use that growth as a tool against crime.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 28 }}>
            {MISSION.map(({ Icon, title, body }) => (
              <div key={title}>
                <Icon size={18} color="#8FE0C4" style={{ marginBottom: 8 }} />
                <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14.5, marginBottom: 5 }}>{title}</div>
                <div style={{ fontSize: 13, color: "#AEC0CB", lineHeight: 1.55 }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 24px", fontSize: 12.5, color: C.mist }}>
          MicroBiz AI — business intelligence for small operators, and a bet that stronger local businesses make safer
          neighborhoods. Educational tool, not financial, legal, tax, or investment advice.
          <div style={{ marginTop: 6 }}><Copyright /></div>
        </div>
      </footer>
    </div>
  );
}
