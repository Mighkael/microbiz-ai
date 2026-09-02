import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import Copyright from "./Copyright";

export type Module = {
  Icon: LucideIcon;
  title: string;
  body: string;
  href?: string;
  /** Build phase this module lands in, per the V2 plan. */
  phase?: string;
};

/**
 * Shared shell for the Business / Data / Research workspaces (V2 §19).
 * Modules that aren't built yet say so and name their phase, rather than
 * presenting an empty screen or placeholder data.
 */
export default function WorkspaceIndex({
  eyebrow, title, lede, modules,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  modules: Module[];
}) {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "56px 24px 72px" }}>
      <div style={{
        fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.18em",
        textTransform: "uppercase", color: C.ledger, fontWeight: 600, marginBottom: 12,
      }}>{eyebrow}</div>

      <h1 style={{
        fontFamily: FONT_HEAD, fontSize: "clamp(30px, 5vw, 42px)", lineHeight: 1.1,
        letterSpacing: "-0.02em", color: C.ink, margin: "0 0 12px",
      }}>{title}</h1>

      <p style={{ color: C.mist, fontSize: 16, maxWidth: 620, margin: "0 0 40px", lineHeight: 1.6 }}>{lede}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
        {modules.map(({ Icon, title: t, body, href, phase }) => {
          const inner = (
            <div style={{
              background: href ? "#fff" : C.paper,
              border: `1px solid ${C.line}`,
              borderRadius: 12, padding: 20, height: "100%", boxSizing: "border-box",
              display: "flex", flexDirection: "column", gap: 8,
              opacity: href ? 1 : 0.85,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <Icon size={20} color={href ? C.ledger : C.mist} />
                {!href && phase && (
                  <span style={{
                    fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase",
                    color: C.mist, background: "#fff", border: `1px solid ${C.line}`,
                    borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap",
                  }}>{phase}</span>
                )}
              </div>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 16, color: C.ink }}>{t}</div>
              <div style={{ fontSize: 13.5, color: C.mist, lineHeight: 1.55 }}>{body}</div>
            </div>
          );

          return href ? (
            <Link key={t} href={href} style={{ textDecoration: "none" }}>{inner}</Link>
          ) : (
            <div key={t}>{inner}</div>
          );
        })}
      </div>

      <div style={{ fontSize: 11.5, color: C.mist, marginTop: 40, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <Copyright /> · educational tool, not financial, legal, tax, or investment advice.
      </div>
    </div>
  );
}
